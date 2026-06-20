-- ─────────────────────────────────────────────────────────
-- 눈으로 보는 영상 가이드 — 사용자 등록 영상 테이블
-- 4개 영역(newcomer/daily/trouble/hr) + 제목 + 링크(URL)
-- 모든 로그인 사용자가 등록 가능, 공용 DB로 전체 공유
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS edu_videos (
  id              BIGSERIAL PRIMARY KEY,
  category        TEXT NOT NULL CHECK (category IN ('newcomer','daily','trouble','hr')),
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  url             TEXT NOT NULL CHECK (length(url) BETWEEN 4 AND 500),
  source          TEXT,                               -- youtube | naver-cafe | link (URL에서 자동 판별)
  sort_order      INTEGER NOT NULL DEFAULT 0,         -- 영역 내 정렬 (등록 순서)
  created_by      TEXT,                               -- 등록자 사번
  created_by_name TEXT,                               -- 등록자 이름
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edu_videos_active
  ON edu_videos(category, sort_order, created_at)
  WHERE status = 'active';
