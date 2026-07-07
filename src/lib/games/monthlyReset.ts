import { serverSupabase } from '@/lib/serverSupabase';

const SINGLE_GAMES = ['snake', 'reaction', 'mental', 'simon', 'halli', 'apex'] as const;
const MULTI_GAMES = ['omok', 'reversi'] as const;

type SingleGame = typeof SINGLE_GAMES[number];
type MultiGame = typeof MULTI_GAMES[number];

const REACTION_GAMES = new Set<SingleGame>(['reaction']);

interface SettledKey { game: string; year: number; month: number }

/**
 * 매월 1일 첫 호출 시 자동 실행:
 *   1) 지난달 1·2·3등 → game_hall_of_fame 영구 보존
 *   2) 지난달 game_scores / multi_game_results 삭제
 *   3) 멀티 settle이 1건이라도 있었으면 multi_game_ratings 전체 초기화
 */
export async function settleAndResetPastMonths(): Promise<void> {
  if (!serverSupabase) return;

  const { data: settledRows } = await serverSupabase
    .from('game_hall_of_fame')
    .select('game, year, month');

  const settled = new Set(
    ((settledRows ?? []) as SettledKey[]).map((r) => `${r.game}-${r.year}-${r.month}`),
  );

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let multiSettlementHappened = false;

  for (const game of SINGLE_GAMES) {
    const months = await listMonthsForSingle(game, currentMonthStart);
    for (const { year, month } of months) {
      if (settled.has(`${game}-${year}-${month}`)) continue;
      await settleSingleGame(game, year, month);
      await deleteSingleMonth(game, year, month);
    }
  }

  for (const game of MULTI_GAMES) {
    const months = await listMonthsForMulti(game, currentMonthStart);
    for (const { year, month } of months) {
      if (settled.has(`${game}-${year}-${month}`)) continue;
      await settleMultiGame(game, year, month);
      await deleteMultiMonth(game, year, month);
      multiSettlementHappened = true;
    }
  }

  if (multiSettlementHappened) {
    await serverSupabase.from('multi_game_ratings').delete().neq('sabun', '__never__');
  }
}

async function listMonthsForSingle(game: SingleGame, currentMonthStart: string) {
  if (!serverSupabase) return [];
  const { data } = await serverSupabase
    .from('game_scores')
    .select('created_at')
    .eq('game', game)
    .lt('created_at', currentMonthStart);
  return uniqueMonths(data ?? []);
}

async function listMonthsForMulti(game: MultiGame, currentMonthStart: string) {
  if (!serverSupabase) return [];
  const { data } = await serverSupabase
    .from('multi_game_results')
    .select('created_at')
    .eq('game', game)
    .lt('created_at', currentMonthStart);
  return uniqueMonths(data ?? []);
}

function uniqueMonths(rows: { created_at: string }[]): { year: number; month: number }[] {
  const set = new Set<string>();
  for (const row of rows) {
    const d = new Date(row.created_at);
    set.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
  }
  return [...set].map((s) => {
    const [year, month] = s.split('-').map(Number);
    return { year, month };
  });
}

async function settleSingleGame(game: SingleGame, year: number, month: number) {
  if (!serverSupabase) return;
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  const isReaction = REACTION_GAMES.has(game);

  const { data } = await serverSupabase
    .from('game_scores')
    .select('sabun, name, score')
    .eq('game', game)
    .gte('created_at', start)
    .lt('created_at', end);

  const best = new Map<string, { sabun: string; name: string; score: number }>();
  for (const row of data ?? []) {
    const cur = best.get(row.sabun);
    const better = isReaction ? (!cur || row.score < cur.score) : (!cur || row.score > cur.score);
    if (better) best.set(row.sabun, row as { sabun: string; name: string; score: number });
  }

  const ranked = [...best.values()].sort((a, b) =>
    isReaction ? a.score - b.score : b.score - a.score,
  );
  const top3 = ranked.slice(0, 3);
  if (top3.length === 0) return;

  const inserts = top3.map((r, i) => ({
    game,
    year,
    month,
    rank: i + 1,
    sabun: r.sabun,
    name: r.name,
    score: r.score,
    wins: null,
    losses: null,
  }));

  await serverSupabase
    .from('game_hall_of_fame')
    .upsert(inserts, { onConflict: 'game,year,month,rank', ignoreDuplicates: true });
}

async function settleMultiGame(game: MultiGame, year: number, month: number) {
  if (!serverSupabase) return;
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const { data } = await serverSupabase
    .from('multi_game_results')
    .select('winner_sabun, winner_name, loser_sabun, loser_name')
    .eq('game', game)
    .gte('created_at', start)
    .lt('created_at', end);

  type Stat = { sabun: string; name: string; wins: number; losses: number };
  const stats = new Map<string, Stat>();
  for (const row of data ?? []) {
    const w = stats.get(row.winner_sabun) ?? { sabun: row.winner_sabun, name: row.winner_name, wins: 0, losses: 0 };
    w.wins += 1;
    w.name = row.winner_name;
    stats.set(row.winner_sabun, w);

    const l = stats.get(row.loser_sabun) ?? { sabun: row.loser_sabun, name: row.loser_name, wins: 0, losses: 0 };
    l.losses += 1;
    l.name = row.loser_name;
    stats.set(row.loser_sabun, l);
  }

  const ranked = [...stats.values()]
    .filter((s) => s.wins > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return (a.wins + a.losses) - (b.wins + b.losses);
    });
  const top3 = ranked.slice(0, 3);
  if (top3.length === 0) return;

  const inserts = top3.map((r, i) => ({
    game,
    year,
    month,
    rank: i + 1,
    sabun: r.sabun,
    name: r.name,
    score: null,
    wins: r.wins,
    losses: r.losses,
  }));

  await serverSupabase
    .from('game_hall_of_fame')
    .upsert(inserts, { onConflict: 'game,year,month,rank', ignoreDuplicates: true });
}

async function deleteSingleMonth(game: SingleGame, year: number, month: number) {
  if (!serverSupabase) return;
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  await serverSupabase
    .from('game_scores')
    .delete()
    .eq('game', game)
    .gte('created_at', start)
    .lt('created_at', end);
}

async function deleteMultiMonth(game: MultiGame, year: number, month: number) {
  if (!serverSupabase) return;
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  await serverSupabase
    .from('multi_game_results')
    .delete()
    .eq('game', game)
    .gte('created_at', start)
    .lt('created_at', end);
}
