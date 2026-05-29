-- 퇴사 인턴 2명(이지은 22600393, 손예빈 22600418) 영구 삭제
-- 사유: 퇴사 확정 — 비활성(20260512210000)에서 완전 삭제로 전환.
-- 조사 결과 실제 잔존 데이터: audit_log 9건 + driver_profiles 2건 (그 외 전부 0건).
-- webauthn_credentials / webauthn_challenges 는 driver_profiles ON DELETE CASCADE 로 자동 정리.
-- 라이브 DB에는 scripts/delete-resigned-interns.js 로 직접 실행 완료. 본 파일은 이력/재현용(멱등).

-- 1) audit_log (user_id FK, CASCADE 없음 → 먼저 삭제)
DELETE FROM audit_log
 WHERE user_id IN (SELECT id FROM driver_profiles WHERE sabun IN ('22600393','22600418'));

-- 2) 잔여 식별 데이터 (모두 0건 확인됐으나 멱등 보장)
DELETE FROM push_subscriptions WHERE sabun IN ('22600393','22600418');

-- 3) driver_profiles 영구 삭제 (webauthn_* CASCADE)
DELETE FROM driver_profiles WHERE sabun IN ('22600393','22600418');
