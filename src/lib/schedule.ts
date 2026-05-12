// ===== 교번 스케줄 코어 로직 (SSOT) =====

import type { Person, DiaType, Schedule, Segment, BannerState, BannerStateType, NextShiftInfo, MonthSummary, DaysUntilRest, Direction, DirectionInfo } from './types';
import { LABELS, DIR, dirFull, dirSub } from './constants';
import { CYCLE, DB_STD, CL, P, WEEKDAY_REF, WEEKDAY_DIAS } from '@/data/cycle';
import { HOL } from '@/data/holidays';
import { S } from '@/data/schedules';
import { TRANSITION_MAY_2026 } from '@/data/transition';

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

/** 비공휴일 평일 수 카운트 (from ~ to, from 불포함, to 포함) */
function countWeekdays(from: Date, to: Date): number {
  const dir = to >= from ? 1 : -1;
  const start = new Date(from);
  let count = 0;
  const d = new Date(start);
  if (dir === 1) {
    d.setDate(d.getDate() + 1);
    while (d <= to) {
      if (!isHoliday(d)) count++;
      d.setDate(d.getDate() + 1);
    }
  } else {
    while (d > to) {
      if (!isHoliday(d)) count--;
      d.setDate(d.getDate() - 1);
    }
  }
  return count;
}

/** 특정 인원의 특정일 교번 */
export function getDia(person: Person | null, date: Date): string {
  if (!person) return '~';
  // 통상근무 기관사 (평일 51-54 순환)
  if (person.w !== undefined) {
    if (isHoliday(date)) return '휴일';
    const wd = countWeekdays(WEEKDAY_REF, date);
    return WEEKDAY_DIAS[((wd + person.w) % 4 + 4) % 4];
  }
  // 2026년 5월 1~31일 전체 transition (0515 보완 근무계획 그대로)
  // 6/1부터는 새 CYCLE (DB_STD=2026-05-16) 패턴이 정상 적용됨
  if (date.getFullYear() === 2026 && date.getMonth() === 4) {
    const day = date.getDate();
    if (day >= 1 && day <= 31 && person.s) {
      const tr = TRANSITION_MAY_2026[person.s];
      if (tr && tr[day - 1]) return tr[day - 1];
    }
  }
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
  if ((n >= 1 && n <= 43) || (n >= 51 && n <= 54)) return 'day';
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

/** 운휴/대휴 판별 — 스케줄의 s 필드가 운휴/대휴로 시작하면 true */
export function isSpecialRest(schedule: Schedule | null): boolean {
  if (!schedule || !schedule.s) return false;
  return schedule.s.startsWith('운휴') || schedule.s.startsWith('대휴');
}

/** 운휴/대휴 라벨 반환 */
export function getSpecialRestLabel(schedule: Schedule | null): string {
  if (!schedule || !schedule.s) return '';
  if (schedule.s.startsWith('운휴')) return '운휴';
  if (schedule.s.startsWith('대휴')) return '대휴';
  return '';
}

/** 기지 출근 DIA 판별 — 평일: 7,12,18 / 휴일: 16,19 */
export function isDepotStart(dia: string, date: Date): boolean {
  const n = parseInt(dia);
  if (isNaN(n)) return false;
  if (isHoliday(date)) {
    return n === 16 || n === 19;
  }
  return n === 7 || n === 12 || n === 18;
}

/** DiaType → 한글 근무명 */
export function getTypeName(tp: DiaType): string {
  return ({ day: LABELS.DAY_WORK, night: LABELS.NIGHT_WORK, standby: LABELS.STANDBY_WORK } as Record<string, string>)[tp] || '';
}

/** 휴무/비번 구분 라벨 */
export function getRestLabel(dia: string): string {
  return dia.startsWith('휴') ? '휴무' : '비번';
}

/** 교번 표시명 (일반용 — 휴무/비번 라벨만) */
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
  if (sc.w) return sc.w;
  if (sc.t && !/\.png$/i.test(sc.t)) return sc.t;
  return calcWorkTime(sc.s, sc.e);
}

/** 남은 시간 포맷 */
export function formatTimeUntil(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return '';
  if (mins <= 0) return '지금';
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
    // 출근 전 (2시간 이상 남음) → 오늘 근무 대기 (야간/주간 공통)
    const todayAsNext: NextShiftInfo = { schedule: sc, daysAhead: 0, dia: '' };
    return { state: 'idle', next: todayAsNext, minsUntil: startMins - nowMins };
  }

  const minsAfterEnd = nowMins - endMins;
  return calcDoneState(nextShift, nowMins, -1, minsAfterEnd);
}

/** 구간 시각을 야간 교번 대응 보정 분(minute)으로 변환 */
function buildAdjustedTimes(segments: Segment[]): { dep: number; arr: number }[] {
  const result: { dep: number; arr: number }[] = [];
  for (let i = 0; i < segments.length; i++) {
    let dep = timeToMins(segments[i].d);
    let arr = timeToMins(segments[i].a);
    if (dep < 0 || arr < 0) { result.push({ dep, arr }); continue; }
    // 이전 구간 도착보다 4시간 이상 이르면 → 익일
    if (i > 0 && result[i - 1].dep >= 0 && dep < result[i - 1].arr - 240) {
      dep += 1440; arr += 1440;
    }
    // 도착이 출발보다 이르면 → 자정 넘김
    if (arr < dep) arr += 1440;
    result.push({ dep, arr });
  }
  return result;
}

/** 현재 시간 기준 진행 중/다음 구간 인덱스 + 상태 (야간 교번 대응) */
export function getCurrentSegmentInfo(
  segments: Segment[] | undefined,
  now: Date,
  scheduleStart?: string,
): { idx: number; status: 'running' | 'waiting' | 'before' | 'after' } | null {
  if (!segments || segments.length === 0) return null;
  let nowMins = now.getHours() * 60 + now.getMinutes();

  const adj = buildAdjustedTimes(segments);
  // 야간 교번: 오후 출근인데 현재가 오전(< 12시)이면 → 익일 판정
  if (scheduleStart) {
    const startMins = timeToMins(scheduleStart);
    if (startMins >= 720 && nowMins < startMins && nowMins < 720) {
      nowMins += 1440;
    }
  } else if (adj.length > 0 && adj[0].dep >= 720 && nowMins < 720) {
    nowMins += 1440;
  }

  for (let i = 0; i < adj.length; i++) {
    const { dep, arr } = adj[i];
    if (dep < 0 || arr < 0) continue;
    if (nowMins >= dep && nowMins < arr) return { idx: i, status: 'running' };
    if (nowMins < dep) {
      return { idx: i, status: i === 0 ? 'before' : 'waiting' };
    }
  }
  return { idx: adj.length - 1, status: 'after' };
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

  // 야간 판별: 출근시간 > 퇴근시간이면 자정 넘김
  const startMins = mySchedule.s ? timeToMins(mySchedule.s) : -1;
  const endMins = mySchedule.e ? timeToMins(mySchedule.e) : -1;
  const isNight = startMins >= 0 && endMins >= 0 && startMins > endMins;

  // 전체 인원 스케줄을 한번에 빌드 (같은 날)
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

  // 야간이면 다음 날 스케줄도 풀에 추가 (2근무 아침 교대 매칭용)
  if (isNight) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    for (const p of P) {
      if (p.I === myPerson.I) continue;
      const dia = getDia(p, nextDay);
      const tp = getType(dia);
      if (tp === 'rest') continue;
      const sc = getSchedule(dia, nextDay);
      if (sc && sc.g && sc.g.length > 0) {
        allSchedules.push({ person: p, schedule: sc });
      }
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

// ===== 열차번호 → 기관사 매핑 =====

// 분 단위 캐시: 같은 분(minute)이면 이전 결과 재사용
let cachedMinute = -1;
let cachedMap: Map<string, string> | null = null;

/**
 * 현재 운행 중인 열차번호 → 답십리 기관사 이름 매핑
 * - 현재 시간 기준으로 각 기관사의 활성 구간(segment)에 포함된 열차번호를 수집
 * - 구간 전환 마진: 도착 후 + 다음 구간 출발 전까지 이전/다음 구간 열차번호 유지
 * - 야간 근무(자정 넘김) 대응: 오늘 + 어제 스케줄 모두 탐색
 * - 매칭 안 되면 영등포 기관사 → 표시하지 않음
 * - 분 단위 캐싱: 같은 분이면 이전 결과 재사용
 */
export function buildTrainDriverMap(now: Date): Map<string, string> {
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  if (cachedMap !== null && cachedMinute === currentMinute) {
    return cachedMap;
  }
  const map = new Map<string, string>();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 어제 날짜 (야간 근무 자정 넘김 대응)
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);

  const dates = [todayDate, yesterday];

  for (const date of dates) {
    const isYesterday = date.getTime() < todayDate.getTime();

    for (const person of P) {
      if (person.n.startsWith('결원')) continue;
      const dia = getDia(person, date);
      const tp = getType(dia);
      if (tp === 'rest') continue;

      const sc = getSchedule(dia, date);
      if (!sc || !sc.g || sc.g.length === 0) continue;

      // 어제 스케줄은 야간(자정 넘김)만 확인
      if (isYesterday) {
        const startMins = sc.s ? timeToMins(sc.s) : -1;
        const endMins = sc.e ? timeToMins(sc.e) : -1;
        if (startMins < 0 || endMins < 0 || endMins >= startMins) continue; // 야간 아님
      }

      const segs = sc.g;
      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si];
        if (!seg.n || seg.n.length === 0) continue;
        const depMins = timeToMins(seg.d);
        const arrMins = timeToMins(seg.a);
        if (depMins < 0 || arrMins < 0) continue;

        let isActive = false;

        if (arrMins > depMins) {
          // 같은 날 구간
          if (!isYesterday && nowMins >= depMins && nowMins < arrMins) {
            isActive = true;
          }
        } else {
          // 자정 넘김 구간 (예: 23:00 ~ 02:00)
          if (isYesterday) {
            if (nowMins < arrMins) isActive = true;
          } else {
            if (nowMins >= depMins) isActive = true;
          }
        }

        // 구간 전환 마진: 이전 구간 도착 ~ 현재 구간 출발 사이에도 양쪽 열차번호 유지
        if (!isActive && !isYesterday && si > 0) {
          const prevSeg = segs[si - 1];
          const prevArr = timeToMins(prevSeg.a);
          if (prevArr >= 0 && prevArr <= depMins && nowMins >= prevArr && nowMins < depMins) {
            // 이전 구간 도착 후 ~ 현재 구간 출발 전 (전환 시간)
            // 현재 구간 열차번호도 매핑 (곧 탈 열차)
            isActive = true;
          }
        }

        // 마지막 구간 도착 후 5분 마진 (열차가 아직 역에 정차 중일 수 있음)
        if (!isActive && !isYesterday && si === segs.length - 1 && arrMins > depMins) {
          if (nowMins >= arrMins && nowMins < arrMins + 5) {
            isActive = true;
          }
        }

        if (isActive) {
          for (const trainNo of seg.n) {
            map.set(String(trainNo), person.n);
          }
        }
      }
    }
  }

  cachedMinute = currentMinute;
  cachedMap = map;
  return map;
}

// ===== 교대 방향 =====

/** 열차번호로 하선 분기 판별 (마천 / 하남검단산) */
function detectDownBranch(seg?: Segment): string {
  if (seg?.n) {
    for (const num of seg.n) {
      if (num >= 5000 && num <= 5499) return '하남검단산 방면 승강장';
      if (num >= 5500 && num <= 5899) return '마천 방면 승강장';
    }
  }
  return DIR.DOWN_SUB;
}

/** 열차번호로 기지 출고 방면 판별 */
function detectDepotSub(seg?: Segment): string {
  if (seg?.n) {
    for (const num of seg.n) {
      if (num >= 1000 && num <= 1499) return '고덕기지 출발 · 상일동 방향';
      if (num >= 1500 && num <= 1599) return '방화기지 출발';
      if (num >= 2000 && num <= 2999) return '고덕기지 출발 · 하남검단산 방향';
    }
  }
  return DIR.DEPOT_SUB;
}

const UP_CHARS = new Set(['방', '왕', '영', '여', '애', '화', '다']);
const DOWN_CHARS = new Set(['군', '마', '상', '기', '둔', '강', '하']);

/** 운전행로 단일 구간 → 방향 판별 */
function parseRoutePartDirection(routePart: string, seg?: Segment): DirectionInfo | null {
  const t = routePart.trim();
  if (/^\d{4}$/.test(t) || t.includes('편승')) return null;
  // 기지 출발 (답 미포함: 순수 기지 이동)
  if (t[0] === '기' && !t.includes('답')) {
    return { dir: 'depot', label: dirFull('depot'), sub: detectDepotSub(seg) };
  }
  const dIdx = t.indexOf('답');
  // "답X..." → 답십리에서 X 방향으로 출발
  if (dIdx >= 0 && dIdx < t.length - 1) {
    const next = t[dIdx + 1];
    if (next === '(') return null;
    if (UP_CHARS.has(next)) {
      return { dir: 'up', label: dirFull('up'), sub: dirSub('up') };
    }
    if (DOWN_CHARS.has(next)) {
      return { dir: 'down', label: dirFull('down'), sub: detectDownBranch(seg) };
    }
  }
  // "...X답" → X 방면에서 답십리로 도착 (기지출발 행로 등)
  if (dIdx > 0 && dIdx === t.length - 1) {
    const prev = t[dIdx - 1];
    if (UP_CHARS.has(prev)) {
      return { dir: 'up', label: dirFull('up'), sub: dirSub('up') };
    }
    if (DOWN_CHARS.has(prev)) {
      return { dir: 'down', label: dirFull('down'), sub: detectDownBranch(seg) };
    }
  }
  return null;
}

/** 운전행로 문자열 → 교대 방향 판별 (전체 스케줄 기준, 첫 방향) */
export function getRouteDirection(m: string | undefined, stationAbbr: Record<string, string>, segments?: Segment[]): DirectionInfo | null {
  if (!m || m.includes('충당여부') || m.includes('대휴')) return null;
  const parts = m.split(',');
  for (let i = 0; i < parts.length; i++) {
    const result = parseRoutePartDirection(parts[i], segments?.[i]);
    if (result) return result;
  }
  return null;
}

/** 특정 구간(segIndex) 기준 방향 판별 */
export function getSegmentDirection(m: string | undefined, segIndex: number, segments?: Segment[]): DirectionInfo | null {
  if (!m || m.includes('충당여부') || m.includes('대휴')) return null;
  const parts = m.split(',');
  // 해당 구간의 행로 파트 사용
  if (segIndex < parts.length) {
    const result = parseRoutePartDirection(parts[segIndex], segments?.[segIndex]);
    if (result) return result;
  }
  // 폴백: 전체에서 첫 번째 방향
  for (let i = 0; i < parts.length; i++) {
    const result = parseRoutePartDirection(parts[i], segments?.[i]);
    if (result) return result;
  }
  return null;
}
