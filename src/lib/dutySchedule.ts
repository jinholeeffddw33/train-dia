/**
 * 운용계획부장 및 지원기관사 근무 배치 계산
 *
 * 4개조(A~D)가 8일 주기로 순환하며, 매일:
 *   - 1개조 주간근무, 1개조 야간근무, 2개조 휴무
 * 각 조 내:
 *   - 운용부장 2명 + 지원승무원 2명 → 본소/기지 교대
 *   - 기지관제 2명 → 항상 기지
 *
 * 기준일: 2026-03-01 (A조 position 0)
 *
 * ── 2026-10 사업소 근무계획(2~12월)과 맞춘 규칙 ──
 * 예전엔 «짝수 달마다 본소↔기지를 통째로 뒤집는다»고 보고, 부장과 지원기관사 짝도 달리 묶었다.
 * 실제 계획표는 월이 바뀌어도 뒤집지 않고 8일 주기가 그대로 이어진다(본소 2일 → 쉼 2일 → 기지 2일 → 쉼 2일).
 * 그래서 부장은 짝수 달, 지원기관사는 홀수 달에 본소/기지가 반대로 나왔다.
 * 같은 곳에서 함께 근무하는 짝도 계획표 기준으로 바로잡았다(예: A조 장진수+석영훈, 김진완+박종길).
 * 계획표의 «지원» 근무(그달 1회 지원근무)는 앱에서 다루지 않는다 — 휴무로 보인다.
 *
 * ── 계획표가 있는 달은 계획표 그대로 ──
 * 부장은 일정한 8일 사이클로 움직이지만, 지원기관사는 달이 바뀌면 같은 조의 다른 부장과
 * 짝이 될 수 있다(2026-10 B조). 미리 계산할 수 없으므로 사업소 월별 계획표(src/data/officeDutyPlan.ts)가
 * 있는 달은 그 표를 그대로 쓰고, 표가 없는 달만 아래 규칙으로 계산한다.
 */
import { OFFICE_DUTY_PLAN } from '@/data/officeDutyPlan';

interface Pair { manager: string; crew: string }

interface GroupData {
  name: string;
  /** 2026-03-01 기준 8일 주기 내 position */
  offset: number;
  /** 첫 번째 4일에 기지 배치되는 쌍 (두 번째 4일엔 본소) */
  gijiFirst: Pair;
  /** 첫 번째 4일에 본소 배치되는 쌍 (두 번째 4일엔 기지) */
  bonsoFirst: Pair;
  /** 기지관제 (항상 기지) */
  gwanje: [string, string];
}

const GROUPS: GroupData[] = [
  {
    name: 'A조',
    offset: 0,
    gijiFirst: { manager: '장진수', crew: '석영훈' },
    bonsoFirst: { manager: '김진완', crew: '박종길' },
    gwanje: ['현덕일', '박용덕'],
  },
  {
    name: 'B조',
    offset: 7,
    gijiFirst: { manager: '김창환', crew: '이수윤' },
    bonsoFirst: { manager: '최승곤', crew: '반헌준' },
    gwanje: ['전동규', '윤경일'],
  },
  {
    name: 'C조',
    offset: 6,
    gijiFirst: { manager: '김봉철', crew: '정광구' },
    bonsoFirst: { manager: '이병홍', crew: '김준홍' },
    gwanje: ['정성한', '이동복'],
  },
  {
    name: 'D조',
    offset: 5,
    gijiFirst: { manager: '김재범', crew: '한태환' },
    bonsoFirst: { manager: '조재홍', crew: '정용식' },
    gwanje: ['신제윤', '이승훈'],
  },
];

// 기준일: 2026년 3월 1일
const REF_YEAR = 2026;
const REF_MONTH = 2; // 0-indexed
const REF_DAY = 1;

export interface ShiftAssignment {
  location: '본소' | '기지';
  shift: '주간' | '야간';
  manager: string;
  crew: string;
  group: string;
}

export interface GwanjeAssignment {
  shift: '주간' | '야간';
  names: [string, string];
  group: string;
}

export interface DutyInfo {
  assignments: ShiftAssignment[];
  gwanje: GwanjeAssignment[];
}

function getDaysSinceRef(date: Date): number {
  const ref = new Date(REF_YEAR, REF_MONTH, REF_DAY);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

/** 그 달의 사업소 계획표 (없으면 null → 규칙으로 계산) */
function planOf(date: Date): Record<string, string> | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return OFFICE_DUTY_PLAN[key] ?? null;
}

/** 계획표 한 글자: A 본소 주간 · B 본소 야간 · a 기지 주간 · b 기지 야간 · ~ 비번 · . 휴무 */
function planCode(plan: Record<string, string>, name: string, date: Date): string | undefined {
  return plan[name]?.[date.getDate() - 1];
}

const shiftOfCode = (c: string): '주간' | '야간' => (c === 'A' || c === 'a' ? '주간' : '야간');
const locOfCode = (c: string): '본소' | '기지' => (c === 'A' || c === 'B' ? '본소' : '기지');
const isWorkCode = (c: string | undefined): c is string => !!c && 'ABab'.includes(c);

/** 계획표가 있는 날 — 표에 적힌 그대로 짝을 짓는다(같은 곳·같은 근무의 부장과 지원기관사) */
function dutyInfoFromPlan(plan: Record<string, string>, date: Date): DutyInfo {
  const assignments: ShiftAssignment[] = [];
  const gwanje: GwanjeAssignment[] = [];
  for (const group of GROUPS) {
    const managers = [group.gijiFirst.manager, group.bonsoFirst.manager];
    const crews = [group.gijiFirst.crew, group.bonsoFirst.crew];
    const usedCrew = new Set<string>();
    const mine: ShiftAssignment[] = [];
    for (const m of managers) {
      const c = planCode(plan, m, date);
      if (!isWorkCode(c)) continue;
      const crew = crews.find((x) => !usedCrew.has(x) && planCode(plan, x, date) === c) ?? '';
      if (crew) usedCrew.add(crew);
      mine.push({ location: locOfCode(c), shift: shiftOfCode(c), manager: m, crew, group: group.name });
    }
    // 부장 없이 지원기관사만 근무하는 경우(표에 드물게) — 빠뜨리지 않는다
    for (const x of crews) {
      const c = planCode(plan, x, date);
      if (usedCrew.has(x) || !isWorkCode(c)) continue;
      mine.push({ location: locOfCode(c), shift: shiftOfCode(c), manager: '', crew: x, group: group.name });
    }
    // 규칙으로 만들 때와 같은 차례 — 조마다 본소 먼저
    mine.sort((a, b) => (a.location === b.location ? 0 : a.location === '본소' ? -1 : 1));
    assignments.push(...mine);
    const g0 = planCode(plan, group.gwanje[0], date);
    const g1 = planCode(plan, group.gwanje[1], date);
    const gc = isWorkCode(g0) ? g0 : isWorkCode(g1) ? g1 : undefined;
    if (gc) gwanje.push({ shift: shiftOfCode(gc), names: group.gwanje, group: group.name });
  }
  return { assignments, gwanje };
}

/**
 * 주어진 날짜의 근무 배치 정보를 반환
 *
 * 8일 주기: [주간, 야간, ~, 휴, 주간, 야간, ~, 휴]
 *   pos 0,4: 주간 / pos 1,5: 야간 / pos 2,3,6,7: 비번
 *   pos 0-3: first-half (기지first→기지, 본소first→본소)
 *   pos 4-7: second-half (기지first→본소, 본소first→기지)
 */
export function getDutyInfo(date: Date): DutyInfo {
  const plan = planOf(date);
  if (plan) return dutyInfoFromPlan(plan, date);

  const daysSince = getDaysSinceRef(date);
  const assignments: ShiftAssignment[] = [];
  const gwanje: GwanjeAssignment[] = [];

  for (const group of GROUPS) {
    const pos = ((daysSince + group.offset) % 8 + 8) % 8;

    const isWorking = pos === 0 || pos === 1 || pos === 4 || pos === 5;
    if (!isWorking) continue;

    const isDay = pos === 0 || pos === 4;
    const isFirstHalf = pos < 4;
    const shift = isDay ? '주간' as const : '야간' as const;

    const giji = group.gijiFirst;
    const bonso = group.bonsoFirst;
    // 앞 4일: giji 쌍이 기지 / 뒤 4일: 서로 바꾼다
    const atBonso = isFirstHalf ? bonso : giji;
    const atGiji = isFirstHalf ? giji : bonso;

    assignments.push({ location: '본소', shift, manager: atBonso.manager, crew: atBonso.crew, group: group.name });
    assignments.push({ location: '기지', shift, manager: atGiji.manager, crew: atGiji.crew, group: group.name });

    gwanje.push({
      shift,
      names: group.gwanje,
      group: group.name,
    });
  }

  return { assignments, gwanje };
}

export type MyDuty =
  | { location: '본소' | '기지' | '기지관제'; shift: '주간' | '야간' }
  | 'standby'  // 비번 (야간 다음날)
  | 'rest';    // 휴무

/** 내근직 개인 근무 조회 — 이름으로 그 날짜의 배치 찾기 */
export function findDutyByName(name: string, date: Date): MyDuty {
  // 계획표가 있는 달 — 그 사람 칸을 그대로 읽는다
  const plan = planOf(date);
  const code = plan ? planCode(plan, name, date) : undefined;
  if (code !== undefined) {
    if (code === '~') return 'standby';
    if (!isWorkCode(code)) return 'rest';
    const isGwanje = GROUPS.some((g) => g.gwanje.includes(name));
    return { location: isGwanje ? '기지관제' : locOfCode(code), shift: shiftOfCode(code) };
  }

  const info = getDutyInfo(date);
  for (const a of info.assignments) {
    if (a.manager === name || a.crew === name) {
      return { location: a.location, shift: a.shift };
    }
  }
  for (const g of info.gwanje) {
    if (g.names[0] === name || g.names[1] === name) {
      return { location: '기지관제', shift: g.shift };
    }
  }
  // 근무 아님 → 조 소속 찾아서 pos로 비번/휴무 구분
  // 8일 주기: [주간, 야간, 비번, 휴무, 주간, 야간, 비번, 휴무]
  const daysSince = getDaysSinceRef(date);
  for (const group of GROUPS) {
    const inGroup =
      group.gijiFirst.manager === name || group.gijiFirst.crew === name ||
      group.bonsoFirst.manager === name || group.bonsoFirst.crew === name ||
      group.gwanje[0] === name || group.gwanje[1] === name;
    if (!inGroup) continue;
    const pos = ((daysSince + group.offset) % 8 + 8) % 8;
    if (pos === 2 || pos === 6) return 'standby';
    if (pos === 3 || pos === 7) return 'rest';
  }
  return 'rest';
}
