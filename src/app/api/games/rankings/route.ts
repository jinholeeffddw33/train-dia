import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

/** GET: 랭킹 조회 — ?game=snake&period=all|month */
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: '서비스 준비 중' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const game = searchParams.get('game') ?? 'snake';
  const period = searchParams.get('period') ?? 'all';

  // 기간 필터
  let dateFilter: string | null = null;
  if (period === 'month') {
    const now = new Date();
    dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  // 탑 5 — 각 유저 최고점만 (중복 제거를 위해 서브쿼리 대신 전체 조회 후 JS에서 처리)
  // reaction은 낮을수록 좋음 (ASC), snake는 높을수록 좋음 (DESC)
  const isReaction = game === 'reaction';
  let query = serverSupabase
    .from('game_scores')
    .select('sabun, name, score, created_at')
    .eq('game', game)
    .order('score', { ascending: isReaction })
    .limit(100);

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

  // 탑 5
  const top5 = ranked.slice(0, 5).map((r, i) => ({
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
    top5,
    myRank,
    totalPlayers: ranked.length,
  });
}
