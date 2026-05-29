-- ─────────────────────────────────────────────────────────
-- board_posts.images 컬럼 추가 (누락 마이그레이션 보완)
-- Phase 2(050c127)에서 API 코드는 board_posts.images 를 select/insert 하는데
-- 컬럼 추가 마이그레이션이 빠져 프로덕션에서 다음 500 발생:
--   GET  /api/board/posts → "column board_posts.images does not exist"
--   POST /api/board/posts → "Could not find the 'images' column ... in the schema cache"
-- 타입: jsonb 배열 (기존 metadata jsonb 컨벤션과 일치, API read 는 `images || []`)
-- ─────────────────────────────────────────────────────────

ALTER TABLE board_posts ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;

-- PostgREST 스키마 캐시 즉시 리로드 ("schema cache" 에러 해소)
NOTIFY pgrst, 'reload schema';
