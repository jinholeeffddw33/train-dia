/**
 * 교육 시험 점수를 서버에도 남긴다 (진호 2026-10-09).
 * 지금까지는 각자 폰(localStorage)에만 있어 관리자가 볼 수 없고, 폰을 바꾸면 사라졌다.
 *
 * POST { results: [{ mode, chapterId?, score, total, percent, solvedAt }] } — 한 건(시험 끝날 때) 또는
 * 여러 건(그 폰에 쌓여 있던 지난 기록을 처음 한 번 올릴 때). 같은 시험(사번·푼 시각·방식)은 하나로 둔다.
 * 사번·이름은 세션에서만 받는다 — 본문으로 받으면 남의 이름으로 점수를 넣을 수 있다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, parseBody, ERROR_CODES } from '@/lib/api/response';

const Result = z.object({
  mode: z.string().min(1).max(20),
  chapterId: z.string().max(60).optional(),
  score: z.number().int().min(0).max(2000),
  total: z.number().int().min(1).max(2000),
  percent: z.number().int().min(0).max(100),
  solvedAt: z.string().datetime({ offset: true }),
});
const Body = z.object({ results: z.array(Result).min(1).max(500) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!serverSupabase) return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 저장할 수 없어요');
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;

  const rows = parsed.data.results.map((r) => ({
    sabun: auth.sabun, name: auth.name, mode: r.mode, chapter_id: r.chapterId ?? null,
    score: r.score, total: r.total, percent: r.percent, solved_at: r.solvedAt,
  }));
  const { error } = await serverSupabase.from('edu_quiz_results')
    .upsert(rows, { onConflict: 'sabun,solved_at,mode', ignoreDuplicates: true });
  if (error) return internalError(error, 'edu/quiz-results POST', '점수를 저장하지 못했어요');
  return okJson();
}
