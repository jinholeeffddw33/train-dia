-- 할리갈리 솔로 "종 치기" 추가에 맞춰 CHECK 제약 확장

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_check;

ALTER TABLE game_scores
  ADD CONSTRAINT game_scores_game_check
  CHECK (game IN ('snake', 'reaction', 'mental', 'simon', 'halli'));
