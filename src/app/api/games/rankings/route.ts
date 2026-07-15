import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { settleAndResetPastMonths } from '@/lib/games/monthlyReset';

/** 노출 순위 개수 — ?limit 미지정 시 기본값. APEX RUSH 는 30 등까지 요청한다. */
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 100;

/** GET: 랭킹 조회 — ?game=snake&period=all|month&limit=30 */
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: '서비스 준비 중' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  await settleAndResetPastMonths();

  const { searchParams } = new URL(req.url);
  const game = searchParams.get('game') ?? 'snake';
  const period = searchParams.get('period') ?? 'all';
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.trunc(limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // 기간 필터
  let dateFilter: string | null = null;
  if (period === 'month') {
    const now = new Date();
    dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  // 각 유저 최고점만 (중복 제거를 위해 서브쿼리 대신 전체 조회 후 JS에서 처리)
  // reaction은 낮을수록 좋음 (ASC), snake는 높을수록 좋음 (DESC)
  //
  // ⚠️ 이 limit 은 '사람' 이 아니라 '점수 행' 기준이다. 한 사람이 여러 기록을 남기므로
  //    중복 제거 후 남는 인원은 이보다 적다 → 요청한 순위 수의 20배를 넉넉히 가져온다.
  //    (limit 만큼만 가져오면 상위권 한 명이 행을 여러 개 차지해 순위가 모자란다)
  const isReaction = game === 'reaction';
  const rowLimit = Math.min(1000, Math.max(100, limit * 20));
  let query = serverSupabase
    .from('game_scores')
    .select('sabun, name, score, created_at')
    .eq('game', game)
    .order('score', { ascending: isReaction })
    .limit(rowLimit);

  if (dateFilter) {
    query = query.gte('created_at', dateFilter);
  }

  const { data: rawScores, error } = await query;

  if (error) {
    console.error('rankings query error:', error.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '랭킹 조회 실패' }, { status: 500 });
  }

  // 유저별 최고점 추출 (reaction: 최소값, snake: 최대값)
  const bestByUser = new Map<string, { sabun: string; name: string; score: number; created_at: string }>();
  for (const row of rawScores ?? []) {
    const existing = bestByUser.get(row.sabun);
    const isBetter = isReaction
      ? (!existing || row.score < existing.score)
      : (!existing || row.score > existing.score);
    if (isBetter) {
      bestByUser.set(row.sabun, row);
    }
  }

  // 정렬 (reaction: 오름차순, snake: 내림차순)
  const ranked = [...bestByUser.values()].sort((a, b) =>
    isReaction ? a.score - b.score : b.score - a.score,
  );

  const top = ranked.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    isMe: r.sabun === user.sabun,
  }));

  // 내 순위
  const myIdx = ranked.findIndex((r) => r.sabun === user.sabun);
  const myRank = myIdx >= 0 ? {
    rank: myIdx + 1,
    score: ranked[myIdx].score,
    total: ranked.length,
  } : null;

  return NextResponse.json({
    top,
    myRank,
    totalPlayers: ranked.length,
  });
}
