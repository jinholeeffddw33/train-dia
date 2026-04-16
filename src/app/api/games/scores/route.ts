import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

const VALID_GAMES = ['snake', 'reaction', 'mental', 'simon'] as const;

/** POST: 점수 저장 */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: '서비스 준비 중' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  let body: { game?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청' }, { status: 400 });
  }

  const game = body.game?.trim();
  const score = body.score;

  if (!game || !VALID_GAMES.includes(game as typeof VALID_GAMES[number])) {
    return NextResponse.json({ code: 'INVALID_GAME', message: '올바른 게임 종류를 선택하세요' }, { status: 400 });
  }
  if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
    return NextResponse.json({ code: 'INVALID_SCORE', message: '올바른 점수를 입력하세요' }, { status: 400 });
  }

  const { error } = await serverSupabase.from('game_scores').insert({
    sabun: user.sabun,
    name: user.name,
    game,
    score,
  });

  if (error) {
    console.error('game_scores insert error:', error.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '점수 저장에 실패했어요' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
