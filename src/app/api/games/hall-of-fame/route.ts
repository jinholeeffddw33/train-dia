import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { settleAndResetPastMonths } from '@/lib/games/monthlyReset';

export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: '서비스 준비 중' }, { status: 503 });
  }
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  await settleAndResetPastMonths();

  const { data, error } = await serverSupabase
    .from('game_hall_of_fame')
    .select('game, year, month, rank, sabun, name, score, wins, losses')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .order('game', { ascending: true })
    .order('rank', { ascending: true });

  if (error) {
    console.error('hall-of-fame fetch error:', error.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '명예의 전당 조회 실패' }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [], myRecords: (data ?? []).filter((r) => r.sabun === user.sabun) });
}
