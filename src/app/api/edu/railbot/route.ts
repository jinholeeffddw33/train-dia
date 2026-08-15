import { NextRequest, NextResponse } from 'next/server';
import { ERROR_CODES, errorResponse, okJson } from '@/lib/api/response';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { getTodayStartKST } from '@/lib/visitStats';
import type { TokenPayload } from '@/lib/jwt';

/**
 * 레일봇 — 규정·교재 근거 검색 답변.
 *
 * 원칙 (안전 자료라 지키지 않으면 안 쓰느니만 못하다)
 *  1) 근거가 없으면 답하지 않는다. 지어내지 않는다.
 *  2) 고장조치는 차종(ABB/우진/로템)에 따라 다르다. 차종을 모르면 **먼저 되묻는다**.
 *  3) 지금 벌어지고 있는 상황이면 설명보다 관제보고가 먼저다.
 *  4) 최종 판단은 규정 원문과 관제 지시 — 답변 말미에 항상 붙인다.
 */

const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

/** 하루 질문 한도 (사용자당) */
const DAILY_LIMIT = 30;
const AUDIT_ACTION = 'railbot_ask';

interface Chunk {
  kind: 'reg' | 'book';
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

async function loadIndex(origin: string): Promise<Chunk[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL) return indexCache.chunks;
  const res = await fetch(`${origin}/data/edu/railbot-index.json`, { cache: 'force-cache' });
  if (!res.ok) throw new Error('검색 자료를 불러오지 못했습니다');
  const chunks = (await res.json()) as Chunk[];
  indexCache = { at: Date.now(), chunks };
  return chunks;
}

/** 공백 제거 — 원문 띄어쓰기가 PDF 추출로 뭉개져 있어 단어 매칭이 성립하지 않는다 */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

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
      out.push({ g, w: len * len });   // 길이 제곱 가중 — 긴 일치가 훨씬 값지다
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

function search(chunks: Chunk[], question: string, vehicle: VehicleId | null, limit = 6): Chunk[] {
  const gs = grams(question);
  // 제N조 직접 지목 시 강한 가산
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
        .filter((v) => v !== vehicle).map((v) => VEHICLES[v].chapterId);
      if (c.chapterId === mine) score *= 1.6;
      else if (c.chapterId && others.includes(c.chapterId)) score *= 0.15;
    }
    return { c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c);
}

const SYSTEM = `너는 서울교통공사 5호선 답십리승무사업소 기관사를 돕는 '레일봇'이다.

절대 규칙
1. 주어진 【근거】 안에 있는 내용만으로 답한다. 근거에 없으면 "제공된 규정·교재에서 근거를 찾지 못했습니다"라고 말하고 추측하지 않는다.
2. 조치 절차를 안내할 때는 근거에 적힌 순서를 그대로 지킨다. 순서를 바꾸거나 임의로 합치지 않는다.
3. 답변에 사용한 근거를 반드시 밝힌다. 【근거】 항목의 '출처' 문자열을 그대로 인용한다.
4. 답변 마지막 줄은 항상: "최종 판단은 규정 원문과 관제 지시를 따르세요."

말투
- 상대는 50~60대 현직 기관사다. 존대하되 군더더기 없이 짧게.
- 전문용어는 그대로 쓴다(풀어쓰지 않는다). 열차번호·조문번호·시각은 정확히.
- 3~6문장 또는 번호 목록. 길게 늘어놓지 않는다.`;

export async function POST(req: NextRequest) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes as TokenPayload;

  if (!anthropic) {
    return errorResponse('AI_DISABLED', '레일봇이 아직 켜져 있지 않아요. 관리자에게 알려주세요.', 503);
  }

  let body: { question?: string; vehicle?: VehicleId };
  try { body = await req.json(); } catch {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '잘못된 요청입니다');
  }

  const question = (body.question ?? '').trim();
  if (!question) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '무엇이 궁금한지 적어주세요');
  }
  if (question.length > 300) {
    return errorResponse(ERROR_CODES.UNPROCESSABLE, '질문이 너무 길어요. 300자 안으로 줄여주세요');
  }

  // ── 하루 한도 (audit_log 재사용 — 별도 테이블 없이) ──
  if (serverSupabase) {
    const { count } = await serverSupabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.sub)
      .eq('action', AUDIT_ACTION)
      .gte('created_at', getTodayStartKST());
    if ((count ?? 0) >= DAILY_LIMIT) {
      return errorResponse(ERROR_CODES.RATE_LIMITED, `오늘 질문 한도(${DAILY_LIMIT}개)를 다 쓰셨어요. 내일 다시 물어봐 주세요.`);
    }
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
  let hits: Chunk[];
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
  const evidence = hits
    .map((c, i) => `[${i + 1}] 출처: ${c.source}\n${c.text.slice(0, 1200)}`)
    .join('\n\n');

  let answer: string;
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `【질문】\n${question}${vehicle ? `\n(차종: ${VEHICLES[vehicle].label} 전동차)` : ''}\n\n【근거】\n${evidence}`,
      }],
    });
    answer = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n').trim();
  } catch {
    return errorResponse(ERROR_CODES.UPSTREAM_ERROR, '답변을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  await auditLog(user.sub, user.name, AUDIT_ACTION, {
    metadata: { q: question.slice(0, 120), vehicle: vehicle ?? null, hits: hits.length },
    ip: getClientIP(req),
  });

  return okJson({
    mode: 'answer',
    urgent,
    vehicle: vehicle ? VEHICLES[vehicle].label : null,
    answer,
    sources: hits.map((c) => ({
      label: c.source,
      kind: c.kind,
      regId: c.regId ?? null,
      article: c.article ?? null,
      sectionId: c.sectionId ?? null,
    })),
  });
}
