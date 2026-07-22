// ===== DISPLAY CONSTANTS (SSOT — 하드코딩 방지) =====

/** 앱 버전 — 표지·설정 등 모든 표시 위치에서 이 상수를 참조 */
export const APP_VERSION = 'v3.6.4';


export const LABELS = {
  START: '출근',
  END: '퇴근',
  WORK_TIME: '근무시간',
  DEPART: '출발',
  NEXT_DEPART: '다음 출발',
  WORK_DONE: '근무 종료',
  GOOD_JOB: '수고하셨습니다',
  TODAY_DONE: '오늘 근무 완료',
  NEXT_WORK: '다음 근무',
  DAY_WORK: '주간 근무',
  NIGHT_WORK: '야간 근무',
  STANDBY_WORK: '대기 근무',
  WORK: '근무',
  STANDBY: '대기',
  DAY: '주간',
  NIGHT: '야간',
  MONTH_SUMMARY: '근무 요약',
  TOTAL_WORK: '총 근무일',
  TODAY_DIA: '오늘의 교번 · DIA',
  TODAY_DIA_SHORT: '오늘의 교번',
  WEEK_WORK: '이번주 근무',
  SEGMENT_RUN: '구간 운행',
  SELECT_DRIVER: '기관사 선택',
  EMPTY_HOME: '기관사를 선택하면\n오늘의 교번을 확인합니다',
  EMPTY_CAL: '기관사를 선택하면\n교번이 달력에 표시됩니다',
  AUTH_REQUIRED: '승인 필요',
} as const;

export const EMOJI = {
  SMILE: '😊',
  PARTY: '🎉',
  TRAIN: '🚇',
  CLOSE: '✕',
  CALENDAR: '📅',
  LOCK: '🔒',
  EYE: '👁',
  ALERT: { high: '🚨', medium: '⚠️', low: 'ℹ️' } as const,
} as const;

export const DIR = {
  UP: '▲상선',
  DOWN: '▼하선',
  DEPOT: '🚇기지',
  UP_FULL: '▲ 상선 교대',
  DOWN_FULL: '▼ 하선 교대',
  DEPOT_FULL: '고덕기지 출발',
  UP_SUB: '방화 방면 승강장',
  DOWN_SUB: '마천·하남 방면 승강장',
  DEPOT_SUB: '고덕기지에서 직접 출발',
} as const;

/** 요일 (일~토) */
export const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 방향 축약 라벨 */
export function dirShort(dir: string): string {
  return ({ up: DIR.UP, down: DIR.DOWN, depot: DIR.DEPOT } as Record<string, string>)[dir] || '';
}

/** 방향 전체 라벨 */
export function dirFull(dir: string): string {
  return ({ up: DIR.UP_FULL, down: DIR.DOWN_FULL, depot: DIR.DEPOT_FULL } as Record<string, string>)[dir] || '';
}

/** 방향 부제 */
export function dirSub(dir: string): string {
  return ({ up: DIR.UP_SUB, down: DIR.DOWN_SUB, depot: DIR.DEPOT_SUB } as Record<string, string>)[dir] || '';
}

/** 알림 아이콘 */
export function alertIcon(severity: string): string {
  return (EMOJI.ALERT as Record<string, string>)[severity] || EMOJI.ALERT.low;
}
