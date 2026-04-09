-- ============================================================
-- Train-DIA 인증 시스템 마이그레이션
-- 실행: Supabase SQL Editor에서 실행
-- ============================================================

-- 1) driver_profiles: 기관사 프로필 + PIN 해시
CREATE TABLE IF NOT EXISTS public.driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sabun TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT DEFAULT 'driver' CHECK (role IN ('driver', 'admin')),
  pin_hash TEXT NOT NULL,
  must_change_pin BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_driver_profiles_sabun ON public.driver_profiles(sabun);

-- 2) webauthn_credentials: 생체인증 credential 저장
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT false,
  transports TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_webauthn_user ON public.webauthn_credentials(user_id);

-- 3) webauthn_challenges: 임시 챌린지 저장 (등록/인증 시)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes')
);

-- 4) audit_log: 감사 로그 (삭제/수정 불가)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.driver_profiles(id),
  user_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- 5) hazard_reports에 user_id 컬럼 추가 (기존 테이블)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hazard_reports' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.hazard_reports ADD COLUMN user_id UUID REFERENCES public.driver_profiles(id);
  END IF;
END $$;

-- 6) hazard_comments에 user_id 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hazard_comments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.hazard_comments ADD COLUMN user_id UUID REFERENCES public.driver_profiles(id);
  END IF;
END $$;

-- 7) hazard_likes에 user_id 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hazard_likes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.hazard_likes ADD COLUMN user_id UUID REFERENCES public.driver_profiles(id);
  END IF;
END $$;

-- 8) RLS 정책
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- driver_profiles: service_role만 접근 (API 서버에서만)
CREATE POLICY "service_role_full_access" ON public.driver_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- webauthn_credentials: service_role만 접근
CREATE POLICY "service_role_full_access" ON public.webauthn_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- webauthn_challenges: service_role만 접근
CREATE POLICY "service_role_full_access" ON public.webauthn_challenges
  FOR ALL USING (auth.role() = 'service_role');

-- audit_log: service_role만 삽입/조회 (수정/삭제 불가)
CREATE POLICY "service_role_insert" ON public.audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_select" ON public.audit_log
  FOR SELECT USING (auth.role() = 'service_role');

-- 9) 만료된 챌린지 자동 정리 (pgcron이 있으면)
-- SELECT cron.schedule('cleanup-challenges', '*/10 * * * *',
--   $$DELETE FROM public.webauthn_challenges WHERE expires_at < now()$$
-- );
