#!/usr/bin/env node
/**
 * 운전정보 2026-8 row 정정 (2차) — 기존 1~7호 포맷에 맞춤.
 * - location: "8호" (사용자가 수동 수정한 값 유지)
 * - description 첫 줄: [열차] 사고 상세 제목
 * - description 본문: 【재발방지 대책】 헤더 + 아라비아 번호 매김
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const ROW_ID = 'fa4d93ec-d85b-43ed-ab97-7745c778bc01';
const NEW_DESCRIPTION = `[열차] 5호선 강동역 마천행 열차 행선지 육성안내방송 오방송

【재발방지 대책】
1. 출무보고 시 행선지 상호 확인 철저 (전 소속 출무보고 강화)
2. 행선안내 육성 방송 전 행선지 확인 후 방송 실시
3. 열차 시각표 시인성 강화 실시
4. 긴급 업무지시(SNS 활용) 및 사고사례 특별교육 실시`;

(async () => {
  const { data, error } = await supabase
    .from('hazard_reports')
    .update({ description: NEW_DESCRIPTION, location: '8호' })
    .eq('id', ROW_ID)
    .select('id, location, description');
  if (error) { console.error('실패:', error.message); process.exit(1); }
  console.log('업데이트 완료:', data?.[0]?.id);
  console.log('location:', data?.[0]?.location);
  console.log('---');
  console.log(data?.[0]?.description);
})();
