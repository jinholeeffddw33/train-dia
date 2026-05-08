-- 5월 기록 즉시 리셋 (사용자 요청, 2026-05-08)
-- 5월 1일부터의 모든 게임 기록을 지우고, Elo 레이팅을 초기화한다.
-- 명예의 전당(game_hall_of_fame)은 그대로 보존.

DELETE FROM game_scores WHERE created_at >= '2026-05-01T00:00:00Z';

DELETE FROM multi_game_results WHERE created_at >= '2026-05-01T00:00:00Z';

DELETE FROM multi_game_ratings;
