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
 */

const AUDIT_ACTION = 'railbot_ask';

interface Chunk {
  kind: 'reg' | 'book' | 'case';
  id: string;
  title: string;
  source: string;
  text: string;
  regId?: string;
  article?: number;
  chapter?: string;
  chapterId?: string;
  sectionId?: string;
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

async function loadIndex(origin: string): Promise<Chunk[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL) return indexCache.chunks;
  const res = await fetch(`${origin}/data/edu/railbot-index.json`, { cache: 'force-cache' });
  if (!res.ok) throw new Error('검색 자료를 불러오지 못했습니다');
  const chunks = [...((await res.json()) as Chunk[]), ...(await loadCases())];
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

/** 질문에 동의어가 있으면 검색어를 확장한다 */
function expandQuery(q: string): string {
  const s = squash(q);
  const extra: string[] = [];
  for (const group of SYNONYMS) {
    if (group.some((t) => s.includes(squash(t)))) extra.push(...group);
  }
  return extra.length ? `${q} ${extra.join(' ')}` : q;
}

/** 질의에서 2~7글자 조각을 뽑는다. 긴 조각일수록 가중치가 크다. */
function grams(q: string): { g: string; w: number }[] {
  const s = squash(q).replace(/[?!.,·()[\]"'~]/g, '');
  const out: { g: string; w: number }[] = [];
  const seen = new Set<string>();
  for (let len = 7; len >= 2; len--) {
    for (let i = 0; i + len <= s.length; i++) {
      const g = s.slice(i, i + len);
      if (seen.has(g)) continue;
      seen.add(g);
      out.push({ g, w: len * len }); // 길이 제곱 가중 — 긴 일치가 훨씬 값지다
    }
  }
  return out;
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

/** 근거 검색 — 점수와 함께 반환한다(발췌 답변 구성에 점수가 필요) */
function search(chunks: Chunk[], question: string, vehicle: VehicleId | null, limit = 6): { c: Chunk; score: number }[] {
  const gs = grams(expandQuery(question));
  const artNum = /제\s*(\d+)\s*조/.exec(question)?.[1];

  const scored = chunks.map((c) => {
    const hay = squash(c.text + c.title);
    let score = 0;
    for (const { g, w } of gs) if (hay.includes(g)) score += w;
    if (artNum && c.article === Number(artNum)) score += 5000;
    // 차종이 정해졌으면 다른 차종 챕터는 강하게 감점 (엉뚱한 차종 조치 방지)
    if (vehicle) {
      const mine: string = VEHICLES[vehicle].chapterId;
      const others: string[] = (Object.keys(VEHICLES) as VehicleId[])
        .filter((v) => v !== vehicle)
        .map((v) => VEHICLES[v].chapterId);
      if (c.chapterId === mine) score *= 1.6;
      else if (c.chapterId && others.includes(c.chapterId)) score *= 0.15;
    }
    return { c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 조문/사례 본문을 읽기 좋게 다듬는다 — 발췌만 하고 한 글자도 새로 지어내지 않는다.
 *  - 조문 앞머리 "제N조(제목)"은 출처에 이미 있으니 제거
 *  - PDF 추출로 문장 중간에 끊긴 줄바꿈을 이어붙임
 *  - 항 기호(①②③…)는 줄을 나눠 단계가 보이게
 */
function cleanBody(text: string, kind: 'reg' | 'case'): string {
  let t = text;
  if (kind === 'reg') t = t.replace(/^제\s*\d+\s*조\s*(\([^)]*\))?\s*/, '');
  else t = t.replace(/^[^\n]*\n/, ''); // 사례: 첫 줄(태그)은 검색용이라 표시에서 뺀다
  t = t.replace(/【\/?표】/g, ' '); // PDF 표 영역 마커 — 화면엔 군더더기
  t = t.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*/g, '\n$1 ');
  if (t.length > 620) t = `${t.slice(0, 620).trim()} …`;
  return t.trim();
}

/** 검색 결과를 발췌형 답변 문자열로 조립한다 (요약이 아니라 원문 정리) */
function buildAnswer(scored: { c: Chunk; score: number }[], vehicle: VehicleId | null): string {
  const top = scored[0];
  const render = (c: Chunk) =>
    c.kind === 'case'
      ? `〔비슷한 사례〕\n${cleanBody(c.text, 'case')}`
      : `〔${c.source}〕\n${cleanBody(c.text, 'reg')}`;

  const parts: string[] = [];
  parts.push(vehicle ? `${VEHICLES[vehicle].label} 전동차 기준으로 관련 규정을 찾았어요.` : '관련 규정을 찾았어요.');
  parts.push(render(top.c));

  // 두 번째 근거가 충분히 관련되면 함께 보여준다
  const second = scored[1];
  if (second && second.score >= top.score * 0.45 && second.c.id !== top.c.id) {
    parts.push(`함께 볼 내용이에요.\n${render(second.c)}`);
  }

  parts.push('정확한 절차는 아래 ‘근거’를 눌러 원문에서 확인하세요.');
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
  let hits: { c: Chunk; score: number }[];
  try {
    hits = search(await loadIndex(origin), question, vehicle);
  } catch {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '규정 자료를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  if (hits.length === 0) {
    return okJson({
      mode: 'no-evidence',
      message: '규정·교재에서 관련 내용을 찾지 못했어요. 다른 말로 물어보시거나, 규정 화면에서 직접 찾아보세요.',
      sources: [],
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
    sources: hits.map(({ c }) => ({
      label: c.source,
      kind: c.kind,
      regId: c.regId ?? null,
      article: c.article ?? null,
      // 교재(book)는 규정처럼 원문으로 점프하려면 handbook.json 의 장/절 id 가 필요하다
      chapterId: c.chapterId ?? null,
      sectionId: c.sectionId ?? null,
    })),
  });
}
