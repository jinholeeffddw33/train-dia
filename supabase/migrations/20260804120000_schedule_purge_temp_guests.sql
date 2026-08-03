-- 임시 접속자 2명(김유철 21712747 / 김진영 21707080) 예약 영구 삭제
--
-- 사유: 직원이 아니고 앱 내용만 잠시 보기 위해 2026-08-03 에 임시 개설한 계정.
--       2026-08-09 이 끝나는 시점(= KST 2026-08-10 00:00)에 영구 삭제한다.
--       문대중(20260531120000_purge_user_moon_dj.sql)과 같은 성격의 처리.
--
-- 실행 시각: pg_cron 은 UTC 로 돈다. KST 2026-08-10 00:00 = UTC 2026-08-09 15:00.
--            → '0 15 9 8 *'  (8월 9일 15시 UTC)
--
-- 라이브 DB에는 Management API 로 직접 적용 완료. 본 파일은 이력/재현용(멱등).

-- ── 삭제 함수 ──
-- 대상 테이블은 전수 조사로 확정(2026-08-04): audit_log 11건 / hazard_reads 1건 /
-- driver_profiles 2건. push_subscriptions·webauthn_credentials 는 0건이지만 멱등 위해 포함.
CREATE OR REPLACE FUNCTION public.purge_temp_guests_20260809()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_sabuns text[] := ARRAY['21712747', '21707080'];
  v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM driver_profiles WHERE sabun = ANY(v_sabuns);

  IF v_ids IS NOT NULL THEN
    DELETE FROM audit_log          WHERE user_id    = ANY(v_ids);
    DELETE FROM hazard_reads       WHERE user_sabun = ANY(v_sabuns);
    DELETE FROM push_subscriptions WHERE sabun      = ANY(v_sabuns);
    -- webauthn_credentials / webauthn_challenges 는 driver_profiles FK CASCADE
    DELETE FROM driver_profiles    WHERE id         = ANY(v_ids);
  END IF;

  -- 일회성 작업이므로 스스로 예약을 지운다. 실패해도 삭제는 확정되도록 분리.
  BEGIN
    PERFORM cron.unschedule('purge-temp-guests-20260809');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- ── 예약 ──
SELECT cron.unschedule('purge-temp-guests-20260809')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-temp-guests-20260809');

SELECT cron.schedule(
  'purge-temp-guests-20260809',
  '0 15 9 8 *',
  $$SELECT public.purge_temp_guests_20260809()$$
);

-- 취소하려면:  SELECT cron.unschedule('purge-temp-guests-20260809');
-- 즉시 실행하려면: SELECT public.purge_temp_guests_20260809();
