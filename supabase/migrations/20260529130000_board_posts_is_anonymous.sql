-- ─────────────────────────────────────────────────────────
-- board_posts.is_anonymous — 글별 익명/실명 선택
-- 기존: 게시판 전체가 항상 가명(익명). → 변경: 글쓰기에서 선택.
--   is_anonymous = false (기본) → author_alias 에 실명(이름) 저장
--   is_anonymous = true         → author_alias 에 가명(겸손한구간 등) 저장
-- 고민상담(advice)도 선택 허용. 단 익명 선택 시 별도 가명 풀(scope='advice') 사용.
-- ─────────────────────────────────────────────────────────

ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- PostgREST 스키마 캐시 즉시 리로드
NOTIFY pgrst, 'reload schema';
