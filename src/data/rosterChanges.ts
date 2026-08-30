// ===== 명부 변경 예약 (시행일 기반) =====
//
// 결원 자리에 사람이 들어오는 것처럼 "시행일이 정해진 명부 변경"을 여기에 적는다.
// 시행일 전에는 cycle.ts 의 원래 값(결원)이 그대로 보이고, 시행일이 되면 자동으로 바뀐다.
//
// 왜 필요한가
//   cycle.ts 의 P 는 "지금 이 순간"만 표현한다. 그래서 발령을 미리 반영하면 시행 전까지
//   앱이 틀린 근무자를 보여주고(교번 목록·교대자 매칭), 출근 착오로 이어질 수 있다.
//   그렇다고 시행일마다 사람이 배포를 하러 오는 것도 현실적이지 않다.
//
// 쓰는 법
//   ★ 이제 보통은 여기를 고칠 필요가 없다 — 앱의 [설정 → 관리자 → 명부 관리]에서 넣으면
//     DB(roster_changes)에 저장되고 배포 없이 시행일에 반영된다.
//   아래 배열은 그 이전에 손으로 적어 둔 것 + DB 가 없을 때의 기본값으로 남는다.
//   1) 배열에 한 줄 추가 (from = 시행일, I = 들어갈 자리, n/s = 들어갈 사람)
//   2) 그 사람이 INTERN_USERS / EXTRA_USERS 에 있으면 leaves 를 적는다 → 시행일에 자동 제외
//   시행일이 지나 완전히 굳으면 cycle.ts 를 직접 고치고 여기서 지워도 된다(선택).

import type { Person } from '@/lib/types';

export interface RosterChange {
  /** 시행일 YYYY-MM-DD — 이 날부터 적용 (KST 기준) */
  from: string;
  /** 들어갈 자리 = cycle.ts P 의 I */
  I: string;
  /** 들어갈 사람 */
  n: string;
  s: string;
  /** 시행 전 그 자리에 있던 이름 — 잘못 지정했는지 검증용 */
  replaces: string;
  /** 시행일에 이 목록에서 빠진다 */
  leaves?: 'intern' | 'extra';
  note?: string;
}

export const ROSTER_CHANGES: RosterChange[] = [
  // 2026-08-14 — 지도기관사 → 기관사 복직
  { from: '2026-08-14', I: '52',  n: '김대환', s: '21706363', replaces: '결원27', leaves: 'extra',
    note: '지도기관사에서 기관사로 전환(복직)' },

  // 2026-08-19 — 인턴 3명 정식 기관사 임용
  { from: '2026-08-19', I: '23',  n: '김경률', s: '22600439', replaces: '결원08', leaves: 'intern' },
  { from: '2026-08-19', I: '165', n: '최승빈', s: '22600472', replaces: '결원04', leaves: 'intern' },
  { from: '2026-08-19', I: '49',  n: '박민석', s: '22600519', replaces: '결원07', leaves: 'intern' },

  // 2026-08-27 — 인턴 2명 정식 기관사 임용
  { from: '2026-08-27', I: '83',  n: '강미진', s: '22601008', replaces: '결원05', leaves: 'intern' },
  { from: '2026-08-27', I: '168', n: '한지승', s: '22601004', replaces: '결원09', leaves: 'intern' },
];

// ───────────────────────────────────────────────────────────
// 관리자 모드에서 넣은 예약 (DB) — 앱 시작 때 한 번 채워진다
//
// 왜 모듈 변수인가
//   명부는 getRoster() 로 **동기 호출**되는 자리가 8곳이다(교번 목록·교대자·비교 등).
//   여기를 전부 비동기로 바꾸면 화면이 잠깐 빈 채로 뜨는 위험이 커진다.
//   그래서 로그인 관문(AuthGate)에서 화면을 그리기 전에 이 값을 채워 넣고,
//   그 뒤로는 지금까지처럼 동기로 읽는다.
// ───────────────────────────────────────────────────────────
let DB_CHANGES: RosterChange[] = [];

/** 앱 시작 때 서버에서 받은 예약을 심는다 (src/lib/rosterSync.ts 가 호출) */
export function setDbRosterChanges(list: RosterChange[]): void {
  DB_CHANGES = list;
}

/** 지금 앱이 알고 있는 DB 예약 — 관리자 화면 표시용 */
export function getDbRosterChanges(): RosterChange[] {
  return DB_CHANGES;
}

/** 정적 + DB 를 합친 전체 예약. 같은 자리·같은 시행일이면 DB 가 이긴다. */
export function allChanges(): RosterChange[] {
  const seen = new Set(DB_CHANGES.map((c) => `${c.I}@${c.from}`));
  return [...ROSTER_CHANGES.filter((c) => !seen.has(`${c.I}@${c.from}`)), ...DB_CHANGES];
}

/** KST 기준 오늘 날짜 문자열 — 시행일 비교용 */
function todayKST(at: Date = new Date()): string {
  return new Date(at.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 해당 시점에 이미 시행된 변경만 — 시행일 오름차순.
 *
 * 정렬이 중요한 이유: 한 자리가 여러 번 바뀌었으면(A→B→C) 마지막 것이 이겨야 한다.
 * applyRosterChanges 가 Map 에 덮어쓰는 방식이라 **뒤에 오는 것이 이긴다**.
 */
export function activeChanges(at: Date = new Date()): RosterChange[] {
  const today = todayKST(at);
  return allChanges()
    .filter((c) => c.from <= today)
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** P 에 시행된 변경을 반영한 명부. 원본 배열은 건드리지 않는다. */
export function applyRosterChanges(base: Person[], at: Date = new Date()): Person[] {
  const active = activeChanges(at);
  if (active.length === 0) return base;
  const byI = new Map(active.map((c) => [c.I, c]));
  return base.map((p) => {
    const c = byI.get(p.I);
    return c ? { ...p, n: c.n, s: c.s } : p;
  });
}

/** 시행일이 지나 그 목록에서 빠져야 하는 사번들 */
export function departedSabuns(list: 'intern' | 'extra', at: Date = new Date()): Set<string> {
  return new Set(activeChanges(at).filter((c) => c.leaves === list).map((c) => c.s));
}
