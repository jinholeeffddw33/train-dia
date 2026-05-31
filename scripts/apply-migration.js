#!/usr/bin/env node
/**
 * Supabase Management API로 SQL 실행
 * 사용법: node scripts/apply-migration.js <sql-file-path>
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const PROJECT_REF = require('../supabase/.temp/linked-project.json').ref;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN 미설정'); process.exit(1); }

const sqlPath = process.argv[2];
if (!sqlPath) { console.error('사용법: node scripts/apply-migration.js <sql-path>'); process.exit(1); }

const sql = fs.readFileSync(sqlPath, 'utf-8');
console.log(`📄 적용: ${path.basename(sqlPath)}\n`);
console.log(sql);
console.log('─────────────────────────\n');

(async () => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}\n${text}`);
    process.exit(1);
  }
  console.log(`✅ 적용 완료\n${text}`);
})();
