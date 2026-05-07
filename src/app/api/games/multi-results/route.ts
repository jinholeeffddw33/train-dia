import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

const VALID_GAMES = ['omok', 'yutnori'] as const;
const DEFAULT_RATING = 1200;
const K_FACTOR = 32;

function expectedScore(myRating: number, oppRating: number): number {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

/** POST: 게임 결과 저장 + Elo 레이팅 갱신 (host만 호출) */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: '서비스 준비 중' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  let body: { game?: string; opponentSabun?: string; opponentName?: string; isWinner?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청' }, { status: 400 });
  }

  const game = body.game?.trim();
  const opponentSabun = body.opponentSabun?.trim();
  const opponentName = body.opponentName?.trim();
  const isWinner = body.isWinner;

  if (!game || !VALID_GAMES.includes(game as typeof VALID_GAMES[number])) {
    return NextResponse.json({ code: 'INVALID_GAME', message: '올바른 게임 종류' }, { status: 400 });
  }
  if (!opponentSabun || !opponentName || typeof isWinner !== 'boolean') {
    return NextResponse.json({ code: 'INVALID_BODY', message: '필수 필드 누락' }, { status: 400 });
  }
  if (opponentSabun === user.sabun) {
    return NextResponse.json({ code: 'SAME_USER', message: '자기 자신과 대전 불가' }, { status: 400 });
  }

  // 1) 두 사람 현재 레이팅 조회
  const { data: ratings, error: rErr } = await serverSupabase
    .from('multi_game_ratings')
    .select('sabun, name, rating, wins, losses')
    .in('sabun', [user.sabun, opponentSabun])
    .eq('game', game);

  if (rErr) {
    console.error('multi rating fetch error:', rErr.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '레이팅 조회 실패' }, { status: 500 });
  }

  const myRow = ratings?.find((r) => r.sabun === user.sabun);
  const oppRow = ratings?.find((r) => r.sabun === opponentSabun);
  const myRating = myRow?.rating ?? DEFAULT_RATING;
  const oppRating = oppRow?.rating ?? DEFAULT_RATING;

  // 2) Elo 계산
  const myExpected = expectedScore(myRating, oppRating);
  const oppExpected = 1 - myExpected;
  const myActual = isWinner ? 1 : 0;
  const oppActual = isWinner ? 0 : 1;
  const newMyRating = Math.round(myRating + K_FACTOR * (myActual - myExpected));
  const newOppRating = Math.round(oppRating + K_FACTOR * (oppActual - oppExpected));
  const myDelta = newMyRating - myRating;

  // 3) 60초 내 동일 매치업 중복 방지 (host/guest 동시 POST 대응)
  const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
  const winnerSabun = isWinner ? user.sabun : opponentSabun;
  const loserSabun = isWinner ? opponentSabun : user.sabun;

  const { data: dup } = await serverSupabase
    .from('multi_game_results')
    .select('id')
    .eq('game', game)
    .eq('winner_sabun', winnerSabun)
    .eq('loser_sabun', loserSabun)
    .gte('created_at', sixtySecAgo)
    .limit(1);

  if (dup && dup.length > 0) {
    return NextResponse.json({ duplicate: true, myRating, myDelta: 0 });
  }

  // 4) 결과 + 레이팅 갱신
  const winnerName = isWinner ? user.name : opponentName;
  const loserName = isWinner ? opponentName : user.name;
  const winnerRatingBefore = isWinner ? myRating : oppRating;
  const loserRatingBefore = isWinner ? oppRating : myRating;
  const winnerRatingAfter = isWinner ? newMyRating : newOppRating;
  const loserRatingAfter = isWinner ? newOppRating : newMyRating;

  const { error: insErr } = await serverSupabase.from('multi_game_results').insert({
    game,
    winner_sabun: winnerSabun,
    winner_name: winnerName,
    loser_sabun: loserSabun,
    loser_name: loserName,
    winner_rating_before: winnerRatingBefore,
    loser_rating_before: loserRatingBefore,
    winner_rating_after: winnerRatingAfter,
    loser_rating_after: loserRatingAfter,
    rating_delta: Math.abs(winnerRatingAfter - winnerRatingBefore),
  });

  if (insErr) {
    console.error('multi result insert error:', insErr.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '결과 저장 실패' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await serverSupabase.from('multi_game_ratings').upsert([
    {
      sabun: user.sabun,
      game,
      name: user.name,
      rating: newMyRating,
      wins: (myRow?.wins ?? 0) + (isWinner ? 1 : 0),
      losses: (myRow?.losses ?? 0) + (isWinner ? 0 : 1),
      last_played_at: nowIso,
    },
    {
      sabun: opponentSabun,
      game,
      name: opponentName,
      rating: newOppRating,
      wins: (oppRow?.wins ?? 0) + (isWinner ? 0 : 1),
      losses: (oppRow?.losses ?? 0) + (isWinner ? 1 : 0),
      last_played_at: nowIso,
    },
  ]);

  if (upErr) {
    console.error('multi rating upsert error:', upErr.message);
    return NextResponse.json({ code: 'DB_ERROR', message: '레이팅 갱신 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true, myRating: newMyRating, myDelta });
}
