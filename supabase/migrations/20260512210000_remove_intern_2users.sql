-- 인턴 2명(이지은 22600393, 손예빈 22600418) 접근 차단
-- 사유: 직원 명단 제외, 더 이상 접근 권한 없음
-- driver_profiles는 audit_log FK 보존을 위해 is_active=false + 익명화만 처리.

-- 생체인증 자격 삭제 (재등록 불가하도록)
DELETE FROM webauthn_credentials
 WHERE user_id IN (SELECT id FROM driver_profiles WHERE sabun IN ('22600393','22600418'));

DELETE FROM webauthn_challenges
 WHERE user_id IN (SELECT id FROM driver_profiles WHERE sabun IN ('22600393','22600418'));

-- 푸시 구독 삭제
DELETE FROM push_subscriptions WHERE sabun IN ('22600393','22600418');

-- 계정 비활성화 + PIN 해시 무효화 (audit 기록 보존)
UPDATE driver_profiles
   SET is_active = false,
       pin_hash = '__DISABLED__',
       must_change_pin = false
 WHERE sabun IN ('22600393','22600418');
