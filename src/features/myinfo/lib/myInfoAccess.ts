/**
 * 내 정보 열람 권한 — 개인정보(민원 등급·원문·시험 점수·접속 기록)라 본인만 본다.
 * 다른 사람을 볼 수 있는 사람은 소장 · 부소장 · 관리자 계정(role=admin)뿐이다
 * (진호 2026-10-09 «소장 부소장 나(개발자) 이현구»). 2026-10-09 기준 role=admin 활성 계정은
 * 진호(030827)와 이현구(21711694) 둘이다 — 지도승무(부장 11명 전원)보다 좁다.
 *
 * 화면(사람 고르기 칸을 보일지)과 서버(API)가 같은 함수로 판정한다. 막는 곳은 서버다.
 */
import { isChief, isViceChief } from '@/lib/auth';

export function canViewOthersInfo(sabun: string | null | undefined, role?: string | null): boolean {
  if (role === 'admin') return true;
  if (!sabun) return false;
  return isChief(sabun) || isViceChief(sabun);
}

/** viewer 가 target 의 내 정보를 볼 수 있는가 */
export function canViewInfoOf(
  viewer: { sabun: string | null | undefined; role?: string | null },
  targetSabun: string,
): boolean {
  if (!viewer.sabun) return false;
  if (viewer.sabun === targetSabun) return true;
  return canViewOthersInfo(viewer.sabun, viewer.role);
}
