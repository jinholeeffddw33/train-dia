#!/usr/bin/env node
/**
 * 7개 운전 정보의 description body를 "재발방지 대책" 요약으로 교체.
 * 첫 줄 [열차] 제목은 유지, 두 번째 줄 이하의 본문만 교체.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 호별 재발방지 대책 (PDF 기반 요약)
const PREVENTIONS = {
  '1호': [
    '긴급 업무지시(SNS) 및 사고사례 특별교육 실시',
    '이례상황 교육(신조전동차 응급조치 교육 시행)',
    '정위치정차 조정 후 주간제어기 EB 위치 확인 철저',
    '관제와 정확한 운전정보 교환 철저',
  ],
  '2호': [
    '승무 중 전자기기 전원 OFF 철저',
    '직통운행구간(코레일) 지도승무 강화 시행',
    '운전보안장치(DSD) 무력화 금지',
    '신호·진로 확인 철저, 전도주시 및 지적확인환호 철저',
    '운행 중 이례상황 발생 시 즉시 관제보고 및 관제무전 경청',
    '인적오류 근절을 위한 안전패트롤 현장활동 강화',
  ],
  '3호': [
    '사고사례 특별교육 실시',
    '신호·진로 확인, 전도주시 및 지적확인환호 철저 교육',
    '운행 중 이례상황 발생 시 즉시 관제보고 및 관제무전 경청',
    '기지구내 제한속도 구간 준수 교육 실시',
    '운행기록부 분석 시 제한속도 구간 분석 철저',
  ],
  '4호': [
    '사고사례 특별교육 실시',
    '출고 점검 철저 → 이례상황 발생 시 즉시 관제보고',
    '출고 중 차량 고장 발생 시 차량 교환 후 출고 (고장차 출고 절대 금지)',
    '고장소멸 여부 임의판단 금지',
  ],
  '5호': [
    '긴급 업무지시(SNS) 및 사고사례 특별교육 실시',
    '안전패트롤 1단계 주의 발령 (2주간)',
    '승무원 기본업무 교육 철저 (지적확인환호 절대준수 등)',
    '출입문 수동 취급은 열림 방향 측창문 개방 후 실시',
    '중앙 제어대 출입문 열림 스위치 취급 금지',
    '특이사항 없을 시 출입문 재취급 금지',
  ],
  '6호': [
    '긴급 업무지시(SNS) 및 사고사례 특별교육 실시',
    '안전패트롤 2단계 경보 발령 (2주간)',
    '승무원 기본업무 교육 철저 (지적확인환호 절대준수 등)',
    '출입문 수동 취급은 열림 방향 측창문 개방 후 실시',
    '출입문 재취급 시 반드시 승강장 방향 지적확인환호 후 취급',
    '중앙 제어대 출입문 열림 스위치 취급 금지',
    '특이사항 없을 시 출입문 재취급 절대 금지',
  ],
  '7호': [
    '승무원 기본업무 교육 철저 (지적확인환호 절대준수 등)',
    '이례상황 발생 시 즉시 관제보고',
    '열차 출입문 열기 전 정지위치 합치여부 확인',
    '정위치 조정 시 정위치 범위 확인 후 출입문 개방',
    '정위치정차 유도안내표시등(전광판) 양호 상태 반드시 확인',
    '동일 장애유발(무코드·초과정차·미달정차·승강장안전문 오류 등) 특정편성 및 개소 관리 철저',
    '업무 매뉴얼 승무원 교육 실시',
  ],
};

(async () => {
  const { data: rows, error } = await sb.from('hazard_reports')
    .select('id,description,location')
    .eq('category', 'inspect')
    .ilike('description', '[열차]%')
    .order('created_at', { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }
  console.log('대상:', rows.length, '건');

  for (const r of rows) {
    const ho = (r.location || '').trim();
    const items = PREVENTIONS[ho];
    if (!items) { console.warn(`SKIP: ${r.id.slice(0,8)} location='${ho}' 매칭 없음`); continue; }
    const firstLine = (r.description.split('\n')[0] || '').trim();
    const body = '【재발방지 대책】\n' + items.map((s, i) => `${i+1}. ${s}`).join('\n');
    const newDesc = `${firstLine}\n${body}`;
    const { error: upErr } = await sb.from('hazard_reports').update({ description: newDesc }).eq('id', r.id);
    console.log(ho, '|', r.id.slice(0,8), '|', upErr ? 'ERR:'+upErr.message : 'OK');
  }
  console.log('완료');
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
