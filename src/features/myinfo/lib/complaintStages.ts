/**
 * 민원 7단계 — 사업소 «출입문 민원 분석 보고서»(2026-10-09) 5-2·5-3쪽 그대로.
 *
 * 두 기준을 따로 낸다(진호 2026-10-09 «출입문과 전체를 따로 분류해서 확인할 수 있도록»).
 *   ① 출입문 기준: 출입문 사건(같은 날·같은 열차 민원은 1건) 수
 *   ② 전체 불만 기준: 불만 사건(출입문 + 조기출발·안내방송·급정거·정위치 …) 수
 * 1단계 = 0건 + 칭찬 1건 이상, 2단계 = 0건. 경계는 «모두가 똑같이 조심해도 우연히 이만큼 받을 확률»로 정했다.
 *
 * 단계 값 자체는 엑셀(scripts/import-complaints.ts)에서 받아 DB 에 둔다 — 여기 기준은 화면 설명과
 * «다음 단계까지» 안내, 그리고 엑셀 값이 기준과 맞는지 확인하는 데 쓴다.
 */

export type StageBasis = 'door' | 'all';
export type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STAGE_NAME: Record<Stage, string> = {
  1: '매우 우수',
  2: '우수',
  3: '양호',
  4: '주의',
  5: '경계',
  6: '경고',
  7: '심각',
};

/** 단계별 사건 수 범위 [최소, 최대] — 7단계는 최대가 없다 */
const RANGES: Record<StageBasis, Record<Stage, [number, number]>> = {
  door: { 1: [0, 0], 2: [0, 0], 3: [1, 2], 4: [3, 4], 5: [5, 5], 6: [6, 7], 7: [8, Infinity] },
  all: { 1: [0, 0], 2: [0, 0], 3: [1, 2], 4: [3, 4], 5: [5, 6], 6: [7, 7], 7: [8, Infinity] },
};

/** 단계별 조치(제안) — 보고서 5-2·5-3쪽 표 그대로 */
export const STAGE_ACTION: Record<Stage, string> = {
  1: '칭찬 사례를 교육 자료로 공유',
  2: '현재 취급 유지',
  3: '본인 민원 내용 알림',
  4: '본인에게 집계 알림 · 스스로 점검',
  5: '부장 면담 · 유형별 주의 사항 전달',
  6: '면담 + 동승 지도 · 3개월 뒤 재확인',
  7: '1:1 코칭 + 동승 지도 + 취급 영상 확인 · 매월 확인',
};

export const BASIS_LABEL: Record<StageBasis, string> = {
  door: '출입문 민원',
  all: '전체 불만 민원',
};

/** 기준 설명(건수 부분만) — «3~4건». 앞에 BASIS_LABEL 을 붙여 쓴다 */
export function stageRule(basis: StageBasis, stage: Stage): string {
  if (stage === 1) return '0건 + 칭찬 1건 이상';
  if (stage === 2) return '0건';
  const [lo, hi] = RANGES[basis][stage];
  if (hi === Infinity) return `${lo}건 이상`;
  return lo === hi ? `${lo}건` : `${lo}~${hi}건`;
}

/** 사건 수·칭찬 수로 단계 계산 — 엑셀 값 검증용 */
export function stageOf(basis: StageBasis, events: number, praise: number): Stage {
  if (events <= 0) return praise > 0 ? 1 : 2;
  for (const s of [3, 4, 5, 6, 7] as Stage[]) {
    const [lo, hi] = RANGES[basis][s];
    if (events >= lo && events <= hi) return s;
  }
  return 7;
}

/**
 * 한 단계 위로 가려면 — 사건 수의 위 끝(그 단계의 최대)까지 줄여야 한다.
 * 2단계(0건)는 칭찬 1건이면 1단계. 1단계는 이미 맨 위.
 * 반환: { target, needEvents(그 단계 최대 건수), less(지금보다 몇 건 적어야) } 또는 null
 */
export function nextStageGoal(basis: StageBasis, stage: Stage, events: number):
  { target: Stage; maxEvents: number; less: number; praiseOnly: boolean } | null {
  if (stage === 1) return null;
  if (stage === 2) return { target: 1, maxEvents: 0, less: 0, praiseOnly: true };
  const target = (stage - 1) as Stage;
  const maxEvents = RANGES[basis][target][1];
  return { target, maxEvents, less: Math.max(0, events - maxEvents), praiseOnly: false };
}

/**
 * 유형별 «이렇게 하면 줄어요» — 보고서 5-1쪽(집중관리 5명 원문 분석)과 칭찬 민원에서 뽑은 요령.
 * key = 엑셀 「기관사별」 시트 열 이름.
 */
export const TYPE_TIPS: { key: string; label: string; tip: string }[] = [
  { key: '닫힘방송 없음', label: '닫힘 방송 없이 닫음', tip: '«출입문 닫습니다» 방송을 먼저 하세요. 방송만 먼저 해도 승객이 멈춰서 가장 빨리 줄어드는 유형이에요.' },
  { key: '하차중 닫힘', label: '내리는 중에 닫음', tip: '내리는 흐름이 완전히 끝났는지 한 번 더 보고 닫으세요. 하차가 끝나자마자 뒤에서 몸을 들이미는 승객이 많아요.' },
  { key: '신체끼임', label: '몸이 끼임', tip: '승차 흐름이 끊긴 뒤 닫으세요. 출퇴근 시간(7~10시·17~20시)에 몰려요.' },
  { key: '탑승 실패', label: '다 타기 전에 닫음', tip: '마지막 승객이 다 탈 때까지 기다리세요. «문을 끝까지 열어 태워 줬다»가 칭찬 민원 1위예요.' },
  { key: '승하차중 닫음', label: '타고 내리는 중에 닫음', tip: '모니터로 승하차가 끝났는지 확인한 뒤 닫으세요.' },
  { key: '교통약자', label: '노인·유모차·휠체어', tip: '교통약자가 보이면 조금 더 기다려 주세요. 부상·보상 요구로 이어지기 쉬워요.' },
  { key: '조기출발', label: '시각보다 일찍 출발', tip: '출발 시각을 확인하고 떠나세요.' },
  { key: '안내방송', label: '안내방송', tip: '역마다 차분한 말투·알맞은 음량으로 방송하세요. «친절한 방송»은 칭찬 민원 2위예요.' },
  { key: '운전·정차', label: '급정거·정위치', tip: '정위치에 부드럽게 세우세요.' },
];

/** 단계 색 이름 — CSS 모듈의 클래스 접미사(stage1~7)와 짝 */
export function stageTone(stage: Stage): 'best' | 'good' | 'ok' | 'care' | 'warn' | 'alert' | 'severe' {
  return (['best', 'good', 'ok', 'care', 'warn', 'alert', 'severe'] as const)[stage - 1];
}
