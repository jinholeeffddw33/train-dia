-- APEX RUSH(3D 다운힐) 미니게임 추가에 맞춰 game_scores CHECK 제약 확장 (진호 2026-07-08)
-- zinosb-marketplace 의 APEX 게임을 train-dia 로 이식하며 랭킹은 train-dia 자체 game_scores 재사용.

ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_check;

ALTER TABLE game_scores
  ADD CONSTRAINT game_scores_game_check
  CHECK (game IN ('snake', 'reaction', 'mental', 'simon', 'halli', 'apex'));
