// ===== 교번 스케줄 코어 로직 (SSOT) =====

import type { Person, DiaType, Schedule, Segment, BannerState, BannerStateType, NextShiftInfo, MonthSummary, DaysUntilRest, Direction, DirectionInfo } from './types';
import { LABELS, DIR, dirFull, dirSub } from './constants';
import { CYCLE, DB_STD, CL, P } from '@/data/cycle';
import { HOL } from '@/data/holidays';
import { S } from '@/data/schedules';

// ===== 날짜 유틸 =====

/** 오늘 날짜 (시간 제거) */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** 공휴일 판별 (토/일 + HOL DB) */
export function isHoliday(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return true;
  const y = d.getFullYear();
  const ds = HOL[String(y)];
  if (!ds) return false;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return ds.includes(`${y}/${mm}/${dd}`);
}

// ===== 교번 계산 =====

/** 특정 인원의 특정일 교번 */
export function getDia(person: Person | null, date: Date): string {
  if (!person) return '~';
  const r = CYCLE.indexOf(person.d);
  if (r === -1) return person.d;
  const diff = Math.floor((date.getTime() - DB_STD.getTime()) / 864e5);
  return CYCLE[((r + diff) % CL + CL) % CL];
}

/** 교번 → 타입 */
export function getType(dia: string): DiaType {
  if (dia.startsWith('휴')) return 'rest';
  if (dia.endsWith('~')) return 'rest';
  if (dia.startsWith('대')) return 'standby';
  const n = parseInt(dia);
  if (n >= 62 && n <= 91) return 'night';
  if ((n >= 1 && n <= 44) || (n >= 51 && n <= 54)) return 'day';
  return 'rest';
}

/** 교번 + 날짜 → 스케줄 조회 */
export function getSchedule(dia: string, date: Date): Schedule | null {
  if (dia.startsWith('휴')) return null;
  if (dia.endsWith('~')) return null;
  const is2nd = dia.endsWith('~');
  const key = is2nd ? dia.slice(0, -1) : dia;
  const h = isHoliday(date);
  const tm = new Date(date);
  tm.setDate(tm.getDate() + 1);
  const th = isHoliday(tm);
  const isNight = getType(dia) === 'night' ||
    (dia.startsWith('대') && parseInt(dia.replace('대', '')) >= 61);
  let t: Record<string, Schedule>;
  if (!isNight) {
    t = h ? S.p_hol : S.p_ord;
  } else {
    if (h && th) t = S.p_holhol;
    else if (h && !th) t = S.p_holord;
    else if (!h && th) t = S.p_ordhol;
    else t = S.p_ordord;
  }
  const sched = t[key] || null;
  if (sched && is2nd && isNight && sched.s && sched.s.includes(':')) {
    const [hh, mm] = sched.s.split(':').map(Number);
    const total = hh * 60 + mm + 30;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return { ...sched, s: `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}` };
  }
  return sched;
}

// ===== 라벨 유틸 =====

/** 교번 → 한글 라벨 (휴무/비번/대기/야간/주간) */
export function getLabel(dia: string): string {
  if (dia.startsWith('휴')) return '휴무';
  if (dia.endsWith('~')) return '비번';
  if (dia.startsWith('대')) return '대기';
  const n = parseInt(dia);
  if (n >= 62) return '야간';
  return '주간';
}

/** DiaType → 한글 근무명 */
export function getTypeName(tp: DiaType): string {
  return ({ day: LABELS.DAY_WORK, night: LABELS.NIGHT_WORK, standby: LABELS.STANDBY_WORK } as Record<string, string>)[tp] || '';
}

/** 휴무/비번 구분 라벨 */
export function getRestLabel(dia: string): string {
  return dia.startsWith('휴') ? '휴무' : '비번';
}

/** 교번 표시명 (캘린더/주간에서 사용) */
export function getDiaDisplay(dia: string): string {
  if (dia.startsWith('휴') || dia.endsWith('~')) return getRestLabel(dia);
  return dia;
}

/** DiaType → CSS 색상 변수 */
export function getColor(t: DiaType): string {
  return ({
    day: 'var(--dia-blue)',
    night: 'var(--dia-purple)',
    rest: 'var(--dia-gray)',
    standby: 'var(--dia-orange)',
  } as Record<string, string>)[t] || 'var(--dia-gray)';
}

// ===== 시간 유틸 =====

/** "HH:MM" → 총 분 */
export function timeToMins(t: string): number {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t.replace('기', ''))) return -1;
  const clean = t.replace('기', '');
  const p = clean.split(':');
  return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
}

/** 출퇴근 시간 → 근무시간 계산 */
export function calcWorkTime(s: string, e: string): string {
  if (!s || !e || !/^\d{1,2}:\d{2}$/.test(s) || !/^\d{1,2}:\d{2}$/.test(e)) return '-';
  const sp = s.split(':');
  const ep = e.split(':');
  let sm = parseInt(sp[0]) * 60 + parseInt(sp[1]);
  let em = parseInt(ep[0]) * 60 + parseInt(ep[1]);
  if (em <= sm) em += 1440;
  const diff = em - sm;
  return Math.floor(diff / 60) + ':' + String(diff % 60).padStart(2, '0');
}

/** 스케줄에서 근무시간 추출 */
export function getWorkTime(sc: Schedule | null): string {
  if (!sc) return '-';
  if (sc.t && !/\.png$/i.test(sc.t)) return sc.t;
  return calcWorkTime(sc.s, sc.e);
}

/** 남은 시간 포맷 */
export function formatTimeUntil(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `약 ${m}분 후`;
  if (m === 0) return `약 ${h}시간 후`;
  return `약 ${h}시간 ${m}분 후`;
}

// ===== 다음 근무/배너 =====

/** 다음 근무일 탐색 (최대 7일) */
export function getNextShift(person: Person, fromDate: Date): NextShiftInfo | null {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const dia = getDia(person, d);
    const tp = getType(dia);
    if (tp !== 'rest') {
      const sc = getSchedule(dia, d);
      return { daysAhead: i, dia, schedule: sc };
    }
  }
  return null;
}

/** 근무 종료 후 상태 계산 (내부 헬퍼) */
function calcDoneState(
  nextShift: NextShiftInfo | null,
  nowMins: number,
  todayStartMins: number,
  minsAfterEnd: number,
): BannerState {
  const isDone = minsAfterEnd <= 120;
  const state: BannerStateType = isDone ? 'done' : 'idle';

  if (!nextShift || !nextShift.schedule || !nextShift.schedule.s) {
    return { state, next: nextShift, minsUntil: undefined };
  }
  const nextStartMins = timeToMins(nextShift.schedule.s);
  if (nextStartMins < 0) {
    return { state, next: nextShift, minsUntil: undefined };
  }
  let minsUntilNext: number;
  if (nextShift.daysAhead === 0) {
    minsUntilNext = todayStartMins - nowMins;
  } else if (nextShift.daysAhead === 1) {
    minsUntilNext = (1440 - nowMins) + nextStartMins;
  } else {
    minsUntilNext = ((nextShift.daysAhead - 1) * 1440) + (1440 - nowMins) + nextStartMins;
  }
  if (minsUntilNext <= 120) {
    return { state: 'preparing', next: nextShift, minsUntil: minsUntilNext };
  }
  return { state, next: nextShift, minsUntil: minsUntilNext };
}

/** 배너 상태 판별 */
export function getBannerState(
  sc: Schedule | null,
  nextShift: NextShiftInfo | null,
  now: Date,
): BannerState {
  if (!sc || !sc.s || !sc.e) return { state: 'idle', next: nextShift };
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = timeToMins(sc.s);
  const endMins = timeToMins(sc.e);
  if (startMins < 0 || endMins < 0) return { state: 'idle', next: nextShift };

  const isNight = endMins <= startMins;

  let isWorking: boolean;
  if (isNight) {
    isWorking = nowMins >= startMins || nowMins < endMins;
  } else {
    isWorking = nowMins >= startMins && nowMins < endMins;
  }
  if (isWorking) return { state: 'working', next: nextShift };

  let isBeforeShift: boolean;
  if (isNight) {
    isBeforeShift = nowMins >= endMins && nowMins < startMins;
  } else {
    isBeforeShift = nowMins < startMins;
  }

  if (isBeforeShift) {
    const minsUntilToday = startMins - nowMins;
    if (minsUntilToday <= 120) {
      const todayAsNext: NextShiftInfo = { schedule: sc, daysAhead: 0, dia: '' };
      return { state: 'preparing', next: todayAsNext, minsUntil: minsUntilToday };
    }
    if (isNight) {
      const minsAfterNight = nowMins - endMins;
      return calcDoneState(nextShift, nowMins, startMins, minsAfterNight);
    }
    // 출근 전 (2시간 이상 남음) → 아직 근무 아님
    const todayAsNext: NextShiftInfo = { schedule: sc, daysAhead: 0, dia: '' };
    return { state: 'idle', next: todayAsNext, minsUntil: startMins - nowMins };
  }

  const minsAfterEnd = nowMins - endMins;
  return calcDoneState(nextShift, nowMins, -1, minsAfterEnd);
}

/** 현재 시간 기준 진행 중/다음 구간 인덱스 + 상태 */
export function getCurrentSegmentInfo(
  segments: Segment[] | undefined,
  now: Date,
): { idx: number; status: 'running' | 'waiting' | 'before' | 'after' } | null {
  if (!segments || segments.length === 0) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (let i = 0; i < segments.length; i++) {
    const dep = timeToMins(segments[i].d);
    const arr = timeToMins(segments[i].a);
    if (dep < 0 || arr < 0) continue;
    // 현재 이 구간 운행 중
    if (nowMins >= dep && nowMins < arr) return { idx: i, status: 'running' };
    // 아직 이 구간 출발 전
    if (nowMins < dep) {
      return { idx: i, status: i === 0 ? 'before' : 'waiting' };
    }
  }
  // 모든 구간 종료
  return { idx: segments.length - 1, status: 'after' };
}

// ===== 월간/D-Day =====

/** 다음 비번까지 D-Day (최대 10일 탐색) */
export function getDaysUntilRest(person: Person, date: Date): DaysUntilRest | null {
  for (let i = 1; i <= 10; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    const dia = getDia(person, d);
    if (getType(dia) === 'rest') {
      return { days: i, dia };
    }
  }
  return null;
}

/** 월간 근무 요약 */
export function getMonthSummary(person: Person, year: number, month: number): MonthSummary {
  const result: MonthSummary = { dayWork: 0, nightWork: 0, dayStandby: 0, nightStandby: 0 };
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dia = getDia(person, date);
    const tp = getType(dia);
    if (tp === 'day') result.dayWork++;
    else if (tp === 'night') result.nightWork++;
    else if (tp === 'standby') {
      const n = parseInt(dia.replace('대', ''));
      if (n >= 61) result.nightStandby++;
      else result.dayStandby++;
    }
  }
  return result;
}

// ===== 교대 상대 찾기 =====

/** 기지 입출고 열차 판별 (1xxx/2xxx — 교대 없음) */
function isDepotTrain(trainNo: number): boolean {
  return trainNo >= 1000 && trainNo < 3000;
}

/** 교대 상대 탐색 결과 */
export interface ExchangePartner {
  left?: string;  // 내가 받을 때 상대 이름
  right?: string; // 내가 줄 때 상대 이름
}

/**
 * 교대 상대 찾기 (v1 findExchangePartners 포팅)
 * - 내 구간 첫 열차 = 상대 구간 마지막 열차 → left (내가 받음)
 * - 내 구간 마지막 열차 = 상대 구간 첫 열차 → right (내가 줌)
 * - 1xxx/2xxx 번대 열차는 기지 입출고 — 교대 없음
 */
export function findExchangePartners(
  mySchedule: Schedule,
  myPerson: Person,
  date: Date,
): Record<number, ExchangePartner> {
  const partners: Record<number, ExchangePartner> = {};
  const segs = mySchedule.g;
  if (!segs || segs.length === 0) return partners;

  // 전체 인원 스케줄을 한번에 빌드
  const allSchedules: { person: Person; schedule: Schedule }[] = [];
  for (const p of P) {
    if (p.I === myPerson.I) continue; // 자기 자신 제외
    const dia = getDia(p, date);
    const tp = getType(dia);
    if (tp === 'rest') continue;
    const sc = getSchedule(dia, date);
    if (sc && sc.g && sc.g.length > 0) {
      allSchedules.push({ person: p, schedule: sc });
    }
  }

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg.n || seg.n.length === 0) continue;
    const firstTrain = seg.n[0];
    const lastTrain = seg.n[seg.n.length - 1];
    const p: ExchangePartner = {};

    // 왼쪽: 내 첫 열차 = 상대 마지막 열차 (내가 받음)
    if (!isDepotTrain(firstTrain)) {
      for (const other of allSchedules) {
        for (const otherSeg of other.schedule.g!) {
          if (!otherSeg.n || otherSeg.n.length === 0) continue;
          const otherLast = otherSeg.n[otherSeg.n.length - 1];
          if (otherLast === firstTrain) {
            p.left = other.person.n;
            break;
          }
        }
        if (p.left) break;
      }
    }

    // 오른쪽: 내 마지막 열차 = 상대 첫 열차 (내가 줌)
    if (!isDepotTrain(lastTrain)) {
      for (const other of allSchedules) {
        for (const otherSeg of other.schedule.g!) {
          if (!otherSeg.n || otherSeg.n.length === 0) continue;
          const otherFirst = otherSeg.n[0];
          if (otherFirst === lastTrain) {
            p.right = other.person.n;
            break;
          }
        }
        if (p.right) break;
      }
    }

    if (p.left || p.right) partners[i] = p;
  }

  return partners;
}

// ===== 교대 방향 =====

/** 운전행로 문자열 → 교대 방향 판별 */
export function getRouteDirection(m: string | undefined, stationAbbr: Record<string, string>): DirectionInfo | null {
  if (!m || m.includes('충당여부') || m.includes('대휴')) return null;
  const UP = new Set(['방', '왕', '영', '여', '애', '화', '다']);
  const DOWN = new Set(['군', '마', '상', '기', '둔', '강']);
  const parts = m.split(',');
  for (const p of parts) {
    const t = p.trim();
    if (/^\d{4}$/.test(t)) continue;
    if (t.includes('편승')) continue;
    if (t[0] === '기' && !t.includes('답')) {
      return { dir: 'depot', label: dirFull('depot'), sub: dirSub('depot') };
    }
    const dIdx = t.indexOf('답');
    if (dIdx >= 0 && dIdx < t.length - 1) {
      const next = t[dIdx + 1];
      if (next === '(') continue;
      if (UP.has(next)) {
        return { dir: 'up', label: dirFull('up'), sub: dirSub('up') };
      }
      if (DOWN.has(next)) {
        return { dir: 'down', label: dirFull('down'), sub: dirSub('down') };
      }
    }
  }
  return null;
}
