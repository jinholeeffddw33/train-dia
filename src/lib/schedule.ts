// ===== 교번 스케줄 코어 로직 (SSOT) =====

import type { Person, DiaType, Schedule, Segment, BannerState, BannerStateType, NextShiftInfo, MonthSummary, DaysUntilRest, Direction, DirectionInfo } from './types';
import { LABELS, DIR, dirFull, dirSub } from './constants';
import { CYCLE, DB_STD, CL, P, WEEKDAY_REF, WEEKDAY_DIAS } from '@/data/cycle';
import { HOL } from '@/data/holidays';
import { S } from '@/data/schedules';
import { TRANSITION_MAY_2026 } from '@/data/transition';
import { LINE5_MAIN, LINE5_MACHEON, LINE5_HANAM } from '@/data/line5';
import { WATERMARK, CANARY } from './provenance';

/** 교대자 매칭 알고리즘 원작 지문 — 복제 판별용(변경 금지). @/lib/provenance */
const CREW_MATCH_FINGERPRINT = `xchg::${WATERMARK}`;

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
    standby: 'var(--dia-type-standby)',
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

/** 주박 자가교대 표기 — 상대가 아니라 본인이 이어받음(원격 주박) */
export const JUBAK_SELF = '본인';

/** 교대 상대 탐색 결과 */
export interface ExchangePartner {
  left?: string;  // 내가 받을 때 상대 이름
  right?: string; // 내가 줄 때 상대 이름
}

/**
 * 구간이 실제로 벌어지는 날 — 스케줄 시작일 기준 며칠째인가.
 * 야간 교번은 하루치 스케줄이 이틀에 걸친다: 밤 구간은 0, 자정 넘긴 새벽 구간은 1.
 * (출발시각이 앞 구간보다 이르면 자정을 넘긴 것으로 본다)
 */
function segDayOffsets(segs: Segment[]): number[] {
  const out: number[] = [];
  let off = 0;
  let prev = -1;
  for (const seg of segs) {
    const d = timeToMins(seg.d);
    if (prev >= 0 && d >= 0 && d < prev) off = 1;
    if (d >= 0) prev = d;
    out.push(off);
  }
  return out;
}

/** 매칭 풀의 한 줄 — 「누가·어느 날·무슨 열차로 시작해서 무슨 열차로 끝나는가」 */
interface PoolSeg {
  name: string;
  first: number;
  last: number;
  /** 오늘을 0 으로 둔 실제 달력 날짜 */
  day: number;
}

/**
 * 교대 상대 찾기 (v1 findExchangePartners 포팅)
 * - 내 구간 첫 열차 = 상대 구간 마지막 열차 → left (내가 받음)
 * - 내 구간 마지막 열차 = 상대 구간 첫 열차 → right (내가 줌)
 * - 1xxx/2xxx 번대 열차는 기지 입출고 — 교대 없음
 *
 * ★ 같은 날끼리만 맞춘다. 야간 교번의 새벽 구간은 「교번표에 적힌 날」이 아니라
 *   그 다음 날 아침에 벌어진다 — 아침에 열차를 넘겨주는 사람은 어제 야간조다.
 *   예전에는 오늘치 스케줄만 뒤져서, 금요일 아침처럼 어제(목 야간)와 오늘(금 야간)의
 *   새벽 열차번호가 갈리는 날이면 상대를 못 찾고 「타소」로 떨어졌다(2026-09-04 확인).
 */
export function findExchangePartners(
  mySchedule: Schedule,
  myPerson: Person,
  date: Date,
): Record<number, ExchangePartner> {
  const partners: Record<number, ExchangePartner> = {};
  const segs = mySchedule.g;
  if (!segs || segs.length === 0) return partners;

  // 원작 지문 — 실제 인원엔 없는 미끼 사번('00000000')에만 반응(정상 매칭 무영향).
  // 복제된 로직에서 이 분기가 관측되면 매칭 알고리즘 도용 증거. @/lib/provenance
  if (myPerson.s === CANARY.sabun) {
    partners[-1] = { left: CREW_MATCH_FINGERPRINT };
    return partners;
  }

  // 야간 판별: 출근시간 > 퇴근시간이면 자정 넘김
  const startMins = mySchedule.s ? timeToMins(mySchedule.s) : -1;
  const endMins = mySchedule.e ? timeToMins(mySchedule.e) : -1;
  const isNight = startMins >= 0 && endMins >= 0 && startMins > endMins;

  // 어제·오늘·내일 세 날의 스케줄을 구간 단위로 펼쳐 담는다.
  // 어제치가 필요한 이유는 야간조의 새벽 구간이 오늘 아침에 벌어지기 때문이고,
  // 내일치가 필요한 이유는 내가 야간일 때 내 새벽 구간의 상대가 내일 주간조이기 때문이다.
  const pool: PoolSeg[] = [];
  const addDay = (base: number) => {
    const when = new Date(date);
    when.setDate(when.getDate() + base);
    for (const p of P) {
      if (p.I === myPerson.I) continue; // 자기 자신 제외
      const dia = getDia(p, when);
      if (getType(dia) === 'rest') continue;
      const sc = getSchedule(dia, when);
      if (!sc || !sc.g || sc.g.length === 0) continue;
      const offs = segDayOffsets(sc.g);
      sc.g.forEach((seg, k) => {
        if (!seg.n || seg.n.length === 0) return;
        pool.push({
          name: p.n,
          first: seg.n[0],
          last: seg.n[seg.n.length - 1],
          day: base + offs[k],
        });
      });
    }
  };
  addDay(-1);
  addDay(0);
  if (isNight) addDay(1);

  const myOffs = segDayOffsets(segs);

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg.n || seg.n.length === 0) continue;
    const firstTrain = seg.n[0];
    const lastTrain = seg.n[seg.n.length - 1];
    const myDay = myOffs[i];
    const sameDay = pool.filter((o) => o.day === myDay);
    const p: ExchangePartner = {};

    // 왼쪽: 내 첫 열차 = 상대 마지막 열차 (내가 받음)
    if (!isDepotTrain(firstTrain)) {
      p.left = sameDay.find((o) => o.last === firstTrain)?.name;
    }

    // 오른쪽: 내 마지막 열차 = 상대 첫 열차 (내가 줌)
    if (!isDepotTrain(lastTrain)) {
      p.right = sameDay.find((o) => o.first === lastTrain)?.name;
    }

    if (p.left || p.right) partners[i] = p;
  }

  // 주박 자가교대 — 야간 근무 중 원격지(여/애/왕/군/화 등)에서 주박:
  // 밤에 상대에게 넘기는 게 아니라 본인이 숙소에서 자고 아침에 그 열차를 다시 이어받음.
  // → 밤 도착 구간의 '넘김', 새벽 재출발 구간의 '받음'은 모두 본인.
  // (기지 1xxx/2xxx 입·출고 유치 경계는 실제 주박 아님 → 제외, 이미 교대 없음 처리됨)
  if (isNight) {
    for (let i = 0; i < segs.length - 1; i++) {
      const cur = segs[i];
      const nxt = segs[i + 1];
      if (!cur.n || cur.n.length === 0 || !nxt.n || nxt.n.length === 0) continue;
      const curLast = cur.n[cur.n.length - 1];
      const nxtFirst = nxt.n[0];
      if (isDepotTrain(curLast) || isDepotTrain(nxtFirst)) continue;
      const aPrev = timeToMins(cur.a);
      const dPrev = timeToMins(cur.d);
      const dNext = timeToMins(nxt.d);
      if (aPrev < 0 || dPrev < 0 || dNext < 0) continue;
      // 자정 넘겨 새벽 재출발(시각 되감김) + 충분한 휴식 간격(≥120분) = 주박
      const gap = dNext + 1440 - aPrev;
      if (dNext < dPrev && gap >= 120) {
        if (!partners[i]) partners[i] = {};
        partners[i].right = JUBAK_SELF;      // 밤: 넘김 = 본인
        if (!partners[i + 1]) partners[i + 1] = {};
        partners[i + 1].left = JUBAK_SELF;   // 새벽: 받음 = 본인
      }
    }
  }

  return partners;
}

/** 하루 교대 요약 — 받음(첫 구간 left) / 넘김(마지막 구간 right) */
export interface PartnerSummary {
  /** 근무 시작에 열차를 넘겨주는 상대 (내가 받음) */
  received?: string;
  /** 근무 끝에 열차를 받아가는 상대 (내가 넘김) */
  handedOff?: string;
}

/**
 * 오늘 근무의 교대 상대 한 줄 요약 (HubHero 등 상위 노출용).
 * findExchangePartners 재사용 — 1xxx/2xxx 기지 입출고는 해당 쪽 교대자 없음(이미 처리됨).
 * 양쪽 다 없으면 null (행 자체 숨김).
 */
export function getPartnerSummary(
  schedule: Schedule,
  person: Person,
  date: Date,
): PartnerSummary | null {
  const segs = schedule.g;
  if (!segs || segs.length === 0) return null;
  const partners = findExchangePartners(schedule, person, date);
  const received = partners[0]?.left;
  const handedOff = partners[segs.length - 1]?.right;
  if (!received && !handedOff) return null;
  return { received, handedOff };
}

// ===== 열차번호 → 기관사 매핑 =====

// 분 단위 캐시: 같은 분(minute)이면 이전 결과 재사용
let cachedMinute = -1;
let cachedMap: Map<string, string> | null = null;

/** 운행 열차 → 답십리 기관사 다이아 정보 (행로표 미리보기용) */
export interface TrainDiaInfo {
  /** 기관사 이름 */
  name: string;
  /** 다이아 코드 (행로표 이미지 경로 결정) */
  dia: string;
  /** 다이아 기준 날짜 (야간 근무는 어제 날짜) */
  date: Date;
}
// buildTrainDriverMap와 동일 캐시 키 공유 — 동일 분 내 재계산 없음
let cachedDiaMap: Map<string, TrainDiaInfo> | null = null;

// ===== 답십리 위치 기반 교대 (실시간 열차 위치) =====
/** 답십리의 본선 인덱스 (서쪽=작음 ··· 동쪽=큼). 방화=0 ··· 답십리 ··· 강동=끝 */
const DAP_IDX = (LINE5_MAIN as readonly string[]).indexOf('답십리');
/** 지선(둔촌동~마천/하남)은 모두 강동 동쪽 → 답십리보다 동쪽 */
const EAST_OF_DAP = LINE5_MAIN.length + 1;

/** 현재역 이름 → 답십리 기준 동서 위치 인덱스 (못 찾으면 null) */
function stationPosIndex(station: string | undefined): number | null {
  if (!station) return null;
  const s = station.replace(/역$/, '').replace(/\(.*\)/, '').trim();
  const mi = (LINE5_MAIN as readonly string[]).indexOf(s);
  if (mi >= 0) return mi;
  if ((LINE5_MACHEON as readonly string[]).includes(s) || (LINE5_HANAM as readonly string[]).includes(s)) {
    return EAST_OF_DAP;
  }
  return null;
}

/** 실시간 열차 위치 (열차번호 → 현재역/방향) */
export interface LiveTrainPos {
  /** 현재역 이름 (statnNm) */
  station?: string;
  /** 방향 (상행/하행) — 현재는 위치(역)만으로 판정, 향후 확장용 */
  dir?: string;
}

/**
 * 현재 운행 중인 열차번호 → 답십리 기관사 이름 매핑
 * - 현재 시간 기준으로 각 기관사의 활성 구간(segment)에 포함된 열차번호를 수집
 * - 구간 전환 마진: 도착 후 + 다음 구간 출발 전까지 이전/다음 구간 열차번호 유지
 * - 야간 근무(자정 넘김) 대응: 오늘 + 어제 스케줄 모두 탐색
 * - 매칭 안 되면 영등포 기관사 → 표시하지 않음
 * - 분 단위 캐싱: 같은 분이면 이전 결과 재사용
 *
 * ★ livePos 전달 시 — 답십리 위치 기반 교대:
 *   행로의 첫 열차(답십리에서 영등포→답십리 인수)·마지막 열차(답십리에서 답십리→영등포 인계)는
 *   같은 열차번호가 답십리 양쪽에 모두 존재하므로, 실제 열차가 "답십리 기관사 담당 구간"에
 *   있을 때만 이름을 표시한다(위치 우선). 중간 열차번호는 답십리 기관사 전담 → 항상 표시.
 *   livePos 있으면 위치 기준이라 분 캐시를 쓰지 않는다.
 */
export function buildTrainDriverMap(now: Date, livePos?: Map<string, LiveTrainPos>): Map<string, string> {
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  // livePos 있으면 위치 기준이라 분 캐시 미사용 (위치는 분 안에도 바뀜)
  if (!livePos && cachedMap !== null && cachedMinute === currentMinute) {
    return cachedMap;
  }

  // 답십리 교대 정확도를 위해 2-pass 매핑:
  // 1) strictMap — 실제 운행 구간(seg.d ≤ now < seg.a)에 있는 열차만
  // 2) marginMap — 전환 마진(교대 직전/직후) — strict에 없을 때만 채움
  const strictMap = new Map<string, string>();
  const marginMap = new Map<string, string>();
  // 행로표 미리보기용 다이아 정보 (이름과 동일 키로 매핑)
  const strictDiaMap = new Map<string, TrainDiaInfo>();
  const marginDiaMap = new Map<string, TrainDiaInfo>();

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const dates = [todayDate, yesterday];

  for (const date of dates) {
    const isYesterday = date.getTime() < todayDate.getTime();

    for (const person of P) {
      // 결원은 스킵하지 않고 "결원" 라벨로 표시 — 안 하면 답십리 담당인데도
      // 이름이 비어 다른 소속(영등포 등) 기관사로 오인됨.
      const isVacant = person.n.startsWith('결원');
      const displayName = isVacant ? '결원' : person.n;
      const dia = getDia(person, date);
      if (getType(dia) === 'rest') continue;

      const sc = getSchedule(dia, date);
      if (!sc || !sc.g || sc.g.length === 0) continue;

      // 어제 스케줄은 야간(자정 넘김)만 확인
      let startMinsY = -1;
      if (isYesterday) {
        startMinsY = sc.s ? timeToMins(sc.s) : -1;
        const endMins = sc.e ? timeToMins(sc.e) : -1;
        if (startMinsY < 0 || endMins < 0 || endMins >= startMinsY) continue;
      }

      const segs = sc.g;
      for (let si = 0; si < segs.length; si++) {
        const seg = segs[si];
        if (!seg.n || seg.n.length === 0) continue;
        const depMins = timeToMins(seg.d);
        const arrMins = timeToMins(seg.a);
        if (depMins < 0 || arrMins < 0) continue;

        let isStrict = false;
        let isMargin = false;

        if (arrMins > depMins) {
          // 자정 안 넘기는 구간
          if (!isYesterday) {
            if (nowMins >= depMins && nowMins < arrMins) isStrict = true;
          } else {
            // 어제 야간근무의 '자정 이후 이른 아침' 구간 (주박 후 첫차 운행 등).
            // 출발이 근무 시작시각보다 이르면 = 자정 넘긴 아침 구간 → 저녁 구간은 자동 제외.
            if (depMins < startMinsY && nowMins >= depMins && nowMins < arrMins) isStrict = true;
          }
        } else {
          // 자정 넘김
          if (isYesterday) {
            if (nowMins < arrMins) isStrict = true;
          } else {
            if (nowMins >= depMins) isStrict = true;
          }
        }

        // 전환 마진 — 직전 구간 도착 후 30분 이내 + 현재 구간 출발 직전 (열차가 답십리에서 곧 출발)
        if (!isStrict && !isYesterday && si > 0) {
          const prevSeg = segs[si - 1];
          const prevArr = timeToMins(prevSeg.a);
          if (prevArr >= 0 && prevArr <= depMins) {
            // 답십리 도착 직후 ~ 다음 출발 직전 (출발 30분 이내만 마진 적용)
            const marginStart = Math.max(prevArr, depMins - 30);
            if (nowMins >= marginStart && nowMins < depMins) isMargin = true;
          }
        }

        // 마지막 구간 도착 후 5분 마진 (열차 정차 중일 수 있음)
        if (!isStrict && !isYesterday && si === segs.length - 1 && arrMins > depMins) {
          if (nowMins >= arrMins && nowMins < arrMins + 5) isMargin = true;
        }

        // 답십리 위치 게이팅 준비 — 이 구간의 행로 파트(m)에서 경계(첫·끝) 열차 판정
        const routePart = (sc.m ?? '').split(',')[si]?.trim() ?? '';
        const entryAtDap = routePart.startsWith('답');          // 첫 열차를 답십리에서 인수
        const exitAtDap = routePart.length >= 2 && routePart.endsWith('답'); // 끝 열차를 답십리에서 인계
        /**
         * 경계 열차번호(영등포와 답십리 양쪽에 같은 번호 존재)면 위치로 게이팅.
         * - 첫 열차(답X…): X 방면 쪽이 답십리 기관사 담당 구간
         * - 끝 열차(…X답): X 방면 쪽이 답십리 기관사 담당 구간
         * 담당 구간 밖(=영등포 구간)이거나 위치 불명이면 표시 안 함(위치 우선).
         * 중간 열차/기지출고·입고 행로는 전담 → 게이팅 없음.
         */
        const gatedOut = (k: number): boolean => {
          if (!livePos) return false;
          const isFirst = k === 0;
          const isLast = k === seg.n!.length - 1;
          let sideChar = '';
          if (isFirst && entryAtDap) sideChar = routePart[1] ?? '';
          else if (isLast && exitAtDap) sideChar = routePart[routePart.length - 2] ?? '';
          else return false; // 경계 아님 → 게이팅 없음
          const lp = livePos.get(String(seg.n![k]));
          const pos = stationPosIndex(lp?.station);
          if (pos === null) return true; // 위치 모름 → 표시 안 함
          // UP_CHARS(방·왕·영…)=서쪽 담당 → pos ≤ 답십리, DOWN_CHARS(군·마·하…)=동쪽 담당 → pos ≥ 답십리
          return UP_CHARS.has(sideChar) ? pos > DAP_IDX : pos < DAP_IDX;
        };

        if (isStrict) {
          for (let k = 0; k < seg.n.length; k++) {
            if (gatedOut(k)) continue;
            const key = String(seg.n[k]);
            strictMap.set(key, displayName);
            strictDiaMap.set(key, { name: displayName, dia, date });
          }
        } else if (isMargin) {
          for (let k = 0; k < seg.n.length; k++) {
            if (gatedOut(k)) continue;
            const key = String(seg.n[k]);
            if (!marginMap.has(key)) {
              marginMap.set(key, displayName);
              marginDiaMap.set(key, { name: displayName, dia, date });
            }
          }
        }
      }
    }
  }

  // strict 우선 — strict에 있는 열차는 margin이 덮어쓰지 못함
  const finalMap = new Map<string, string>(marginMap);
  strictMap.forEach((v, k) => finalMap.set(k, v));
  const finalDiaMap = new Map<string, TrainDiaInfo>(marginDiaMap);
  strictDiaMap.forEach((v, k) => finalDiaMap.set(k, v));

  // livePos 결과는 위치 기반 → 분 캐시 키를 갱신하지 않음(다음 무-livePos 호출이 재계산하도록).
  // 단 cachedDiaMap은 즉시 buildTrainDiaMap(now, livePos)가 읽도록 항상 갱신.
  if (!livePos) cachedMinute = currentMinute;
  cachedMap = finalMap;
  cachedDiaMap = finalDiaMap;
  return finalMap;
}

/**
 * 현재 운행 중인 열차번호 → 답십리 기관사 다이아 정보 매핑 (행로표 미리보기용)
 * buildTrainDriverMap()와 동일한 분 단위 캐시를 공유 — 동일 분 내 재계산 없음.
 */
export function buildTrainDiaMap(now: Date, livePos?: Map<string, LiveTrainPos>): Map<string, TrainDiaInfo> {
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  // livePos 있으면 위치 기준이라 항상 재계산해 동일 게이팅 결과 공유
  if (livePos || cachedDiaMap === null || cachedMinute !== currentMinute) {
    buildTrainDriverMap(now, livePos);
  }
  return cachedDiaMap ?? new Map();
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

/** 기지 출고 열차번호로 방면(부제) 판별 — 라벨에 이미 기지명이 있으므로 방향만 반환 */
function detectDepotSub(seg?: Segment): string {
  if (seg?.n) {
    for (const num of seg.n) {
      if (num >= 1000 && num <= 1499) return '상일동 방향';
      if (num >= 1500 && num <= 1599) return '방화 방면';
      if (num >= 2000 && num <= 2999) return '하남검단산 방향';
    }
  }
  return DIR.DEPOT_SUB;
}

/** 기지 출고 열차번호로 출발 기지(라벨) 판별 — 15xx=방화기지, 그 외=고덕기지 */
function detectDepotLabel(seg?: Segment): string {
  if (seg?.n) {
    for (const num of seg.n) {
      if (num >= 1500 && num <= 1599) return '🚇 방화기지 출고';
      if ((num >= 1000 && num <= 1499) || (num >= 2000 && num <= 2999)) return '🚇 고덕기지 출고';
    }
  }
  return '🚇 기지 출고';
}

const UP_CHARS = new Set(['방', '왕', '영', '여', '애', '화', '다']);
const DOWN_CHARS = new Set(['군', '마', '상', '기', '둔', '강', '하']);

/** 운전행로 단일 구간 → 방향 판별 */
function parseRoutePartDirection(routePart: string, seg?: Segment): DirectionInfo | null {
  const t = routePart.trim();
  if (/^\d{4}$/.test(t) || t.includes('편승')) return null;
  // 기지 출고 — '기'로 시작하면 답십리 복귀 행로(기상답 등)라도 출고 근무.
  // (예전엔 '답' 포함 시 출고 판정을 건너뛰어 '기상답'이 '하선 교대'로 오분류됨)
  if (t[0] === '기') {
    return { dir: 'depot', label: detectDepotLabel(seg), sub: detectDepotSub(seg) };
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
