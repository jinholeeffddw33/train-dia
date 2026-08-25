-- 제한속도 운전 게임 추가에 맞춰 game_scores CHECK 제약 확장.
-- 규정 속도(운전취급규정 제104조 등)를 쉬는 시간에 몸으로 익히게 하는 게임이라
-- 랭킹은 새로 만들지 않고 기존 game_scores 를 그대로 쓴다.

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_check;

ALTER TABLE game_scores
  ADD CONSTRAINT game_scores_game_check
  CHECK (game IN ('snake', 'reaction', 'mental', 'simon', 'halli', 'apex', 'speed'));
