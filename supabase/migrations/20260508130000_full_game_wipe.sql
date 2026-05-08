-- 전체 게임 기록 초기화 (사용자 요청, 2026-05-08)
-- 모든 점수, 대국, 레이팅, 명예의 전당까지 완전 삭제 — 새로운 마음으로 도전.

TRUNCATE TABLE game_scores RESTART IDENTITY;
TRUNCATE TABLE multi_game_results RESTART IDENTITY;
TRUNCATE TABLE multi_game_ratings;
TRUNCATE TABLE game_hall_of_fame RESTART IDENTITY;
