-- 문대중(21707091) 영구 삭제 — 일시 접속 권한 부여 후 회수
-- 사유: 정적 명단(P/EXTRA_USERS/INTERN_USERS)에는 없지만 임시 로그인 가능하도록 driver_profiles에만 등록되어 있었음.
-- 이제 더 이상 접근 권한 불필요 → 계정 영구 삭제.
-- 라이브 DB에는 service-role 스크립트로 직접 실행 완료. 본 파일은 이력/재현용(멱등).

-- 1) audit_log (user_id FK, CASCADE 없음)
DELETE FROM audit_log
 WHERE user_id IN (SELECT id FROM driver_profiles WHERE sabun = '21707091');

-- 2) hazard_reads (sabun 기반, 0건이지만 멱등 보장)
DELETE FROM hazard_reads WHERE user_sabun = '21707091';

-- 3) 잔여 식별 데이터
DELETE FROM push_subscriptions WHERE sabun = '21707091';

-- 4) driver_profiles 영구 삭제 (webauthn_* CASCADE)
DELETE FROM driver_profiles WHERE sabun = '21707091';
