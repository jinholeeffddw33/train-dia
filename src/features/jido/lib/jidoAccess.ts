/**
 * 지도승무 열람 권한 — 소장·부소장·부장(지도부장·운용계획부장)만.
 *
 * 지도승무 기록은 지도요원이 보는 것이다(진호 2026-10-02 «지도부장·부소장·소장만 열람»).
 * 승무원지도운용내규 제3조의 지도요원 = 부사업소장·운용계획담당부장·지도담당부장이라
 * 부장 11명을 모두 넣었다. 개발자 계정(role=admin)은 관리를 위해 들어갈 수 있다.
 * 화면(버튼 보이기)과 서버(API)가 같은 함수로 판정한다.
 */
import { isChief, isViceChief, isManager } from '@/lib/auth';

export function canViewJido(sabun: string | null | undefined, role?: string | null): boolean {
  if (role === 'admin') return true;
  if (!sabun) return false;
  return isChief(sabun) || isViceChief(sabun) || isManager(sabun);
}
