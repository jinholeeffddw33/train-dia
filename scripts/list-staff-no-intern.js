#!/usr/bin/env node
/**
 * driver_profiles에서 인턴 제외한 활성 전 직원 명단 출력
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const INTERN_SABUNS = new Set([
  '22600439', '22600472', '22600519', '22601004', '22601008',
  '22601134', '22601146', // 조건희, 신석희 (2026-07-07 입사)
]);

const CHIEF = '21704630';        // 안성숙
const VICE = '21711216';         // 이태원
const MANAGERS = new Set([
  '21711197','21711694','21707420','21707096','21706206',
  '21709589','21707406','21706208','21707084','21709373',
]);

function roleOf(sabun) {
  if (sabun === CHIEF) return '소장';
  if (sabun === VICE) return '부소장';
  if (MANAGERS.has(sabun)) return '부장';
  return '기관사';
}

(async () => {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('sabun, name, is_active')
    .order('sabun', { ascending: true });

  if (error) { console.error(error); process.exit(1); }

  const all = data.filter(u => !INTERN_SABUNS.has(u.sabun) && u.is_active !== false);

  const grouped = { 소장: [], 부소장: [], 부장: [], 기관사: [] };
  for (const u of all) {
    const r = roleOf(u.sabun);
    grouped[r].push(u);
  }

  console.log(`\n📋 인턴 제외 전 직원 총 ${all.length}명 (활성)\n`);
  for (const [role, list] of Object.entries(grouped)) {
    if (list.length === 0) continue;
    console.log(`━━━━━━ ${role} (${list.length}명) ━━━━━━`);
    for (const u of list) {
      console.log(`  ${u.sabun}  ${u.name}`);
    }
    console.log('');
  }
})();
