-- 멀티플레이(오목/윷놀이) 결과 로그 + Elo 레이팅 테이블

-- 1) 게임 결과 로그
CREATE TABLE IF NOT EXISTS multi_game_results (
  id BIGSERIAL PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('omok', 'yutnori')),
  winner_sabun TEXT NOT NULL,
  winner_name TEXT NOT NULL,
  loser_sabun TEXT NOT NULL,
  loser_name TEXT NOT NULL,
  winner_rating_before INTEGER NOT NULL,
  loser_rating_before INTEGER NOT NULL,
  winner_rating_after INTEGER NOT NULL,
  loser_rating_after INTEGER NOT NULL,
  rating_delta INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multi_results_game_time
  ON multi_game_results (game, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_multi_results_winner
  ON multi_game_results (winner_sabun, created_at DESC);

-- 2) 사용자별 게임별 현재 레이팅
CREATE TABLE IF NOT EXISTS multi_game_ratings (
  sabun TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('omok', 'yutnori')),
  name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1200,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (sabun, game)
);

CREATE INDEX IF NOT EXISTS idx_multi_ratings_ranking
  ON multi_game_ratings (game, rating DESC);
