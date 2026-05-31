/**
 * 안전 게시물 읽음 추적 — "전 직원" 정의
 * - 기준: 활성 driver_profiles
 * - 제외: 인턴 + 사용자가 지정한 미독자 허용 명단
 */

/** 인턴 사번 (auth.ts INTERN_USERS와 동기화 필수) */
export const INTERN_SABUNS: ReadonlySet<string> = new Set([
  '22600439', // 김경률
  '22600472', // 최승빈
  '22600491', // 황정욱
  '22600519', // 박민석
  '22601004', // 한지승
  '22601008', // 강미진
]);

/** 읽음 집계에서 제외할 사번 — 사용자가 명시적으로 지정 */
export const READ_TRACKING_EXCLUDED_SABUNS: ReadonlySet<string> = new Set([
  '21709649', // 조옥란
  '22200209', // 김현진
  '030827',   // jinho (테스트/개발 계정)
  '22000103', // 김다솜
]);

/** 집계 대상에서 제외해야 하는 사번 여부 */
export function isExcludedFromReadTracking(sabun: string | null | undefined): boolean {
  if (!sabun) return true;
  return INTERN_SABUNS.has(sabun) || READ_TRACKING_EXCLUDED_SABUNS.has(sabun);
}
