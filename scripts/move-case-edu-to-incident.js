#!/usr/bin/env node
/** 사례교육 4건을 inspect(운전정보) → action(사고사례) 카테고리로 이동 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const IDS = [
  '8e206c83-b935-44cf-8a26-36a1bedd01c8',
  '6e7486fe-491b-4441-8a95-b6372777d7a8',
  '01cf9461-02ba-4053-a194-6f4b3eff1c37',
  '43a9efe4-0b3a-484d-b303-930538e86239',
];

(async () => {
  const { data, error } = await supabase
    .from('hazard_reports')
    .update({ category: 'action' })
    .in('id', IDS)
    .select('id, category, description');

  if (error) { console.error(error); process.exit(1); }
  console.log(`✅ ${data.length}건 category 'action'(사고사례)로 변경`);
  for (const r of data) {
    const title = (r.description || '').split('\n')[0].slice(0, 60);
    console.log(`  - ${title}`);
  }
})();
