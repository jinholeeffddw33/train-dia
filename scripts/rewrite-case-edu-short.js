#!/usr/bin/env node
/**
 * 사례교육 4건 description 짧게 재작성 + 태그를 `[사례교육 2026-N·분류]` 형식으로 통일
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const UPDATES = [
  {
    id: '8e206c83-b935-44cf-8a26-36a1bedd01c8',
    tag: '사례교육 2026-1·열차',
    title: '7호선 철산역 판타 상승불가',
    body: [
      "2025.10.14. 06:48경 772편성 7030열차 철산역 도착 시 전 판타 하강 후 상승불가. 7038(750편성) 구원합병 후 신풍유치선 유치 (민원 213건).",
      '',
      '원인',
      '인버터(IVS) 보조접점(리미트스위치) 재질결함 → PanUR 자기유지 회로 차단',
      '',
      '대책',
      '- 이례상황 시 관제보고 철저',
      '- 응급조치 매뉴얼 재정비',
      '- 구원합병 중 차량직원 탑승 여부 확인',
    ].join('\n'),
  },
  {
    id: '6e7486fe-491b-4441-8a95-b6372777d7a8',
    tag: '사례교육 2026-2·시설물',
    title: '2호선 신도림역 PSD 전체 열림 상태 출발',
    body: [
      '2026.2.19. 20:42경 입고열차 6938(201편성)이 신도림 3번 승강장 출입문 닫힘 후 PSD 전체 열린 상태로 신정기지 입고.',
      '',
      '원인',
      '- PSD 검지센서 일시적 오류',
      '- 승무원 PSD 전체 닫힘 미확인 후 출발',
      '- 역직원 잔류승객 확인 및 출발전호 미실시',
      '',
      '대책',
      '- PSD 닫힘 확인 후 출발부저전호 시행',
      '- 입고 시 잔류승객 확인 및 역직원 전호 확인',
    ].join('\n'),
  },
  {
    id: '01cf9461-02ba-4053-a194-6f4b3eff1c37',
    tag: '사례교육 2026-3·시설물',
    title: '차량기지 임시승강장 공사현장 연기 발생',
    body: [
      '2026.3.22. 15:10경 0호선 차량기지 임시승강장 공사현장 야자매트에서 기관사 흡연 후 담뱃재 불티로 발화. 자체조치 완료(15:31경).',
      '',
      '대책',
      '- 차량기지 내 지정 흡연장소 외 흡연 금지',
      '- 관계자 소속장 특별교육 실시',
    ].join('\n'),
  },
  {
    id: '43a9efe4-0b3a-484d-b303-930538e86239',
    tag: '사례교육 2026-4·열차',
    title: '5호선 여의나루~마포역 객실 화재',
    body: [
      '2025.5.31. 08:46경 5535열차(513편성) 5호차에서 승객 의도적 방화 → 6호차 비상핸들 취급으로 정지 → 5호차 승객 소화기 초동 진화 → 터널 대피 후 119·경찰 도착.',
      '',
      '대책',
      '- 비상대응 매뉴얼 숙지',
      '- 터널 내 화재 비상대응 훈련 강화',
      '- 입환 시 운전관제 보고 및 무선 채널 확인',
    ].join('\n'),
  },
];

(async () => {
  for (const u of UPDATES) {
    const description = `[${u.tag}] ${u.title}\n${u.body}`;
    const { error } = await supabase
      .from('hazard_reports')
      .update({ description })
      .eq('id', u.id);
    if (error) {
      console.error(`❌ ${u.tag} — ${error.message}`);
    } else {
      console.log(`✅ ${u.tag}  ${u.title}`);
    }
  }
})();
