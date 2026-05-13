-- 윷놀이 → 오델로(리버시) 교체: 잔존 yutnori 데이터 제거 후 CHECK 제약 갱신

DELETE FROM multi_game_results WHERE game = 'yutnori';
DELETE FROM multi_game_ratings WHERE game = 'yutnori';
DELETE FROM game_hall_of_fame WHERE game = 'yutnori';

ALTER TABLE multi_game_results
  DROP CONSTRAINT IF EXISTS multi_game_results_game_check;
ALTER TABLE multi_game_results
  ADD CONSTRAINT multi_game_results_game_check
  CHECK (game IN ('omok', 'reversi'));

ALTER TABLE multi_game_ratings
  DROP CONSTRAINT IF EXISTS multi_game_ratings_game_check;
ALTER TABLE multi_game_ratings
  ADD CONSTRAINT multi_game_ratings_game_check
  CHECK (game IN ('omok', 'reversi'));

ALTER TABLE game_hall_of_fame
  DROP CONSTRAINT IF EXISTS game_hall_of_fame_game_check;
ALTER TABLE game_hall_of_fame
  ADD CONSTRAINT game_hall_of_fame_game_check
  CHECK (game IN ('snake', 'reaction', 'mental', 'simon', 'halli', 'omok', 'reversi'));
