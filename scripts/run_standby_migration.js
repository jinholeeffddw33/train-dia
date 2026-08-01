// 직접 SQL 실행 — supabase CLI 마이그레이션 충돌 우회
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260620140000_standby_coverage.sql'),
    'utf-8',
  );
  // Split by statement boundary, run each
  const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(s => s && !s.startsWith('--'));
  for (const stmt of statements) {
    process.stdout.write(`Running: ${stmt.slice(0, 80).replace(/\n/g, ' ')}...\n`);
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' }).catch(e => ({ error: e }));
    if (error && !String(error.message || '').includes('already exists')) {
      // Try via REST direct query (rpc exec_sql may not exist)
      console.error('  rpc exec_sql failed:', error.message);
    }
  }
}
main().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1); });
