#!/usr/bin/env node
/**
 * 2026년 사례교육 PDF의 각 페이지(PNG)를 hazard-photos 버킷에 업로드 후
 * 각 사고사례 row의 attachment_url/attachment_name 갱신
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MAPPING = [
  { id: '8e206c83-b935-44cf-8a26-36a1bedd01c8', page: 1, displayName: '사례교육 2026-1.png' },
  { id: '6e7486fe-491b-4441-8a95-b6372777d7a8', page: 2, displayName: '사례교육 2026-2.png' },
  { id: '01cf9461-02ba-4053-a194-6f4b3eff1c37', page: 3, displayName: '사례교육 2026-3.png' },
  { id: '43a9efe4-0b3a-484d-b303-930538e86239', page: 4, displayName: '사례교육 2026-4.png' },
];

(async () => {
  for (const m of MAPPING) {
    const localPath = path.join(__dirname, '..', '.tmp_pages', `case_edu_${m.page}.png`);
    if (!fs.existsSync(localPath)) {
      console.error(`❌ 파일 없음: ${localPath}`);
      continue;
    }
    const buffer = fs.readFileSync(localPath);
    const storagePath = `attachments/action/${Date.now()}_case_edu_${m.page}.png`;

    const { error: upErr } = await supabase.storage
      .from('hazard-photos')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: false });

    if (upErr) {
      console.error(`❌ 업로드 실패 (page ${m.page}): ${upErr.message}`);
      continue;
    }

    const publicUrl = supabase.storage
      .from('hazard-photos')
      .getPublicUrl(storagePath).data.publicUrl;

    const { error: dbErr } = await supabase
      .from('hazard_reports')
      .update({
        attachment_url: publicUrl,
        attachment_name: m.displayName,
      })
      .eq('id', m.id);

    if (dbErr) {
      console.error(`❌ DB 갱신 실패 (page ${m.page}): ${dbErr.message}`);
    } else {
      console.log(`✅ ${m.displayName} → ${m.id.slice(0, 8)}…`);
    }
  }
})();
