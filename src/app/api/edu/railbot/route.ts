import { NextRequest, NextResponse } from 'next/server';
import { ERROR_CODES, errorResponse, okJson } from '@/lib/api/response';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import type { TokenPayload } from '@/lib/jwt';

/**
 * 레일봇 — 규정·교재 근거 검색 답변 (LLM 미사용, 발췌형).
 *
 * 왜 LLM 없이:
 *  - 안전 자료라 "지어냄 0%"가 최우선이다. 원문을 발췌해 보여주면 환각이 원천 불가능하다.
 *  - 검색·차종 되묻기·긴급 감지는 원래 규칙 기반이라 AI가 필요 없었다.
 *  - 유일하게 AI가 하던 "문장 요약"만 뺐다. 그 자리는 가장 관련 높은 조문 원문을 정리해 채운다.
 *
 * 원칙
 *  1) 근거를 못 찾으면 답하지 않는다. 지어내지 않는다.
 *  2) 고장조치는 차종(ABB/우진/로템)에 따라 다르다. 차종을 모르면 **먼저 되묻는다**.
 *  3) 지금 벌어지고 있는 상황이면 설명보다 관제보고가 먼저다.
 *  4) 최종 판단은 규정 원문과 관제 지시 — 답변 말미에 항상 붙인다.
 *  5) **왜 이 답인지 보이게 한다** — 걸린 말을 함께 돌려주어 화면에서 색칠한다.
 */

const AUDIT_ACTION = 'railbot_ask';

type Kind = 'reg' | 'book' | 'case' | 'video' | 'broadcast';

interface Chunk {
  kind: Kind;
  id: string;
  title: string;
  source: string;
  text: string;
  regId?: string;
  article?: number;
  chapter?: string;
  chapterId?: string;
  sectionId?: string;
  /** 영상 — 눌러서 열 주소 */
  url?: string;
  /** 안내방송 — 들려줄 음성 파일 id */
  audioId?: string;
}

/** 인덱스는 요청마다 받지 않는다 — 컨테이너가 살아 있는 동안 재사용 */
let indexCache: { at: number; chunks: Chunk[] } | null = null;
const INDEX_TTL = 30 * 60 * 1000;

/**
 * 사고사례(운전정보)는 DB 에 있고 계속 늘어난다 — 정적 인덱스에 넣을 수 없어 따로 읽어 합친다.
 * 규정이 "무엇을 해야 하는가"라면 사고사례는 "안 지켰을 때 무슨 일이 났는가"다.
 */
async function loadCases(): Promise<Chunk[]> {
  if (!serverSupabase) return [];
  const { data } = await serverSupabase
    .from('hazard_reports')
    .select('id, location, description, tags')
    .eq('category', 'inspect')
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => {
    const title = String(r.description).split('\n')[0].replace(/^\[[^\]]+\]\s*/, '');
    const no = r.location ? `운전정보 ${r.location}` : '사고사례';
    return {
      kind: 'case' as const,
      id: `case-${r.id}`,
      title,
      source: `${no} — ${title}`,
      // 태그를 본문 첫 줄에 얹어 검색어와 걸리게 한다("PSD 미개방" → 승강장안전문·미개방)
      text: `${(r.tags ?? []).join(' ')}\n${r.description}`,
    };
  });
}

/**
 * 영상 가이드 — 글보다 보는 게 빠른 것들이 있다(구원연결·수동운전).
 * 제목과 분류만으로도 "이건 영상이 있다"를 알려줄 수 있다.
 */
async function loadVideos(origin: string): Promise<Chunk[]> {
  try {
    const res = await fetch(`${origin}/data/edu/video-guide.json`, { cache: 'force-cache' });
    if (!res.ok) return [];
    const d = (await res.json()) as {
      categories?: { id: string; label: string }[];
      videos?: { id: string; title: string; category?: string; url?: string }[];
    };
    const label = new Map((d.categories ?? []).map((c) => [c.id, c.label]));
    return (d.videos ?? []).map((v) => {
      const cat = v.category ? label.get(v.category) ?? '' : '';
      return {
        kind: 'video' as const,
        id: `video-${v.id}`,
        title: v.title,
        source: `영상 가이드 — ${v.title}`,
        // 분류를 본문에 얹어 "고장 조치 영상" 같은 질문에도 걸리게 한다
        text: `${v.title} ${cat}`,
        url: v.url,
      };
    });
  } catch {
    return [];
  }
}

/**
 * 안내방송 문안 — 교재 안에 흩어져 있어 지금까지 검색에 잡히지 않았다.
 * 문안은 «그대로 읽어야 하는 글»이라 원문 발췌가 특히 값지다.
 */
async function loadBroadcasts(origin: string): Promise<Chunk[]> {
  try {
    const res = await fetch(`${origin}/data/edu/handbook.json`, { cache: 'force-cache' });
    if (!res.ok) return [];
    const book = (await res.json()) as {
      chapters?: { id: string; title: string; sections?: { id: string; title: string; content?: unknown }[] }[];
    };
    const out: Chunk[] = [];
    for (const ch of book.chapters ?? []) {
      for (const sec of ch.sections ?? []) {
        // 한 절 안에서 audioId 를 가진 블록만 끌어올린다
        const walk = (node: unknown): void => {
          if (Array.isArray(node)) return node.forEach(walk);
          if (!node || typeof node !== 'object') return;
          const o = node as Record<string, unknown>;
          const audioId = typeof o.audioId === 'string' ? o.audioId : null;
          if (audioId) {
            const name = typeof o.term === 'string' ? o.term : sec.title;
            const body = [o.desc, o.text].filter((x) => typeof x === 'string').join('\n');
            if (body.trim()) {
              out.push({
                kind: 'broadcast',
                id: `bc-${audioId}`,
                title: name,
                source: `안내방송 — ${name}`,
                text: `${name}\n${body}`,
                chapterId: ch.id,
                sectionId: sec.id,
                audioId,
              });
            }
          }
          Object.values(o).forEach(walk);
        };
        walk(sec.content);
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function loadIndex(origin: string): Promise<Chunk[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL) return indexCache.chunks;
  const res = await fetch(`${origin}/data/edu/railbot-index.json`, { cache: 'force-cache' });
  if (!res.ok) throw new Error('검색 자료를 불러오지 못했습니다');
  const [base, cases, videos, casts] = await Promise.all([
    res.json() as Promise<Chunk[]>,
    loadCases(),
    loadVideos(origin),
    loadBroadcasts(origin),
  ]);
  const chunks = [...base, ...cases, ...videos, ...casts];
  indexCache = { at: Date.now(), chunks };
  return chunks;
}

/** 공백 제거 — 원문 띄어쓰기가 PDF 추출로 뭉개져 있어 단어 매칭이 성립하지 않는다 */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * 동의어 사전 — LLM 없이 검색 품질을 올리는 유일한 지렛대.
 * 기관사가 쓰는 구어/약어를 규정 원문 용어와 이어준다. 자유롭게 확장 가능.
 * 한 그룹 안의 단어 중 하나라도 질문에 있으면, 나머지를 검색어에 함께 넣는다.
 */
const SYNONYMS: string[][] = [
  ['판토', '팬터', '팬터그래프', 'pantograph'],
  ['psd', '스크린도어', '승강장안전문', '승강장 안전문'],
  ['구원', '구원운전', '구원연결', '구원차'],
  ['제동', '브레이크', '제동장치', '주차제동'],
  ['mcb', '주차단기'],
  ['hscb', '고속도차단기'],
  ['냉방', '에어컨', '공조', '송풍'],
  ['무전', '무전기', '열차무선', '무선'],
  ['비상', '비상시', '긴급', '비상제동'],
  ['입환', '입고', '출고', '기지'],
  ['역행', '역행불능', '무동력', '출력'],
  ['전차선', '가선', '급전', '단전'],
  ['확인운전', '확인 운전', '주의운전'],
  ['탈선', '차량고장', '고장조치'],
  ['방송', '안내방송', '차내방송'],
];

/**
 * 조사·어미 — 질문 끝에 붙어 검색을 망치는 꼬리.
 *
 * 왜 떼야 하는가: 예전에는 질문 전체를 공백 없이 이어 붙인 뒤 2~7글자 조각을 모두
 * 뽑았다. 그러면 «주박할 때 무엇을 확인하나요» 에서 「을확인하」 같은 조각이 생기고,
 * 그 조각은 규정 어디에나 있어 엉뚱한 조문이 1등이 됐다(제40조 도중점검).
 */
const TAIL_RE = /(합니다|하나요|되나요|인가요|입니까|하는지|해야|해요|하고|하는|한다|하나|되는|된다|까요|나요|이나|에서|으로|처럼|보다|부터|까지|이라|라고|은|는|이|가|을|를|에|로|와|과|의|도|만|한|할|해|된|나|요)$/;

function stripTail(token: string): string {
  let t = token;
  for (let i = 0; i < 3; i++) {
    if (t.length <= 2) break;
    const m = TAIL_RE.exec(t);
    if (!m || t.length - m[0].length < 2) break;
    t = t.slice(0, m.index);
  }
  return t;
}

/**
 * 질문에서 «찾을 말» 을 뽑는다 — 낱말 단위라 말을 가로질러 생기는 쓰레기가 없다.
 *   ① 낱말에서 조사·어미를 뗀 것
 *   ② 이웃한 두 낱말을 붙인 것 (판타그라프 + 상승불량)
 *   ③ 긴 낱말의 안쪽 조각 (합성어가 붙어 있는 원문과 걸리게)
 *   ④ 동의어
 */
function queryTerms(question: string): string[] {
  const toks = question.split(/[^0-9A-Za-z가-힣]+/).filter(Boolean);
  const words = toks.map((t) => stripTail(t.toLowerCase())).filter((t) => t.length >= 2);

  const out: string[] = [...words];
  for (let i = 0; i + 1 < words.length; i++) out.push(words[i] + words[i + 1]);
  for (const w of words) {
    for (let len = w.length - 1; len >= 3; len--) {
      for (let i = 0; i + len <= w.length; i++) out.push(w.slice(i, i + len));
    }
  }

  const s = squash(question);
  for (const group of SYNONYMS) {
    if (group.some((t) => s.includes(squash(t)))) out.push(...group.map(squash));
  }
  return [...new Set(out)].filter((t) => t.length >= 2);
}

const VEHICLES = {
  abb: { label: 'ABB', chapterId: 'ch5a', hints: ['abb', '에이비비'] },
  woojin: { label: '우진', chapterId: 'ch5b', hints: ['우진'] },
  rotem: { label: '로템', chapterId: 'ch5c', hints: ['로템', '현대로템'] },
} as const;
type VehicleId = keyof typeof VEHICLES;

/** 차종에 따라 조치가 갈리는 질문인가 */
const FAULT_RE = /고장|조치|불능|안열림|안열려|안됨|안돼|완해|판토|팬터|pan\b|제동|구원|역행|냉방|송풍|mcb|hscb|아크|절연|접지|전차선|비상|기동|출력|무동력|주차제동|스크린도어|psd/i;

function detectVehicle(q: string): VehicleId | null {
  const s = squash(q);
  for (const [id, v] of Object.entries(VEHICLES) as [VehicleId, typeof VEHICLES[VehicleId]][]) {
    if (v.hints.some((h) => s.includes(squash(h)))) return id;
  }
  return null;
}

/** 지금 벌어지고 있는 상황인가 — 설명보다 보고가 먼저다 */
const URGENT_RE = /지금|방금|현재|막\s*지금|났는데|안되는데|안돼요|어떡|어떻게\s*해|급함|긴급/;

/** 자료의 15%가 넘게 가지고 있는 말은 «아무 데나 있는 말» 이라 뜻이 없다 */
const COMMON_RATIO = 0.15;

/**
 * 이만큼도 안 걸리면 답하지 않는다.
 * 두 글자짜리 흔한 말 하나가 우연히 스친 정도(≈18점)는 근거가 아니다.
 */
const MIN_SCORE = 30;

interface Hit {
  c: Chunk;
  score: number;
  /** 이 자료가 질문의 어떤 말 때문에 뽑혔는가 — 화면에서 색칠할 말 */
  terms: string[];
}

/**
 * 근거 검색.
 *
 * 점수 = Σ (말 길이² × 희소도) — 긴 말일수록, 드문 말일수록 값지다.
 * 제목에 있는 말은 두 배 반으로 친다. 제목이 곧 그 조문이 무엇에 대한 것인지이기 때문이다.
 */
function search(chunks: Chunk[], question: string, vehicle: VehicleId | null, limit = 8): Hit[] {
  const terms = queryTerms(question);
  const artNum = /제\s*(\d+)\s*조/.exec(question)?.[1];
  const N = chunks.length;

  const hay = chunks.map((c) => squash(c.text + c.title));
  const head = chunks.map((c) => squash(c.title + c.source));

  // 한 번만 훑으면서 «어느 자료에 어떤 말이 있는지» 와 «그 말이 몇 군데 있는지» 를 함께 센다
  const found: string[][] = chunks.map(() => []);
  const df = new Map<string, number>();
  for (const t of terms) {
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (hay[i].includes(t)) { found[i].push(t); n++; }
    }
    df.set(t, n);
  }
  const useful = new Set(terms.filter((t) => {
    const n = df.get(t) ?? 0;
    return n > 0 && n <= N * COMMON_RATIO;
  }));

  const scored: Hit[] = [];
  for (let i = 0; i < N; i++) {
    const mine = found[i].filter((t) => useful.has(t));
    if (mine.length === 0) continue;
    // 더 긴 말에 포함되는 조각은 버린다 — 같은 일치를 여러 번 세지 않는다
    const maximal = mine.filter((t) => !mine.some((o) => o !== t && o.includes(t)));

    let score = 0;
    for (const t of maximal) {
      const idf = Math.log(N / (df.get(t) as number));
      score += t.length * t.length * idf * (head[i].includes(t) ? 2.5 : 1);
    }
    const c = chunks[i];
    if (artNum && c.article === Number(artNum)) score += 5000;
    // 차종이 정해졌으면 다른 차종 챕터는 강하게 감점 (엉뚱한 차종 조치 방지)
    if (vehicle) {
      const mineCh: string = VEHICLES[vehicle].chapterId;
      const others: string[] = (Object.keys(VEHICLES) as VehicleId[])
        .filter((v) => v !== vehicle)
        .map((v) => VEHICLES[v].chapterId);
      if (c.chapterId === mineCh) score *= 1.6;
      else if (c.chapterId && others.includes(c.chapterId)) score *= 0.15;
    }
    scored.push({ c, score, terms: maximal.sort((a, b) => b.length - a.length) });
  }

  // 같은 점수면 규정·교재가 먼저다 — 영상·방송은 «곁들이는 것» 이지 근거 자체가 아니다
  const rank: Record<Kind, number> = { reg: 0, book: 0, case: 1, broadcast: 2, video: 2 };
  return scored
    .sort((a, b) => b.score - a.score
      || rank[a.c.kind] - rank[b.c.kind]
      || b.terms.length - a.terms.length
      || a.c.text.length - b.c.text.length)   // 그래도 같으면 «좁게 말한 쪽» 이 낫다
    .slice(0, limit);
}

/**
 * 조문/사례 본문을 읽기 좋게 다듬는다 — 발췌만 하고 한 글자도 새로 지어내지 않는다.
 *  - 조문 앞머리 "제N조(제목)"은 출처에 이미 있으니 제거
 *  - PDF 추출로 문장 중간에 끊긴 줄바꿈을 이어붙임
 *  - 항 기호(①②③…)는 줄을 나눠 단계가 보이게
 */
function cleanBody(text: string, kind: Kind): string {
  let t = text;
  if (kind === 'reg') t = t.replace(/^제\s*\d+\s*조\s*(\([^)]*\))?\s*/, '');
  else if (kind === 'case' || kind === 'broadcast') t = t.replace(/^[^\n]*\n/, ''); // 첫 줄은 검색용 이름·태그
  t = t.replace(/【\/?표】/g, ' '); // PDF 표 영역 마커 — 화면엔 군더더기
  t = t.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*/g, '\n$1 ');
  if (t.length > 620) t = `${t.slice(0, 620).trim()} …`;
  return t.trim();
}

/** 글로 읽는 근거 — 답변 본문에 원문을 실어 주는 것들 */
const READABLE: Kind[] = ['reg', 'book', 'case', 'broadcast'];

/** 검색 결과를 발췌형 답변 문자열로 조립한다 (요약이 아니라 원문 정리) */
function buildAnswer(hits: Hit[], vehicle: VehicleId | null): string {
  const readable = hits.filter((h) => READABLE.includes(h.c.kind));
  const top = readable[0] ?? hits[0];
  const render = (c: Chunk) =>
    c.kind === 'case'
      ? `〔비슷한 사례〕\n${cleanBody(c.text, 'case')}`
      : `〔${c.source}〕\n${cleanBody(c.text, c.kind)}`;

  const parts: string[] = [];
  parts.push(vehicle ? `${VEHICLES[vehicle].label} 전동차 기준으로 관련 규정을 찾았어요.` : '관련 규정을 찾았어요.');
  parts.push(render(top.c));

  // 두 번째 근거가 충분히 관련되면 함께 보여준다
  const second = readable[1];
  if (second && second.score >= top.score * 0.45 && second.c.id !== top.c.id) {
    parts.push(`함께 볼 내용이에요.\n${render(second.c)}`);
  }

  // 영상·안내방송은 «읽는 답» 이 아니라 «눌러서 보는 것» — 따로 안내한다
  const shown = new Set([top.c.id, second?.c.id]);
  const videos = hits.filter((h) => h.c.kind === 'video').slice(0, 2);
  const casts = hits.filter((h) => h.c.kind === 'broadcast' && !shown.has(h.c.id)).slice(0, 2);
  if (videos.length || casts.length) {
    const lines = [
      ...videos.map((h) => `· 영상 «${h.c.title}»`),
      ...casts.map((h) => `· 안내방송 «${h.c.title}»`),
    ];
    parts.push(`관련된 영상·방송도 있어요. 아래 근거에서 눌러 보세요.\n${lines.join('\n')}`);
  }

  parts.push('색칠한 말이 이 답을 고른 까닭이에요.');
  parts.push('최종 판단은 규정 원문과 관제 지시를 따르세요.');
  return parts.join('\n\n');
}

export async function POST(req: NextRequest) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes as TokenPayload;

  let body: { question?: string; vehicle?: VehicleId };
  try {
    body = await req.json();
  } catch {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '잘못된 요청입니다');
  }

  const question = (body.question ?? '').trim();
  if (!question) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '무엇이 궁금한지 적어주세요');
  }
  if (question.length > 300) {
    return errorResponse(ERROR_CODES.UNPROCESSABLE, '질문이 너무 길어요. 300자 안으로 줄여주세요');
  }

  // ── 차종 되묻기 — 답하기 전에 ──
  const vehicle = body.vehicle ?? detectVehicle(question);
  if (!vehicle && FAULT_RE.test(question)) {
    return okJson({
      mode: 'need-vehicle',
      message: '조치는 차종마다 다릅니다. 어느 전동차인가요?',
      options: (Object.keys(VEHICLES) as VehicleId[]).map((id) => ({ id, label: VEHICLES[id].label })),
    });
  }

  // ── 근거 검색 ──
  const origin = new URL(req.url).origin;
  let hits: Hit[];
  try {
    hits = search(await loadIndex(origin), question, vehicle);
  } catch {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '규정 자료를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  // 스치듯 걸린 한 마디로 답하지 않는다 — 「오늘 점심 뭐 먹지」 에 규정을 들이밀던 것
  if (hits.length > 0 && hits[0].score < MIN_SCORE) hits = [];

  if (hits.length === 0) {
    return okJson({
      mode: 'no-evidence',
      message: '규정·교재에서 관련 내용을 찾지 못했어요. 다른 말로 물어보시거나, 규정 화면에서 직접 찾아보세요.',
      sources: [],
      terms: [],
    });
  }

  const urgent = URGENT_RE.test(question);
  const answer = buildAnswer(hits, vehicle);

  await auditLog(user.sub, user.name, AUDIT_ACTION, {
    metadata: { q: question.slice(0, 120), vehicle: vehicle ?? null, hits: hits.length },
    ip: getClientIP(req),
  });

  return okJson({
    mode: 'answer',
    urgent,
    vehicle: vehicle ? VEHICLES[vehicle].label : null,
    answer,
    // 화면에서 색칠할 말 — 답변에 실린 근거들이 걸린 이유
    terms: [...new Set(hits.slice(0, 3).flatMap((h) => h.terms))].slice(0, 12),
    sources: hits.map(({ c, terms }) => ({
      label: c.source,
      kind: c.kind,
      regId: c.regId ?? null,
      article: c.article ?? null,
      // 교재(book)는 규정처럼 원문으로 점프하려면 handbook.json 의 장/절 id 가 필요하다
      chapterId: c.chapterId ?? null,
      sectionId: c.sectionId ?? null,
      url: c.url ?? null,
      audioId: c.audioId ?? null,
      // 이 근거가 걸린 말 — 배지를 눌렀을 때 무엇 때문인지 알 수 있게
      terms: terms.slice(0, 4),
    })),
  });
}
