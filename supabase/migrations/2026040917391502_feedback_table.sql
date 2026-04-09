-- ============================================================
-- Train-DIA 익명 제보 시스템
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL CHECK (char_length(content) >= 5 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 개인정보 일절 없음 (완전 익명)

-- RLS 활성화
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (익명 제보)
CREATE POLICY "anyone_can_submit" ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- SELECT는 service_role만 (서버 API 통해서만 조회)
-- anon/authenticated는 절대 조회 불가
CREATE POLICY "service_role_only_select" ON public.feedback
  FOR SELECT TO service_role
  USING (true);
