import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { settleAndResetPastMonths } from '@/lib/games/monthlyReset';

const VALID_GAMES = ['omok', 'reversi'] as const;

/** GET: 멀티 게임 랭킹 — ?game=omok|reversi */
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
  const game = searchParams.get('game') ?? 'omok';
  if (!VALID_GAMES.includes(game as typeof VALID_GAMES[number])) {
    return NextResponse.json({ code: 'INVALID_GAME', message: '올바른 게임 종류' }, { status: 400 });
  }

  const { data, error } = await serverSupabase
    .from('multi_game_ratings')
    .select('sabun, name, rating, wins, losses')
    .eq('game', game)
    .order('rating', { ascending: false })
    .limit(100);

  if (error) {
    console.error('multi rankings fetch error:', error.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '랭킹 조회 실패' }, { status: 500 });
  }

  const all = data ?? [];

  const top15 = all.slice(0, 15).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    rating: r.rating,
    wins: r.wins,
    losses: r.losses,
    isMe: r.sabun === user.sabun,
  }));

  const myIdx = all.findIndex((r) => r.sabun === user.sabun);
  const myRank = myIdx >= 0 ? {
    rank: myIdx + 1,
    rating: all[myIdx].rating,
    wins: all[myIdx].wins,
    losses: all[myIdx].losses,
    total: all.length,
  } : null;

  return NextResponse.json({ top15, myRank, totalPlayers: all.length });
}
