// ===== 교번 시스템 타입 =====

/** 기관사 인원 */
export interface Person {
  /** 순번 */
  I: string;
  /** 기준일 교번 */
  d: string;
  /** 이름 */
  n: string;
  /** 사번 (8자리) */
  s?: string;
  /** 통상근무 오프셋 (0-3, 평일만 51-54 순환) */
  w?: number;
}

/** 교번 타입 */
export type DiaType = 'day' | 'night' | 'standby' | 'rest';

/** 구간 정보 */
export interface Segment {
  /** 출발 시각 */
  d: string;
  /** 도착 시각 */
  a: string;
  /** 열차 번호 배열 */
  n?: number[];
}

/** 스케줄 정보 */
export interface Schedule {
  /** 출근 시각 */
  s: string;
  /** 퇴근 시각 */
  e: string;
  /** 운전행로 이미지 (PNG key) */
  t?: string;
  /** 운전행로 문자열 */
  m?: string;
  /** 근무시간 (H:MM 형식, 행로표 기준) */
  w?: string;
  /** 구간 배열 */
  g?: Segment[];
}

/** 배너 상태 */
export type BannerStateType = 'working' | 'done' | 'idle' | 'preparing';

export interface NextShiftInfo {
  daysAhead: number;
  dia: string;
  schedule: Schedule | null;
}

export interface BannerState {
  state: BannerStateType;
  next?: NextShiftInfo | null;
  minsUntil?: number;
}

/** 방향 */
export type Direction = 'up' | 'down' | 'depot';

export interface DirectionInfo {
  dir: Direction;
  label: string;
  sub: string;
  short?: string;
}

/** 월간 요약 */
export interface MonthSummary {
  dayWork: number;
  nightWork: number;
  dayStandby: number;
  nightStandby: number;
}

/** D-Day 결과 */
export interface DaysUntilRest {
  days: number;
  dia: string;
}

/** 장애 알림 */
export interface Alert {
  id: string;
  stationFrom: string;
  stationTo: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  photos?: string[];
  created_at: string;
}

/** 스케줄 테이블 (교번 → Schedule) */
export type ScheduleTable = Record<string, Schedule>;

/** 스케줄 DB */
export interface ScheduleDB {
  p_ord: ScheduleTable;
  p_hol: ScheduleTable;
  p_ordord: ScheduleTable;
  p_ordhol: ScheduleTable;
  p_holord: ScheduleTable;
  p_holhol: ScheduleTable;
}
