-- 미니게임 2종 추가(mental 암산 스프린트, simon 색깔 따라하기)에 맞춰
-- game_scores.game CHECK 제약 확장

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_check;

ALTER TABLE game_scores
  ADD CONSTRAINT game_scores_game_check
  CHECK (game IN ('snake', 'reaction', 'mental', 'simon'));
