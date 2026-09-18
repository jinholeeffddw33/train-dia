/**
 * 특별 다이아 — 명절처럼 며칠만 행로표가 바뀌는 날.
 *
 * 평소 행로표(schedules.ts)는 손대지 않는다. 대신 «이 날짜의 이 근무는 이 표로» 를 여기에
 * 날짜별로 적어 두고, getSchedule 이 평소 표를 고르기 전에 먼저 이곳을 본다.
 * 날짜가 지나면 여기 적힌 것이 저절로 안 쓰인다 — 되돌리는 작업이 따로 필요 없다.
 *
 * 날짜 키는 **근무를 시작하는 날**이다. 야간 근무는 저녁에 시작해 다음 날 아침에 끝나는데,
 * 앱 전체가 야간을 시작일로 묶어 두기 때문이다(예: 9/27 저녁 야간의 새벽 열차는 9/28 에 달린다).
 *
 * 다 쓰고 나면 SPECIAL_DAYS 에서 그 날짜들을 지우고 데이터 파일을 지우면 된다.
 * 넣기 직전 상태는 git 태그로 남아 있다.
 */
import type { Schedule } from '@/lib/types';
import {
  CHUSEOK_DAY,
  CHUSEOK_LINK_0923,
  CHUSEOK_NIGHT_0924,
  CHUSEOK_NIGHT_0926,
  CHUSEOK_NIGHT_0927,
  CHUSEOK_IMAGES,
} from './chuseok2026';

export interface SpecialShift {
  /** 여기 있는 다이아는 평소 표 대신 이 값을 쓴다 */
  table?: Record<string, Schedule>;
  /** 그날 운행하지 않는 다이아 — 운휴로 보인다 */
  suspended?: string[];
  /** 행로표 그림(다이아 → 경로). 없으면 평소 그림 */
  images?: Record<string, string>;
}

export interface SpecialDay {
  /** 화면에 붙일 짧은 이름 */
  label: string;
  day?: SpecialShift;
  night?: SpecialShift;
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/** 추석 연휴 주간 — 1~34 만 돈다. 35~43 은 운휴(그만큼 휴가를 갈 수 있게 줄였다). */
const DAY_SHIFT: SpecialShift = {
  table: CHUSEOK_DAY,
  suspended: range(35, 43),
  images: CHUSEOK_IMAGES.day,
};

export const SPECIAL_DAYS: Record<string, SpecialDay> = {
  // 9/23(수) 저녁 — 평소 평휴 야간 대신 «연결시작» 다이아. 새벽 열차가 9/24 추석 주간과 이어진다.
  '2026-09-23': {
    label: '추석 연결',
    night: { table: CHUSEOK_LINK_0923, images: CHUSEOK_IMAGES.link0923 },
  },
  // 9/24(목)·9/25(금) — 주간 1~34, 야간 69~91 만(62~68 운휴)
  '2026-09-24': {
    label: '추석 연휴',
    day: DAY_SHIFT,
    night: { table: CHUSEOK_NIGHT_0924, suspended: range(62, 68), images: CHUSEOK_IMAGES.night0924 },
  },
  '2026-09-25': {
    label: '추석 연휴',
    day: DAY_SHIFT,
    night: { table: CHUSEOK_NIGHT_0924, suspended: range(62, 68), images: CHUSEOK_IMAGES.night0924 },
  },
  // 9/26(토) — 주간 1~34. 야간은 추석 휴휴(69~91)에 심야 1시간 연장 변경분(74·78·80·87·91)을 덮는다.
  '2026-09-26': {
    label: '추석 연휴',
    day: DAY_SHIFT,
    night: { table: CHUSEOK_NIGHT_0926, suspended: range(62, 68), images: CHUSEOK_IMAGES.night0926 },
  },
  // 9/27(일) — 주간 1~34. 야간은 추석 휴평(62~91)에 심야 연장 변경분(64·83·88·91)을 덮고,
  // 새벽 열차가 9/28(월) 평일과 이어진다.
  '2026-09-27': {
    label: '추석 연휴',
    day: DAY_SHIFT,
    night: { table: CHUSEOK_NIGHT_0927, images: CHUSEOK_IMAGES.night0927 },
  },
};
