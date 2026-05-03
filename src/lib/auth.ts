import { P } from '@/data/cycle';
import type { Person } from '@/lib/types';

export const EXTRA_USERS: Person[] = [
  { I: '0', d: '', n: '이현구', s: '21711694' },
  { I: '0', d: '', n: '강병우', s: '21714898' },
  { I: '0', d: '', n: '석영훈', s: '21715437' },
  { I: '0', d: '', n: '김준홍', s: '21715494' },
  { I: '0', d: '', n: '김민정', s: '21715676' },
  { I: '0', d: '', n: '최창욱', s: '21715684' },
  { I: '0', d: '', n: '이민우', s: '21716991' },
  { I: '0', d: '', n: '한태환', s: '21713547' },
  { I: '0', d: '', n: '반헌준', s: '21713554' },
  { I: '0', d: '', n: '신승헌', s: '21713568' },
  { I: '0', d: '', n: '정광구', s: '21714013' },
  { I: '0', d: '', n: '정용식', s: '21714357' },
  { I: '0', d: '', n: '이수윤', s: '21714586' },
  { I: '0', d: '', n: '김다솜', s: '22000103' },
  { I: '0', d: '', n: '김현진', s: '22200209' },
  { I: '0', d: '', n: '황선호', s: '21717719' },
  { I: '0', d: '', n: '이지훈', s: '21900305' },
  { I: '0', d: '', n: '장진수', s: '21707096' },
  { I: '0', d: '', n: '김봉철', s: '21707406' },
  { I: '0', d: '', n: '김창환', s: '21707420' },
  { I: '0', d: '', n: '김성준A', s: '21703825' },
  { I: '0', d: '', n: '안성숙', s: '21704630' },
  { I: '0', d: '', n: '최승곤', s: '21706206' },
  { I: '0', d: '', n: '이병홍', s: '21706208' },
  { I: '0', d: '', n: '윤경일', s: '21706306' },
  { I: '0', d: '', n: '현덕일', s: '21706327' },
  { I: '0', d: '', n: '김대환', s: '21706363' },
  { I: '0', d: '', n: '김재범', s: '21707084' },
  { I: '0', d: '', n: '조재홍', s: '21709373' },
  { I: '0', d: '', n: '이승훈', s: '21711443' },
  { I: '0', d: '', n: '박종길', s: '21711719' },
  { I: '0', d: '', n: '김건래', s: '21711811' },
  { I: '0', d: '', n: '조효진', s: '21709378' },
  { I: '0', d: '', n: '신제윤', s: '21709575' },
  { I: '0', d: '', n: '김진완', s: '21709589' },
  { I: '0', d: '', n: '김윤수', s: '21709608' },
  { I: '0', d: '', n: '정성한', s: '21709635' },
  { I: '0', d: '', n: '조옥란', s: '21709649' },
  { I: '0', d: '', n: '이동복', s: '21710720' },
  { I: '0', d: '', n: '이선길', s: '21711197' },
  { I: '0', d: '', n: '전동규', s: '21711304' },
  { I: '0', d: '', n: '박용덕', s: '21711438' },
];

/** 2026년 신규임용 인턴사원 (2026.4.30. 자) — 교번 미배정 상태, 내근직 아님 */
export const INTERN_USERS: Person[] = [
  { I: '0', d: '', n: '이지은', s: '22600393' },
  { I: '0', d: '', n: '손예빈', s: '22600418' },
  { I: '0', d: '', n: '김경률', s: '22600439' },
  { I: '0', d: '', n: '최승빈', s: '22600472' },
  { I: '0', d: '', n: '황정욱', s: '22600491' },
  { I: '0', d: '', n: '박민석', s: '22600519' },
];

const ALL_USERS = [...P, ...EXTRA_USERS, ...INTERN_USERS];

/** 관리자 사번 목록 (21명) */
const ADMIN_SABUNS = new Set([
  '21704630', // 안성숙
  '21711694', // 이현구
  '21711197', // 이선길
  '21714898', // 강병우
  '21713568', // 신승헌
  '21707096', // 장진수
  '21711719', // 박종길
  '21709373', // 조재홍
  '21713547', // 한태환
  '21707420', // 김창환
  '21714586', // 이수윤
  '21707406', // 김봉철
  '21715494', // 김준홍
  '21706208', // 이병홍
  '21714013', // 정광구
  '21706206', // 최승곤
  '21713554', // 반헌준
  '21709589', // 김진완
  '21715437', // 석영훈
  '21707084', // 김재범
  '21714357', // 정용식
]);

export function verifyUser(name: string, sabun: string): Person | null {
  // 1. P + EXTRA_USERS에서 먼저 검색
  const local = ALL_USERS.find((p) => p.n === name && p.s === sabun);
  if (local) return local;
  // 2. sabun만 일치하면 DB 이름이 변경된 케이스 → 허용
  const bySabun = ALL_USERS.find((p) => p.s === sabun);
  if (bySabun) return { ...bySabun, n: name };
  // 3. P/EXTRA에 없는 계정(030827 등) → 사번으로만 허용
  return { I: '0', d: '', n: name, s: sabun };
}

/** 관리자 여부 확인 */
export function isAdmin(sabun: string): boolean {
  return ADMIN_SABUNS.has(sabun);
}

/** 내근직 여부 확인 (기관사 외 모든 직원 — EXTRA_USERS + 교번 미배정 INTERN_USERS) */
export function isOffice(sabun: string): boolean {
  return EXTRA_USERS.some((u) => u.s === sabun) || INTERN_USERS.some((u) => u.s === sabun);
}

/** 사번으로 EXTRA_USERS/INTERN_USERS의 canonical name 조회 (dutySchedule과 매칭) */
export function getOfficeName(sabun: string): string | null {
  return EXTRA_USERS.find((u) => u.s === sabun)?.n
    ?? INTERN_USERS.find((u) => u.s === sabun)?.n
    ?? null;
}

/** 인턴사원 여부 확인 (2026년 신규임용 6명) */
export function isIntern(sabun: string): boolean {
  return INTERN_USERS.some((u) => u.s === sabun);
}
