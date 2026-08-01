#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

(async () => {
  const { data, error } = await supabase
    .from('hazard_reports')
    .select('id, description, location, created_by, category, created_at')
    .eq('category', 'inspect')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error(error); process.exit(1); }

  console.log(`\n📋 inspect 카테고리 최근 ${data.length}건:\n`);

  const TRAIN_RE = /^\d+편성$/;
  let trainCount = 0;
  let drivingCount = 0;
  let otherCount = 0;

  for (const r of data) {
    const firstLine = (r.description || '').split('\n')[0];
    const m = firstLine.match(/^\[([^\]]+)\]\s*(.*)$/);
    const tag = m ? m[1] : '(no tag)';
    const title = m ? m[2] : firstLine;
    let bucket = 'OTHER';
    if (TRAIN_RE.test(tag)) { bucket = '🚆 TRAIN'; trainCount++; }
    else if (['시설물','열차','신호'].includes(tag)) { bucket = '🚧 DRIVING'; drivingCount++; }
    else { otherCount++; bucket = '📢 NOTICE'; }
    console.log(`  ${bucket}  [${tag}] ${title.slice(0, 40)}`);
    console.log(`    by ${r.created_by} · ${r.created_at}`);
  }

  console.log(`\n📊 분류: 열차정보 ${trainCount} / 운전정보 ${drivingCount} / 공지 ${otherCount}\n`);
})();
