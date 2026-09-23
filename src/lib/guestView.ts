import type { Person } from './types';
import { getRoster } from '@/data/cycle';
import { getDia } from './schedule';
import { GUEST_DIA } from './guestAccount';

/** date 에 dia 를 타는 사람 — 명부 변경(발령)까지 반영한 명부에서 찾는다. 운휴면 null */
export function findDiaHolder(dia: string, date: Date): Person | null {
  for (const p of getRoster(date)) {
    if (getDia(p, date) === dia) return p;
  }
  return null;
}

/**
 * 체험 계정의 «나» — 그날 5다이아 기관사의 자리(I·d)를 그대로 빌린다.
 * 자리를 빌려야 교대자 계산이 그 사람을 «나»로 보고 빼 준다(PARTNER_MATCHING).
 * 사번은 체험 계정 것을 둔다 — 쓰기 주체가 실제 기관사로 잡히지 않게.
 * 결원 자리는 이름 대신 체험 계정 이름을 보인다.
 */
export function guestPerson(sabun: string, name: string, date: Date = new Date()): Person {
  const holder = findDiaHolder(GUEST_DIA, date);
  if (!holder) return { I: '0', d: '', n: name, s: sabun };
  const shownName = holder.n.startsWith('결원') ? name : holder.n;
  return { ...holder, n: shownName, s: sabun };
}
