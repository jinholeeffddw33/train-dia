#!/usr/bin/env node
/**
 * 운전정보 2026-8 row 업데이트 — 신규 표기 규칙 적용.
 * - 제목: "운전정보 8호"만 (역명·사고 요약 제외)
 * - 설명: 재발방지 대책 내용만
 * - location: 비움
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ROW_ID = 'fa4d93ec-d85b-43ed-ab97-7745c778bc01';
const NEW_DESCRIPTION = `[열차] 운전정보 8호
○ 출무보고 시 행선지 상호 확인 철저
  - 전 소속 출무보고 강화
○ 행선안내 육성 방송 전 행선지 확인 후 방송 실시
○ 열차 시각표 시인성 강화 실시
○ 긴급 업무지시(SNS 활용) 및 사고사례 특별교육 실시`;

(async () => {
  const { data, error } = await supabase
    .from('hazard_reports')
    .update({ description: NEW_DESCRIPTION, location: '' })
    .eq('id', ROW_ID)
    .select('id, description');
  if (error) { console.error('실패:', error.message); process.exit(1); }
  console.log('업데이트 완료:', data?.[0]?.id);
  console.log('---');
  console.log(data?.[0]?.description);
})();
