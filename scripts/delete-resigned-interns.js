#!/usr/bin/env node
/**
 * 퇴사자 데이터 영구 삭제.
 * 관련 테이블: driver_profiles, audit_log(user_id FK, CASCADE 없음), webauthn_*(CASCADE).
 *
 * 사용법:
 *   node scripts/delete-resigned-interns.js <사번> [사번...]            → dry-run
 *   node scripts/delete-resigned-interns.js <사번> [사번...] --confirm  → 실제 삭제
 *
 * 대상 사번은 인자로만 받는다. 저장소가 공개라 실명·사번을 코드에 남기지 않는다.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CONFIRM = process.argv.includes('--confirm');
const SABUNS = process.argv.slice(2).filter((a) => /^\d{8}$/.test(a));
if (!SABUNS.length) {
  console.error('사용법: node scripts/delete-resigned-interns.js <8자리 사번> [사번...] [--confirm]');
  process.exit(1);
}

(async () => {
  console.log(CONFIRM ? '=== 영구 삭제 실행 ===' : '=== DRY-RUN (삭제 안 함) ===');

  const { data: profiles, error: pe } = await supabase
    .from('driver_profiles')
    .select('id, sabun, name')
    .in('sabun', SABUNS);
  if (pe) { console.error('profiles 조회 실패:', pe.message); process.exit(1); }
  const ids = (profiles || []).map((p) => p.id);
  console.log('대상:', JSON.stringify(profiles));

  if (!ids.length) { console.log('이미 삭제됨 (대상 없음).'); return; }

  if (!CONFIRM) {
    const { count } = await supabase
      .from('audit_log').select('*', { count: 'exact', head: true }).in('user_id', ids);
    console.log(`삭제 예정: audit_log ${count}건 → driver_profiles ${ids.length}건`);
    console.log('실행하려면 --confirm 플래그를 붙이세요.');
    return;
  }

  // 1) audit_log (user_id FK, CASCADE 없음 → 먼저 삭제)
  const { error: ae, count: ac } = await supabase
    .from('audit_log').delete({ count: 'exact' }).in('user_id', ids);
  if (ae) { console.error('audit_log 삭제 실패:', ae.message); process.exit(1); }
  console.log(`audit_log 삭제: ${ac}건`);

  // 2) webauthn_* 는 driver_profiles 삭제 시 CASCADE (0건이지만 안전)
  // 3) driver_profiles 영구 삭제
  const { error: de, count: dc } = await supabase
    .from('driver_profiles').delete({ count: 'exact' }).in('sabun', SABUNS);
  if (de) { console.error('driver_profiles 삭제 실패:', de.message); process.exit(1); }
  console.log(`driver_profiles 삭제: ${dc}건`);

  // 검증
  const { data: left } = await supabase
    .from('driver_profiles').select('sabun').in('sabun', SABUNS);
  console.log('남은 행:', JSON.stringify(left));
  console.log('=== 완료 ===');
})();
