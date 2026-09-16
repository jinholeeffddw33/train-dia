import { NextRequest, NextResponse } from 'next/server';
import { ERROR_CODES, errorResponse, okJson } from '@/lib/api/response';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import type { TokenPayload } from '@/lib/jwt';
import {
  search,
  squash,
  VEHICLES,
  MIN_SCORE,
  type Chunk,
  type Kind,
  type Hit,
  type VehicleId,
} from '@/lib/railbotSearch';

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
