// ===== 인사 변경 (시행일 기반) =====
//
// "이 사람이 이 날부터 이렇게 된다" 를 담는다 — 근무형태(기관사/내근/인턴/휴직/병가/
// 공로연수/퇴사), 내근 직급, 그리고 그에 따라 교번 자리가 채워지거나 결원이 되는 것까지.
// 시행일 전에는 cycle.ts 의 원래 값이 그대로 보이고, 시행일이 되면 자동으로 바뀐다.
//
// 왜 필요한가
//   cycle.ts 의 P 는 "지금 이 순간"만 표현한다. 그래서 발령을 미리 반영하면 시행 전까지
//   앱이 틀린 근무자를 보여주고(교번 목록·교대자 매칭), 출근 착오로 이어질 수 있다.
//   그렇다고 시행일마다 사람이 배포를 하러 오는 것도 현실적이지 않다.
//
// 쓰는 법
//   ★ 보통은 여기를 고칠 필요가 없다 — 앱의 [설정 → 관리자 모드 → 명부 관리]에서 넣으면
//     DB(roster_changes)에 저장되고 배포 없이 시행일에 반영된다.
//   아래 배열은 그 이전에 손으로 적어 둔 것 + DB 가 없을 때의 기본값으로 남는다.

import type { Person } from '@/lib/types';

/** 근무형태 — 기관사에서 «빠지는» 쪽(휴직·병가·공로연수·퇴사·내근)과 «드는» 쪽(기관사) */
export type WorkType = 'driver' | 'office' | 'intern' | 'leave' | 'sick' | 'service' | 'resign';

/** 내근 직급 — 기관사·인턴은 직급을 쓰지 않는다 */
export type StaffRank = 'chief' | 'vice' | 'manager' | 'deputy' | 'gwajang' | 'daeri';

/**
 * 내근 업무 — 그 사람이 실제로 하는 일.
 * 예전에는 «내근» 하나로 뭉뚱그렸는데, 그러면 앱이 무슨 일을 하는지 모른다.
 */
export type Duty =
  | 'jido_bujang' | 'jiwon_gisa' | 'unyong_bujang' | 'giji_gwanje'
  | 'safety_manager' | 'seomu' | 'jido_gisa' | 'yeongyangsa';

export const DUTY_LABEL: Record<Duty, string> = {
  jido_bujang: '지도부장',
  jiwon_gisa: '지원기관사',
  unyong_bujang: '운용계획부장',
  giji_gwanje: '기지관제',
  safety_manager: '안전관리자',
  seomu: '서무',
  jido_gisa: '지도기관사',
  yeongyangsa: '영양사',
};

/** 고르는 차례 — 화면에 이 순서로 나온다 */
export const DUTY_ORDER: Duty[] = [
  'jido_bujang', 'jido_gisa', 'jiwon_gisa', 'unyong_bujang',
  'giji_gwanje', 'safety_manager', 'seomu', 'yeongyangsa',
];

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  driver: '기관사',
  office: '내근',
  intern: '인턴',
  leave: '휴직',
  sick: '병가',
  service: '공로연수',
  resign: '퇴사',
};

/** 높은 직급이 앞 — 호칭 우선순위와 같은 순서 */
export const RANK_LABEL: Record<StaffRank, string> = {
  chief: '소장',
  vice: '부소장',
  manager: '부장',
  deputy: '차장',
  gwajang: '과장',
  daeri: '대리',
};

export const RANK_ORDER: StaffRank[] = ['chief', 'vice', 'manager', 'deputy', 'gwajang', 'daeri'];

/** 기관사 자리를 차지하는 근무형태 (이것만 교번 자리에 앉는다) */
export const TAKES_SLOT: WorkType = 'driver';

/** 기관사 명단에 남는 근무형태 — 나머지는 명단에서 빠진다 */
export function staysInRoster(w: WorkType): boolean {
  return w === 'driver';
}

/** 시행일에 이 사람이 들어갈 명단 (없으면 null) */
export function joinsList(w: WorkType): 'intern' | 'extra' | null {
  if (w === 'intern') return 'intern';
  // 휴직·병가·공로연수도 «내근 화면»을 쓰는 비승무 인원으로 다룬다. 퇴사는 어디에도 안 남는다
  if (w === 'office' || w === 'leave' || w === 'sick' || w === 'service') return 'extra';
  return null;
}

export interface RosterChange {
  /** 시행일 YYYY-MM-DD — 이 날부터 적용 (KST 기준) */
  from: string;
  /** 바뀌는 사람 */
  n: string;
  s: string;
  /** 무엇이 되나 */
  work: WorkType;
  /** 내근 직급 (내근 계열만) */
  rank?: StaffRank;
  /** 내근 업무 (work === 'office' 일 때만) */
  duty?: Duty;
  /** 관련 교번 자리 = cycle.ts P 의 I. 직급만 바꾸면 없다 */
  I?: string;
  /** 시행 전 그 자리에 있던 이름 — 자리를 잘못 짚었는지 검증용 */
  replaces?: string;
  /** 기관사에서 빠질 때 그 자리가 될 결원 */
  vacancyName?: string;
  vacancySabun?: string;
  note?: string;
  /** DB 에서 온 것만 — 관리자 화면에서 지울 때 쓴다 */
  id?: number;
  by?: string;
}

/**
 * 손으로 적어 둔 변경 — 2026-08 인턴 임용까지.
 * DB(관리자 모드)가 생기기 전 기록이라 그대로 둔다. 같은 사람·같은 날이면 DB 가 이긴다.
 */
export const ROSTER_CHANGES: RosterChange[] = [
  // 2026-08-14 — 지도기관사 → 기관사 복직
  { from: '2026-08-14', I: '52', n: '김대환', s: '21706363', replaces: '결원27', work: 'driver',
    note: '지도기관사에서 기관사로 전환(복직)' },

  // 2026-08-19 — 인턴 3명 정식 기관사 임용
  { from: '2026-08-19', I: '23',  n: '김경률', s: '22600439', replaces: '결원08', work: 'driver' },
  { from: '2026-08-19', I: '165', n: '최승빈', s: '22600472', replaces: '결원04', work: 'driver' },
  { from: '2026-08-19', I: '49',  n: '박민석', s: '22600519', replaces: '결원07', work: 'driver' },

  // 2026-08-27 — 인턴 2명 정식 기관사 임용
  { from: '2026-08-27', I: '83',  n: '강미진', s: '22601008', replaces: '결원05', work: 'driver' },
  { from: '2026-08-27', I: '168', n: '한지승', s: '22601004', replaces: '결원09', work: 'driver' },
];

// ───────────────────────────────────────────────────────────
// 관리자 모드에서 넣은 변경 (DB) — 앱 시작 때 한 번 채워진다
//
// 왜 모듈 변수인가
//   명부는 getRoster() 로 **동기 호출**되는 자리가 8곳이다(교번 목록·교대자·비교 등).
//   여기를 전부 비동기로 바꾸면 화면이 잠깐 빈 채로 뜨는 위험이 커진다.
//   그래서 로그인 관문(AuthGate)에서 화면을 그리기 전에 이 값을 채워 넣고,
//   그 뒤로는 지금까지처럼 동기로 읽는다.
// ───────────────────────────────────────────────────────────
let DB_CHANGES: RosterChange[] = [];

/** 앱 시작 때 서버에서 받은 변경을 심는다 (src/lib/rosterSync.ts 가 호출) */
export function setDbRosterChanges(list: RosterChange[]): void {
  DB_CHANGES = list;
}

/** 지금 앱이 알고 있는 DB 변경 — 관리자 화면 표시용 */
export function getDbRosterChanges(): RosterChange[] {
  return DB_CHANGES;
}

/** 정적 + DB 를 합친 전체 변경. 같은 사람·같은 시행일이면 DB 가 이긴다. */
export function allChanges(): RosterChange[] {
  const seen = new Set(DB_CHANGES.map((c) => `${c.s}@${c.from}`));
  return [...ROSTER_CHANGES.filter((c) => !seen.has(`${c.s}@${c.from}`)), ...DB_CHANGES];
}

/** KST 기준 오늘 날짜 문자열 — 시행일 비교용 */
function todayKST(at: Date = new Date()): string {
  return new Date(at.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 해당 시점에 이미 시행된 변경만 — 시행일 오름차순.
 *
 * 정렬이 중요한 이유: 한 자리·한 사람이 여러 번 바뀌었으면(A→B→C) 마지막 것이 이겨야 한다.
 * 아래 적용 함수들이 순서대로 덮어쓰므로 **뒤에 오는 것이 이긴다**.
 */
export function activeChanges(at: Date = new Date()): RosterChange[] {
  const today = todayKST(at);
  return allChanges()
    .filter((c) => c.from <= today)
    .sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * P 에 시행된 변경을 반영한 명부. 원본 배열은 건드리지 않는다.
 *
 * 자리에 일어나는 일은 두 가지뿐이다.
 *   기관사가 된다  → 그 자리에 이 사람이 앉는다
 *   기관사에서 빠진다 → 그 자리가 결원이 된다
 */
export function applyRosterChanges(base: Person[], at: Date = new Date()): Person[] {
  const active = activeChanges(at);
  if (active.length === 0) return base;

  const bySlot = new Map<string, { n: string; s: string }>();
  for (const c of active) {
    if (!c.I) continue;                                    // 직급만 바꾸는 변경
    if (c.work === TAKES_SLOT) {
      bySlot.set(c.I, { n: c.n, s: c.s });
    } else if (c.vacancyName && c.vacancySabun) {
      bySlot.set(c.I, { n: c.vacancyName, s: c.vacancySabun });
    }
  }
  if (bySlot.size === 0) return base;

  return base.map((p) => {
    const hit = bySlot.get(p.I);
    return hit ? { ...p, n: hit.n, s: hit.s } : p;
  });
}

/** 시행일이 지나 그 목록에서 빠져야 하는 사번들 (기관사가 되었거나 퇴사했다) */
export function departedSabuns(list: 'intern' | 'extra', at: Date = new Date()): Set<string> {
  const out = new Set<string>();
  for (const c of activeChanges(at)) {
    const joins = joinsList(c.work);
    if (joins === list) out.delete(c.s);   // 이 목록으로 «들어오는» 사람이면 빼지 않는다
    else out.add(c.s);                     // 다른 곳으로 갔다 = 이 목록에서는 빠진다
  }
  return out;
}

/** 시행일이 지나 그 목록에 «들어와야» 하는 사람들 (기관사 → 내근·휴직 등) */
export function joinedUsers(list: 'intern' | 'extra', at: Date = new Date()): Person[] {
  const byS = new Map<string, Person>();
  for (const c of activeChanges(at)) {
    if (joinsList(c.work) === list) byS.set(c.s, { I: '0', d: '', n: c.n, s: c.s });
    else byS.delete(c.s);                  // 나중에 다른 데로 갔으면 취소
  }
  return [...byS.values()];
}

/** 시행된 업무 변경 — 사번 → 업무. 내근이 아니게 되면 업무도 사라진다 */
export function activeDuties(at: Date = new Date()): Map<string, Duty | null> {
  const m = new Map<string, Duty | null>();
  for (const c of activeChanges(at)) {
    m.set(c.s, c.work === 'office' ? (c.duty ?? null) : null);
  }
  return m;
}

/** 시행된 직급 변경 — 사번 → 직급. 뒤에 오는 것이 이긴다 */
export function activeRanks(at: Date = new Date()): Map<string, StaffRank | null> {
  const m = new Map<string, StaffRank | null>();
  for (const c of activeChanges(at)) {
    // 기관사·인턴이 되면 직급이 사라진다 — 남겨 두면 «기관사 부장님» 이 된다
    m.set(c.s, c.work === 'driver' || c.work === 'intern' ? null : (c.rank ?? null));
  }
  return m;
}
