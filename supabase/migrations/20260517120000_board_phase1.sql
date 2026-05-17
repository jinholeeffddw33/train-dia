-- ─────────────────────────────────────────────────────────
-- 답십리 사업소 익명 게시판 Phase 1 (MVP)
-- 카테고리: free, tip, meet, advice (중고거래 제외)
-- 익명: 사용자별 일관 가명 (고민상담은 별도 가명)
-- 댓글: 2단(대댓글)
-- ─────────────────────────────────────────────────────────

-- 사용자 가명 매핑 (사번 해시 → 가명)
CREATE TABLE IF NOT EXISTS board_user_aliases (
  author_hash TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'general',  -- 'general' | 'advice'(고민상담 전용)
  alias       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (author_hash, scope)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_board_aliases_unique ON board_user_aliases(scope, alias);

-- 게시글
CREATE TABLE IF NOT EXISTS board_posts (
  id            BIGSERIAL PRIMARY KEY,
  category      TEXT NOT NULL CHECK (category IN ('free','tip','meet','advice')),
  title         TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  body          TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  author_hash   TEXT NOT NULL,
  author_alias  TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,  -- 카테고리별 추가 데이터 (모임: 일시·장소·인원)
  like_count    INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  report_count  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_posts_category_created ON board_posts(category, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_board_posts_author ON board_posts(author_hash);
CREATE INDEX IF NOT EXISTS idx_board_posts_hot ON board_posts(like_count DESC, created_at DESC) WHERE status = 'active';

-- 댓글 (parent_id로 2단 대댓글)
CREATE TABLE IF NOT EXISTS board_comments (
  id           BIGSERIAL PRIMARY KEY,
  post_id      BIGINT NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  parent_id    BIGINT REFERENCES board_comments(id) ON DELETE CASCADE,
  body         TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  author_hash  TEXT NOT NULL,
  author_alias TEXT NOT NULL,
  like_count   INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_comments_post ON board_comments(post_id, created_at ASC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_board_comments_parent ON board_comments(parent_id);

-- 좋아요 (글 / 댓글)
CREATE TABLE IF NOT EXISTS board_post_likes (
  post_id     BIGINT NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  author_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, author_hash)
);

CREATE TABLE IF NOT EXISTS board_comment_likes (
  comment_id  BIGINT NOT NULL REFERENCES board_comments(id) ON DELETE CASCADE,
  author_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (comment_id, author_hash)
);

-- 신고
CREATE TABLE IF NOT EXISTS board_reports (
  id            BIGSERIAL PRIMARY KEY,
  target_type   TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id     BIGINT NOT NULL,
  reporter_hash TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_board_reports_unique_per_user ON board_reports(target_type, target_id, reporter_hash);
CREATE INDEX IF NOT EXISTS idx_board_reports_pending ON board_reports(status) WHERE status = 'pending';

-- 차단 (개인용)
CREATE TABLE IF NOT EXISTS board_blocks (
  blocker_hash TEXT NOT NULL,
  blocked_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_hash, blocked_hash)
);

-- ─── 카운터 자동 갱신 트리거 ───
CREATE OR REPLACE FUNCTION board_update_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE board_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE board_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_post_likes ON board_post_likes;
CREATE TRIGGER trg_board_post_likes AFTER INSERT OR DELETE ON board_post_likes
  FOR EACH ROW EXECUTE FUNCTION board_update_like_count();

CREATE OR REPLACE FUNCTION board_update_comment_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE board_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE board_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_comment_likes ON board_comment_likes;
CREATE TRIGGER trg_board_comment_likes AFTER INSERT OR DELETE ON board_comment_likes
  FOR EACH ROW EXECUTE FUNCTION board_update_comment_like_count();

CREATE OR REPLACE FUNCTION board_update_comment_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE board_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE board_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'active' AND OLD.status <> 'active' THEN
      UPDATE board_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF NEW.status <> 'active' AND OLD.status = 'active' THEN
      UPDATE board_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_comments_count ON board_comments;
CREATE TRIGGER trg_board_comments_count AFTER INSERT OR DELETE OR UPDATE ON board_comments
  FOR EACH ROW EXECUTE FUNCTION board_update_comment_count();

-- ─── 신고 누적 자동 hidden ───
CREATE OR REPLACE FUNCTION board_check_report_threshold() RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF NEW.target_type = 'post' THEN
    SELECT COUNT(*) INTO cnt FROM board_reports WHERE target_type='post' AND target_id=NEW.target_id AND status='pending';
    UPDATE board_posts SET report_count = cnt WHERE id = NEW.target_id;
    IF cnt >= 3 THEN
      UPDATE board_posts SET status = 'hidden' WHERE id = NEW.target_id AND status = 'active';
    END IF;
  ELSIF NEW.target_type = 'comment' THEN
    SELECT COUNT(*) INTO cnt FROM board_reports WHERE target_type='comment' AND target_id=NEW.target_id AND status='pending';
    IF cnt >= 3 THEN
      UPDATE board_comments SET status = 'hidden' WHERE id = NEW.target_id AND status = 'active';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_report_threshold ON board_reports;
CREATE TRIGGER trg_board_report_threshold AFTER INSERT ON board_reports
  FOR EACH ROW EXECUTE FUNCTION board_check_report_threshold();

-- ─── RLS: service_role 전용 (API에서만 접근) ───
ALTER TABLE board_user_aliases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_blocks        ENABLE ROW LEVEL SECURITY;
