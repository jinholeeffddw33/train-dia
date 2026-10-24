/**
 * 지도승무 › 담당 기관사 출입문 민원 상태 — «출입문 민원 분석 보고서»의 7단계(① 출입문 기준)를
 * 지도요원이 담당 기관사 이름 옆에서 한눈에 보게 한다.
 *
 * 열람 범위(진호 2026-10-24)
 *   - 소장·부소장·지도부장 3명(이선길·유승용·이현구) + 관리자 계정: 전체 기관사
 *   - 그 밖의 부장: 자기 담당(jido_roster.manager_name = 본인 이름) 기관사만
 *   - 기관사: 지도승무 자체를 못 연다(jidoAccess.canViewJido) — 서버가 같은 판정으로 막는다
 * 단계 값·건수는 내 정보와 같은 complaint_people 표(scripts/import-complaints.ts 로 갱신)에서 온다.
 */
import type { Stage } from '@/features/myinfo/lib/complaintStages';

/** 전체 기관사의 민원 상태를 보는 5명 — 소장·부소장·지도부장(지도·지도1·지도2) */
export const COMPLAINT_ALL_VIEWERS: ReadonlySet<string> = new Set([
  '21704630', // 안성숙 — 소장
  '21711216', // 이태원 — 부소장
  '21711197', // 이선길 — 지도2
  '21706793', // 유승용 — 지도
  '21711694', // 이현구 — 지도1
]);

export function canViewAllComplaints(sabun: string | null | undefined, role?: string | null): boolean {
  if (role === 'admin') return true;
  return !!sabun && COMPLAINT_ALL_VIEWERS.has(sabun);
}

export interface JidoComplaint {
  sabun: string;
  doorStage: Stage;
  allStage: Stage;
  doorEvents: number;
  allEvents: number;
  praise: number;
  injury: number;
  /** 집중관리 · 관찰 · '' */
  mgmt: string;
  /** 유형별 민원 건수(엑셀 「기관사별」 열 이름 → 건수) */
  types: Record<string, number>;
  mainStations: string;
  mainTimes: string;
  /** 출입문 외 불만(방송·조기출발 등) 요약 */
  otherComplaints: string;
}

export interface JidoComplaintResponse {
  /** all = 전체 기관사, mine = 내 담당만 */
  scope: 'all' | 'mine';
  periodFrom: string;
  periodTo: string;
  people: JidoComplaint[];
}

/** 심각부터, 같은 단계면 출입문 사건이 많은 순. 민원 자료가 없는 사람은 맨 뒤 */
export function compareByComplaint(
  a: JidoComplaint | undefined,
  b: JidoComplaint | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.doorStage - a.doorStage || b.doorEvents - a.doorEvents || b.allEvents - a.allEvents;
}

/** 많은 유형 위로 몇 개 — 0건은 뺀다 */
export function topTypes(types: Record<string, number>, n = 3): { key: string; count: number }[] {
  return Object.entries(types)
    .filter(([, c]) => c > 0)
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}
