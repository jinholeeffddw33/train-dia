#!/usr/bin/env node
/**
 * 사례교육 4건을 운전정보와 동일 포맷으로 변환:
 *   description tag: [사례교육 2026-N·분류] → [분류]
 *   location:        ''                       → 'N호'
 *   photo_url:       ''                       → 기존 attachment_url
 *   attachment_url/name: PNG                  → ''
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MAP = [
  { id: '8e206c83-b935-44cf-8a26-36a1bedd01c8', ho: '1호' },
  { id: '6e7486fe-491b-4441-8a95-b6372777d7a8', ho: '2호' },
  { id: '01cf9461-02ba-4053-a194-6f4b3eff1c37', ho: '3호' },
  { id: '43a9efe4-0b3a-484d-b303-930538e86239', ho: '4호' },
];

(async () => {
  for (const m of MAP) {
    const { data: row, error: e1 } = await supabase
      .from('hazard_reports')
      .select('id, description, attachment_url')
      .eq('id', m.id)
      .single();
    if (e1 || !row) { console.error(`❌ ${m.id}: ${e1?.message || 'not found'}`); continue; }

    // description: 첫 줄 태그를 `[사례교육 2026-N·분류]` → `[분류]`만 남김
    const lines = (row.description || '').split('\n');
    const firstLine = lines[0] || '';
    const match = firstLine.match(/^\[([^\]]+)\]\s*(.*)$/);
    let newFirstLine = firstLine;
    if (match) {
      const parts = match[1].split('·').map((s) => s.trim()).filter(Boolean);
      const kind = parts.find((p) => ['시설물', '열차', '신호'].includes(p)) || '';
      newFirstLine = kind ? `[${kind}] ${match[2]}` : match[2];
    }
    const newDesc = [newFirstLine, ...lines.slice(1)].join('\n');

    const { error: e2 } = await supabase
      .from('hazard_reports')
      .update({
        description: newDesc,
        location: m.ho,
        photo_url: row.attachment_url || '',
        attachment_url: '',
        attachment_name: '',
      })
      .eq('id', m.id);
    if (e2) { console.error(`❌ ${m.ho}: ${e2.message}`); continue; }
    console.log(`✅ ${m.ho}  ${newFirstLine}`);
  }
})();
