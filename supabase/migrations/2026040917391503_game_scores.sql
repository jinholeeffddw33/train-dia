-- 미니 게임 점수 랭킹 테이블
CREATE TABLE IF NOT EXISTS game_scores (
  id BIGSERIAL PRIMARY KEY,
  sabun TEXT NOT NULL,
  name TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('snake', 'reaction')),
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스: 게임별 랭킹 조회 최적화
CREATE INDEX IF NOT EXISTS idx_game_scores_ranking
  ON game_scores (game, score DESC);

CREATE INDEX IF NOT EXISTS idx_game_scores_monthly
  ON game_scores (game, created_at DESC, score DESC);

CREATE INDEX IF NOT EXISTS idx_game_scores_user
  ON game_scores (game, sabun, score DESC);
