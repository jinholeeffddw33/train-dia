import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

const VALID_GAMES = ['snake', 'reaction', 'mental', 'simon', 'halli', 'apex'] as const;

// 게임별 점수 상한 — 클라이언트 점수 위조 방어(안티치트). APEX 는 3D 실시간이라 위조가 쉬워 상한 필수.
//   APEX 이론 최대 ≈ 거리 10만m × 150/m = 1500만이지만, 현실 상위 플레이는 수십만 → 500만으로 넉넉히 차단.
const SCORE_CAP: Record<string, number> = { apex: 5_000_000 };

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
  const cap = SCORE_CAP[game];
  if (typeof score !== 'number' || score < 0 || !Number.isFinite(score) || (cap !== undefined && score > cap)) {
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
