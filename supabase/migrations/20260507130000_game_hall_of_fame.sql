-- 명예의 전당: 월별 게임별 1·2·3등 영구 보존
-- 싱글 게임(snake/reaction/mental/simon/halli)은 score, 멀티 게임(omok/yutnori)은 wins/losses

CREATE TABLE IF NOT EXISTS game_hall_of_fame (
  id BIGSERIAL PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('snake', 'reaction', 'mental', 'simon', 'halli', 'omok', 'yutnori')),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  rank INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
  sabun TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER,
  wins INTEGER,
  losses INTEGER,
  finalized_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (game, year, month, rank)
);

CREATE INDEX IF NOT EXISTS idx_hall_of_fame_lookup
  ON game_hall_of_fame (year DESC, month DESC, game);
