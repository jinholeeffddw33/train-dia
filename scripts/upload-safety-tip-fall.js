#!/usr/bin/env node
/**
 * 안전상식 등록 — 답십리승무사업소 "넘어짐 사고" 예방교육 (유튜브 영상)
 * 사용: node scripts/upload-safety-tip-fall.js [--dry-run]
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TIP = {
  title: '답십리승무사업소 "넘어짐 사고" 예방교육',
  description: null,
  content_type: 'video',
  media_url: 'https://youtu.be/tCvzdee-59U',
  /* 작성자는 환경변수로 — 저장소가 공개라 실명·사번을 코드에 남기지 않는다 */
  created_by_sabun: process.env.AUTHOR_SABUN,
  created_by_name: process.env.AUTHOR_NAME,
};

(async () => {
  // 중복 방지 — 동일 URL 이미 등록됐는지 확인
  const { data: existing, error: selErr } = await supabase
    .from('safety_tips')
    .select('id, title')
    .eq('media_url', TIP.media_url);
  if (selErr) { console.error('조회 실패:', selErr.message); process.exit(1); }
  if (existing && existing.length) {
    console.log('이미 등록됨 — 건너뜀:', existing.map((r) => `${r.id} ${r.title}`).join(' / '));
    process.exit(0);
  }

  if (DRY_RUN) { console.log('[dry-run] 등록 예정:', JSON.stringify(TIP, null, 2)); process.exit(0); }

  const { data, error } = await supabase.from('safety_tips').insert(TIP).select('id, created_at').single();
  if (error) { console.error('등록 실패:', error.message); process.exit(1); }
  console.log('✅ 등록 완료:', data.id, '/', data.created_at, '/', TIP.title);
})();
