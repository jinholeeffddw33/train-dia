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
 */

interface GroupData {
  name: string;
  /** 2026-03-01 기준 8일 주기 내 position */
  offset: number;
  /** 첫 번째 4일에 기지 배치되는 쌍 (두 번째 4일엔 본소) */
  gijiFirst: { manager: string; crew: string };
  /** 첫 번째 4일에 본소 배치되는 쌍 (두 번째 4일엔 기지) */
  bonsoFirst: { manager: string; crew: string };
  /** 기지관제 (항상 기지) */
  gwanje: [string, string];
}

const GROUPS: GroupData[] = [
  {
    name: 'A조',
    offset: 0,
    gijiFirst: { manager: '장진수', crew: '박종길' },
    bonsoFirst: { manager: '김진완', crew: '석영훈' },
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
    gijiFirst: { manager: '김봉철', crew: '김준홍' },
    bonsoFirst: { manager: '이병홍', crew: '정광구' },
    gwanje: ['정성한', '이동복'],
  },
  {
    name: 'D조',
    offset: 5,
    gijiFirst: { manager: '김재범', crew: '정용식' },
    bonsoFirst: { manager: '조재홍', crew: '한태환' },
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

/**
 * 주어진 날짜의 근무 배치 정보를 반환
 *
 * 8일 주기: [주간, 야간, ~, 휴, 주간, 야간, ~, 휴]
 *   pos 0,4: 주간 / pos 1,5: 야간 / pos 2,3,6,7: 비번
 *   pos 0-3: first-half (기지first→기지, 본소first→본소)
 *   pos 4-7: second-half (기지first→본소, 본소first→기지)
 */
export function getDutyInfo(date: Date): DutyInfo {
  const daysSince = getDaysSinceRef(date);
  const assignments: ShiftAssignment[] = [];
  const gwanje: GwanjeAssignment[] = [];

  // 월별 본소↔기지 교대: 홀수월(3,5,7...)=기본, 짝수월(4,6,8...)=뒤집힘
  // 기준: 2026-03 (홀수월) = gijiFirst→기지, bonsoFirst→본소
  const month = date.getMonth() + 1; // 1-indexed
  const isSwappedMonth = month % 2 === 0;

  for (const group of GROUPS) {
    const pos = ((daysSince + group.offset) % 8 + 8) % 8;

    const isWorking = pos === 0 || pos === 1 || pos === 4 || pos === 5;
    if (!isWorking) continue;

    const isDay = pos === 0 || pos === 4;
    const isFirstHalf = pos < 4;
    const shift = isDay ? '주간' as const : '야간' as const;

    // 짝수월이면 gijiFirst↔bonsoFirst 역할 교대
    const giji = isSwappedMonth ? group.bonsoFirst : group.gijiFirst;
    const bonso = isSwappedMonth ? group.gijiFirst : group.bonsoFirst;

    if (isFirstHalf) {
      // giji → 기지, bonso → 본소
      assignments.push({
        location: '본소',
        shift,
        manager: bonso.manager,
        crew: bonso.crew,
        group: group.name,
      });
      assignments.push({
        location: '기지',
        shift,
        manager: giji.manager,
        crew: giji.crew,
        group: group.name,
      });
    } else {
      // second-half: giji → 본소, bonso → 기지
      assignments.push({
        location: '본소',
        shift,
        manager: giji.manager,
        crew: giji.crew,
        group: group.name,
      });
      assignments.push({
        location: '기지',
        shift,
        manager: bonso.manager,
        crew: bonso.crew,
        group: group.name,
      });
    }

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
