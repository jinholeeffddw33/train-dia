/**
 * 지도승무 실적 엑셀 → DB (첫 적재·일괄 보충용). 앱의 [지도승무 → 엑셀 올리기]와 같은 일을 한다.
 *
 * 사용: npx tsx scripts/import-jido-excel.ts "<엑셀 경로>" [--dry-run]
 *   - 같은 기록(날짜·기관사·지도요원·열차)은 건너뛴다 → 여러 번 돌려도 겹치지 않는다
 *   - 담당부장·중점관리 시트가 있으면 jido_roster 도 고친다
 */
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { parseJidoWorkbook } from '../src/features/jido/lib/parseJidoExcel';

const file = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!file) { console.error('사용: npx tsx scripts/import-jido-excel.ts "<엑셀 경로>" [--dry-run]'); process.exit(1); }

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);

async function main() {
  const wb = XLSX.read(fs.readFileSync(file), { cellDates: true });
  const r = parseJidoWorkbook(wb, XLSX.utils as never);
  console.log(r.sources.join('\n'));
  console.log(`기록 ${r.rides.length}건 · 담당/중점 ${r.roster.length}명 · 건너뜀 ${r.skipped}`);
  if (DRY) return;

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let added = 0;
  for (let i = 0; i < r.rides.length; i += 500) {
    const chunk = r.rides.slice(i, i + 500).map((x) => ({
      ride_date: x.date, driver_sabun: x.driverSabun, driver_name: x.driverName,
      guide_sabun: x.guideSabun, guide_name: x.guideName, train_no: x.trainNo, formation: x.formation,
      from_station: x.fromStation, to_station: x.toStation, source: 'upload', created_by_name: '엑셀 적재',
    }));
    const { data, error } = await sb.from('jido_rides')
      .upsert(chunk, { onConflict: 'ride_date,driver_sabun,guide_name,train_no', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    added += data?.length ?? 0;
  }
  const now = new Date().toISOString();
  const managers = r.roster.filter((x) => x.manager).map((x) => ({
    driver_sabun: x.driverSabun, driver_name: x.driverName, manager_name: x.manager, updated_by_name: '엑셀 적재', updated_at: now,
  }));
  const focus = r.roster.filter((x) => x.focusFrom && x.focusTo).map((x) => ({
    driver_sabun: x.driverSabun, driver_name: x.driverName, focus_reason: x.focusReason ?? '중점관리',
    focus_from: x.focusFrom, focus_to: x.focusTo, updated_by_name: '엑셀 적재', updated_at: now,
  }));
  for (const rows of [managers, focus]) {
    if (rows.length === 0) continue;
    const { error } = await sb.from('jido_roster').upsert(rows, { onConflict: 'driver_sabun' });
    if (error) throw error;
  }
  console.log(`새 기록 ${added}건 (이미 있던 ${r.rides.length - added}건 건너뜀) · 담당부장 ${managers.length}명 · 중점관리 ${focus.length}명`);
}
main().catch((e) => { console.error(e); process.exit(1); });
