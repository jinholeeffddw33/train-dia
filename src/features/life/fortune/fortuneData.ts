/**
 * 5호선 기관사 테마 오늘의 운세 데이터.
 * 일별 사용자별 deterministic 한 카드 1장 추출.
 */

export interface FortuneCard {
  /** 4가지 톤: great(대길) / good(중길) / so-so(평이) / care(주의) */
  tone: 'great' | 'good' | 'so-so' | 'care';
  emoji: string;
  /** 큰 헤드라인 (한 줄) */
  headline: string;
  /** 운전·동료·일상 영역 한 줄씩 */
  driving: string;
  partner: string;
  daily: string;
  /** 행운의 키워드 */
  luckyKeyword: string;
}

/** 28개 카드 풀 — 1년 내 거의 매일 다른 카드 */
export const FORTUNES: FortuneCard[] = [
  // ── 대길 (7장) ──
  { tone: 'great', emoji: '✨', headline: '오늘은 무엇이든 통하는 날',
    driving: '모든 신호가 청신호. 정시 운행 100%',
    partner: '교대자가 커피를 사줄 수도',
    daily: '점심 메뉴가 마음에 쏙 드는 날',
    luckyKeyword: '청신호' },
  { tone: 'great', emoji: '🌟', headline: 'ATC가 당신 편이에요',
    driving: '비상제동 0회, 정위치 정차 완벽',
    partner: '오랜만에 만난 동료와 반가운 인사',
    daily: '주박실 침대가 유난히 푹신',
    luckyKeyword: '정위치' },
  { tone: 'great', emoji: '🚀', headline: '오늘 컨디션 풀가동',
    driving: '수동운전도 자동운전 같은 부드러움',
    partner: '후배가 깍듯하게 인사하는 날',
    daily: '커피가 평소보다 두 배 맛있음',
    luckyKeyword: '풀가동' },
  { tone: 'great', emoji: '🎯', headline: '집중력 만점, 실수는 0',
    driving: '지적확인환호 한 번에 박자가 딱딱',
    partner: '동료 부탁을 가볍게 들어줄 여유',
    daily: '엘리베이터가 항상 1층에 와있음',
    luckyKeyword: '한 번에' },
  { tone: 'great', emoji: '🍀', headline: '운빨이 폭발하는 하루',
    driving: '예상 시간보다 5분 일찍 종착',
    partner: '동료가 회식 자리에 부르는 날',
    daily: '편의점 1+1 이벤트 적중',
    luckyKeyword: '폭발' },
  { tone: 'great', emoji: '🎁', headline: '뜻밖의 보너스가 찾아옵니다',
    driving: '평소 어렵던 구간이 술술',
    partner: '오랜 친구에게서 안부 연락',
    daily: '저녁에 좋아하는 메뉴가 나옴',
    luckyKeyword: '뜻밖' },
  { tone: 'great', emoji: '👑', headline: '오늘만큼은 당신이 사업소의 주인공',
    driving: '관제와의 통신이 매끄럽게',
    partner: '부장님이 칭찬하는 날',
    daily: '쇼핑할 일 있으면 할인 적중',
    luckyKeyword: '주인공' },

  // ── 중길 (10장) ──
  { tone: 'good', emoji: '😊', headline: '잔잔하게 좋은 하루',
    driving: '평범하지만 안전한 운행',
    partner: '동료와 짧은 대화가 즐거움',
    daily: '평소처럼 무난한 식사',
    luckyKeyword: '잔잔함' },
  { tone: 'good', emoji: '☕', headline: '커피 한 잔의 여유',
    driving: '주박 시간 활용해 충전 충분',
    partner: '말 없이도 통하는 동료',
    daily: '책 한 페이지의 즐거움',
    luckyKeyword: '여유' },
  { tone: 'good', emoji: '🌤️', headline: '맑은 마음으로 운행 출발',
    driving: '출입문 취급 한 번에 깔끔',
    partner: '교대 인계가 짧고 명료',
    daily: '하늘이 예뻐 보이는 날',
    luckyKeyword: '맑음' },
  { tone: 'good', emoji: '🎵', headline: '리듬을 타듯 흘러가는 하루',
    driving: '시각표와 박자가 잘 맞음',
    partner: '동료의 농담에 한 번 웃음',
    daily: '좋아하는 음악이 라디오에서',
    luckyKeyword: '리듬' },
  { tone: 'good', emoji: '🥪', headline: '소소한 즐거움이 쌓이는 날',
    driving: '터널 진입이 평소보다 가뿐',
    partner: '동료가 간식을 권함',
    daily: '점심 메뉴 추천이 적중',
    luckyKeyword: '소소함' },
  { tone: 'good', emoji: '🌱', headline: '한 단계 성장하는 하루',
    driving: '평소 어려웠던 게 한결 쉬워짐',
    partner: '선배의 한마디가 도움이 됨',
    daily: '새로운 시도가 잘 풀림',
    luckyKeyword: '성장' },
  { tone: 'good', emoji: '🛤️', headline: '내 페이스 그대로 가면 OK',
    driving: '서두르지 않아도 정시 진입',
    partner: '동료 페이스에 맞추기 쉬움',
    daily: '약속 시간 딱 맞추기',
    luckyKeyword: '내 페이스' },
  { tone: 'good', emoji: '🍙', headline: '든든하게 시작하는 하루',
    driving: '아침 출근 준비가 빠르게',
    partner: '교대자 얼굴이 환함',
    daily: '아침 식사가 유난히 맛있음',
    luckyKeyword: '든든함' },
  { tone: 'good', emoji: '📻', headline: '관제와의 무전이 부드러운 날',
    driving: '응답이 한 번에 명확히',
    partner: '동료에게 정확한 전달',
    daily: '전화 통화가 매끄러움',
    luckyKeyword: '명확함' },
  { tone: 'good', emoji: '🏃', headline: '몸이 가벼운 하루',
    driving: '점검 동선이 평소보다 빠름',
    partner: '동료에게 먼저 도움 줄 여유',
    daily: '계단 오르내림이 가뿐함',
    luckyKeyword: '가벼움' },

  // ── 평이 (7장) ──
  { tone: 'so-so', emoji: '🌥️', headline: '평범하지만 무탈한 하루',
    driving: '특이사항 없이 평범한 운행',
    partner: '동료와 평소대로 인사',
    daily: '익숙한 메뉴 익숙한 자리',
    luckyKeyword: '무탈함' },
  { tone: 'so-so', emoji: '🚇', headline: '평소와 다름없이 운전실 안녕',
    driving: '익숙한 노선, 익숙한 속도',
    partner: '간단한 교대 한 마디',
    daily: '평소 즐겨가는 카페',
    luckyKeyword: '평소대로' },
  { tone: 'so-so', emoji: '🧭', headline: '큰 변화 없이 흐르는 하루',
    driving: '루틴대로 진행해도 충분',
    partner: '특별한 일 없는 무난한 교대',
    daily: '쉬는 시간 여유롭게',
    luckyKeyword: '루틴' },
  { tone: 'so-so', emoji: '🍵', headline: '잠시 한숨 돌리는 날',
    driving: '주박 시간에 충분한 휴식',
    partner: '동료와 길지 않은 대화',
    daily: '차 한 잔이 좋아 보임',
    luckyKeyword: '한숨 돌리기' },
  { tone: 'so-so', emoji: '📓', headline: '메모 한 줄이 도움이 되는 날',
    driving: '운행 중 작은 메모가 유용',
    partner: '교대 인계 메모 깔끔히',
    daily: '오늘 할 일 정리 잘 됨',
    luckyKeyword: '기록' },
  { tone: 'so-so', emoji: '🌙', headline: '잔잔한 야간, 평온한 새벽',
    driving: '야간 운행에 집중 잘 됨',
    partner: '주박실에서 동료와 짧은 대화',
    daily: '새벽 공기가 상쾌함',
    luckyKeyword: '평온' },
  { tone: 'so-so', emoji: '🥱', headline: '천천히 깨어나는 하루',
    driving: '서서히 페이스 올리면 OK',
    partner: '말 없이도 통하는 호흡',
    daily: '커피가 평소보다 진하게 필요',
    luckyKeyword: '천천히' },

  // ── 주의 (4장) ──
  { tone: 'care', emoji: '⚠️', headline: '오늘은 한 박자 천천히',
    driving: '지적확인환호 한 번 더 점검',
    partner: '바쁜 동료에겐 한 박자 양보',
    daily: '약속은 여유 있게 잡기',
    luckyKeyword: '한 박자' },
  { tone: 'care', emoji: '🔍', headline: '평소보다 한 번 더 확인',
    driving: '출입문·PSD 양쪽 다 점검',
    partner: '교대 인계는 평소보다 자세히',
    daily: '가방에 빠진 물건 없는지 점검',
    luckyKeyword: '재확인' },
  { tone: 'care', emoji: '☔', headline: '서두르면 미끄러질 수 있어요',
    driving: '시간 여유 두고 출발',
    partner: '말은 한 박자 늦게',
    daily: '우산 챙기는 편이 안전',
    luckyKeyword: '서두르지 말기' },
  { tone: 'care', emoji: '🍃', headline: '잠시 호흡 한 번',
    driving: '집중이 흐려질 때 깊은 호흡',
    partner: '갈등이 생기면 잠시 미루기',
    daily: '점심 시간 잠깐 산책 권장',
    luckyKeyword: '호흡' },
];

/**
 * 사용자(사번)별 + 날짜별 deterministic 카드 인덱스.
 * 같은 날엔 같은 결과, 자정 넘으면 새 카드.
 */
export function pickFortune(sabun: string, dateKey: string): FortuneCard {
  const seed = `${sabun}::${dateKey}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % FORTUNES.length;
  return FORTUNES[idx];
}

/** YYYY-MM-DD 키 */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
