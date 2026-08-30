import { P, getRoster } from '@/data/cycle';
import {
  departedSabuns, joinedUsers, activeRanks, activeDuties, RANK_LABEL,
  type StaffRank, type Duty,
} from '@/data/rosterChanges';
import type { Person } from '@/lib/types';

/**
 * 동명이인 — 같은 이름이 둘 이상이라 사번별로 A/B 를 붙여 각각 별개 인물로 다룬다.
 * 이 표가 이름 표기의 SSOT: Supabase driver_profiles.name · cycle.ts P · 로그인 이름이 모두 여기에 맞춰져 있다.
 * 김성준A(21703825, 교번 62) / 김성준B(22300506, 교번 54) — 2026-07-15 확정.
 */
export const DUPLICATE_NAME_GROUPS: {
  base: string;
  members: { sabun: string; name: string; personId: string }[];
}[] = [
  {
    base: '김성준',
    members: [
      { sabun: '21703825', name: '김성준A', personId: '62' },
      { sabun: '22300506', name: '김성준B', personId: '54' },
    ],
  },
];

/** 이 사번이 동명이인이면 로그인에서 고를 이름 후보 그룹을 반환 (아니면 null) */
export function getDuplicateNameGroup(sabun: string) {
  return DUPLICATE_NAME_GROUPS.find((g) => g.members.some((m) => m.sabun === sabun)) ?? null;
}

/**
 * 내근직(비승무) — isOffice() 가 이 목록으로 판정해 홈을 일정관리 화면으로 돌린다.
 * ★ cycle.ts P 에 교번이 있는 사람은 여기 넣지 말 것 — 승무원인데 내근직 화면이 뜬다.
 *   (통상근무 기관사 W1~W4 황선호·김윤수·조효진·김건래 는 평일 51~54 운전 → 기관사 허브)
 *   유일한 예외: 이태원(W5) — 교번 W5 지만 d='내근' 인 부소장.
 */
export const EXTRA_USERS: Person[] = [
  { I: '0', d: '', n: '이현구', s: '21711694' },
  { I: '0', d: '', n: '강병우', s: '21714898' },
  { I: '0', d: '', n: '석영훈', s: '21715437' },
  { I: '0', d: '', n: '김준홍', s: '21715494' },
  { I: '0', d: '', n: '김민정', s: '21715676' },
  { I: '0', d: '', n: '이민우', s: '21716991' },
  { I: '0', d: '', n: '한태환', s: '21713547' },
  { I: '0', d: '', n: '반헌준', s: '21713554' },
  { I: '0', d: '', n: '신승헌', s: '21713568' },
  { I: '0', d: '', n: '정광구', s: '21714013' },
  { I: '0', d: '', n: '정용식', s: '21714357' },
  { I: '0', d: '', n: '이수윤', s: '21714586' },
  { I: '0', d: '', n: '김다솜', s: '22000103' },
  { I: '0', d: '', n: '김현진', s: '22200209' },
  { I: '0', d: '', n: '장진수', s: '21707096' },
  { I: '0', d: '', n: '김봉철', s: '21707406' },
  { I: '0', d: '', n: '김창환', s: '21707420' },
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
  { I: '0', d: '', n: '신제윤', s: '21709575' },
  { I: '0', d: '', n: '김진완', s: '21709589' },
  { I: '0', d: '', n: '정성한', s: '21709635' },
  { I: '0', d: '', n: '조옥란', s: '21709649' },
  { I: '0', d: '', n: '이동복', s: '21710720' },
  { I: '0', d: '', n: '이선길', s: '21711197' },
  { I: '0', d: '', n: '전동규', s: '21711304' },
  { I: '0', d: '', n: '박용덕', s: '21711438' },
  { I: '0', d: '', n: '이태원', s: '21711216' },
  // 2026-07 신규 내근직 (직함: 부장/대리)
  // 유희종(21715488) → 2026-08-01 결원02 자리로 기관사 발령 (내근 해제, cycle.ts I:60/d:73~)
  { I: '0', d: '', n: '유승용', s: '21706793' }, // 부장
  { I: '0', d: '', n: '신은미', s: '21717671' }, // 대리
];

/** 2026년 신규임용 인턴사원 — 교번 미배정 상태, 내근직 아님 */
export const INTERN_USERS: Person[] = [
  { I: '0', d: '', n: '김경률', s: '22600439' },
  { I: '0', d: '', n: '최승빈', s: '22600472' },
  { I: '0', d: '', n: '박민석', s: '22600519' },
  { I: '0', d: '', n: '한지승', s: '22601004' },
  { I: '0', d: '', n: '강미진', s: '22601008' },
  { I: '0', d: '', n: '조건희', s: '22601134' },
  { I: '0', d: '', n: '신석희', s: '22601146' },
  { I: '0', d: '', n: '주정재', s: '22000358' }, // 2026-07 신규 인턴
  { I: '0', d: '', n: '김동환', s: '22601263' }, // 2026-07-14 신규 인턴
];

/**
 * 공로연수/퇴직 — 근무·스케줄·읽음현황 등 모든 활성 정보에서 제외.
 * 2026-07 퇴직 영구삭제: 이기영(→결원22 I:56)·이창훈(→결원23 I:111)·양원석(→결원10 I:97).
 * 세 명 모두 직원 아님 — cycle.ts 자리는 결원으로 대체, Supabase 계정도 삭제됨.
 */
export const GONGRO_YEONSU_USERS: { n: string; s: string }[] = [];

/**
 * 시행일이 반영된 전체 인원. 발령일이 지난 사람은 기관사 명부(getRoster)에 들어가 있고
 * 인턴/내근 목록에서는 빠진다 — 그래서 한 사람이 두 번 잡히지 않는다.
 */
function allUsers(at: Date = new Date()): Person[] {
  return [...getRoster(at), ...officeUsers(at), ...internUsers(at)];
}

/**
 * 그 시점의 내근 명단 — 나간 사람은 빠지고, 기관사에서 내려온 사람은 들어온다.
 * (관리자 모드에서 «기관사 → 내근/휴직/병가/공로연수» 를 넣으면 여기로 온다)
 */
export function officeUsers(at: Date = new Date()): Person[] {
  const gone = departedSabuns('extra', at);
  const base = EXTRA_USERS.filter((u) => !u.s || !gone.has(u.s));
  const known = new Set(base.map((u) => u.s));
  return [...base, ...joinedUsers('extra', at).filter((u) => !known.has(u.s))];
}

/** 그 시점의 인턴 명단 — 정식 임용된 사람은 빠지고, 새로 등록된 인턴은 들어온다 */
export function internUsers(at: Date = new Date()): Person[] {
  const gone = departedSabuns('intern', at);
  const base = INTERN_USERS.filter((u) => !u.s || !gone.has(u.s));
  const known = new Set(base.map((u) => u.s));
  return [...base, ...joinedUsers('intern', at).filter((u) => !known.has(u.s))];
}

/**
 * 사업소 관리자 사번 (22명) — 푸시 발송·안전신고 처리 권한. isAdmin() 이 이 목록으로 판정.
 *
 * ★ DB driver_profiles.role='admin' 과 별개의 체계다. 헷갈리지 말 것:
 *   - 여기(ADMIN_SABUNS)  = 사업소 관리자(소장·부소장·부장). 푸시·안전신고
 *   - role='admin'        = 개발자 3명(이진호 00000001 · jinho 030827 · 이현구 21711694).
 *                           관리자 대시보드·의견(피드백) 관리 — 모든 권한
 *   소장·부소장도 role 은 'driver' 다(의도된 것). 승무원에게 role='admin' 을 주지 말 것
 *   — 2026-07 조임현(21714375, 순번1 기관사)이 role='admin' 이던 것을 'driver' 로 회수함.
 */
const ADMIN_SABUNS = new Set([
  '21704630', // 안성숙 — 소장
  '21711216', // 이태원 — 부소장
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
  const ALL = allUsers();
  const local = ALL.find((p) => p.n === name && p.s === sabun);
  if (local) return local;
  // 2. sabun만 일치하면 DB 이름이 변경된 케이스 → 허용
  const bySabun = ALL.find((p) => p.s === sabun);
  if (bySabun) return { ...bySabun, n: name };
  // 3. P/EXTRA에 없는 계정(030827 등) → 사번으로만 허용
  return { I: '0', d: '', n: name, s: sabun };
}

/** 관리자 여부 확인 */
export function isAdmin(sabun: string): boolean {
  return ADMIN_SABUNS.has(sabun);
}

/** 내근직 여부 확인 (기관사 외 모든 직원 — 내근 + 교번 미배정 인턴) */
export function isOffice(sabun: string): boolean {
  return officeUsers().some((u) => u.s === sabun) || internUsers().some((u) => u.s === sabun);
}

/** 사번으로 내근/인턴 명단의 canonical name 조회 (dutySchedule과 매칭) */
export function getOfficeName(sabun: string): string | null {
  return officeUsers().find((u) => u.s === sabun)?.n
    ?? internUsers().find((u) => u.s === sabun)?.n
    ?? null;
}

/** 인턴사원 여부 확인 (2026년 신규임용 — 통상근무 중) */
export function isIntern(sabun: string): boolean {
  return internUsers().some((u) => u.s === sabun);
}

/**
 * 그 사람의 직급 — 관리자 모드에서 바꾼 것이 있으면 그것이 이긴다.
 *
 * 아래 사번 목록들은 «처음 값»이다. [관리자 모드 → 명부 관리]에서 직급을 바꾸면
 * 배포 없이 이 함수의 답이 바뀌고, 호칭·임무카드가 따라온다.
 * 기관사·인턴이 되면 직급이 사라진다(activeRanks 가 null 을 넣는다).
 */
export function rankOf(sabun: string, at: Date = new Date()): StaffRank | null {
  const changed = activeRanks(at);
  if (changed.has(sabun)) return changed.get(sabun) ?? null;
  if (sabun === '21704630') return 'chief';
  if (sabun === '21711216') return 'vice';
  if (MANAGER_SABUNS.has(sabun)) return 'manager';
  if (GWAJANG_SABUNS.has(sabun)) return 'gwajang';
  if (DAERI_SABUNS.has(sabun)) return 'daeri';
  return null;
}

/** 사업소장 여부 확인 (안성숙 소장) */
export function isChief(sabun: string): boolean {
  return rankOf(sabun) === 'chief';
}

/** 부소장 여부 (이태원) */
export function isViceChief(sabun: string): boolean {
  return rankOf(sabun) === 'vice';
}

/** 부장 여부 (11명) */
const MANAGER_SABUNS: ReadonlySet<string> = new Set([
  '21711197', // 이선길
  '21711694', // 이현구
  '21707420', // 김창환
  '21707096', // 장진수
  '21706206', // 최승곤
  '21709589', // 김진완
  '21707406', // 김봉철
  '21706208', // 이병홍
  '21707084', // 김재범
  '21709373', // 조재홍
  '21706793', // 유승용 (2026-07 신규)
]);
export function isManager(sabun: string): boolean {
  return rankOf(sabun) === 'manager';
}

/** 차장 여부 — 처음 값은 없다. 관리자 모드에서만 붙는다 */
export function isChajang(sabun: string): boolean {
  return rankOf(sabun) === 'deputy';
}

/** 과장 여부 — 현재 해당자 없음 (유희종 2026-08-01 기관사 발령으로 해제) */
const GWAJANG_SABUNS: ReadonlySet<string> = new Set([]);
export function isGwajang(sabun: string): boolean {
  return rankOf(sabun) === 'gwajang';
}

/** 대리 여부 */
const DAERI_SABUNS: ReadonlySet<string> = new Set([
  '21717671', // 신은미 (2026-07 신규)
]);
export function isDaeri(sabun: string): boolean {
  return rankOf(sabun) === 'daeri';
}

/** 주간 통상근무자 — 평일 출근·주말/공휴일 휴무 (직원 10명 + 인턴 9명) */
const REGULAR_DAY_OFFICE_SABUNS: ReadonlySet<string> = new Set([
  '21704630', // 안성숙
  '21711216', // 이태원
  '21711197', // 이선길
  '21711694', // 이현구
  '21713568', // 신승헌
  '21714898', // 강병우
  '21715676', // 김민정
  // 김대환(21706363) → 2026-08-14 결원27 자리로 기관사 복직 (지도기관사 해제, cycle.ts I:52/d:89)
  // 김민경(22400349) → 2026-07-08 결원10 자리로 기관사 복귀 (일근 해제, cycle.ts I:90/d:64)
  '22600439', // 김경률 (인턴)
  '22600472', // 최승빈 (인턴)
  '22600519', // 박민석 (인턴)
  '22601004', // 한지승 (인턴)
  '22601008', // 강미진 (인턴)
  '22601134', // 조건희 (인턴 2026-07-07)
  '22601146', // 신석희 (인턴 2026-07-07)
  // 유희종(21715488) → 2026-08-01 결원02 자리로 기관사 발령 (일근 해제, cycle.ts I:60/d:73~)
  '21706793', // 유승용 (부장, 2026-07 신규)
  '21717671', // 신은미 (대리, 2026-07 신규)
  '22000358', // 주정재 (인턴, 2026-07 신규)
  '22601263', // 김동환 (인턴, 2026-07-14 신규)
]);
export function isRegularDayOffice(sabun: string | undefined | null): boolean {
  if (!sabun) return false;
  return REGULAR_DAY_OFFICE_SABUNS.has(sabun);
}

/** 사용자 호칭 — 우선순위: 소장 > 부소장 > 부장 > 차장 > 과장 > 대리 > 인턴 > 기관사 */
export function getUserRole(sabun: string | undefined | null): string {
  if (!sabun) return '기관사님';
  const rank = rankOf(sabun);
  if (rank) return `${RANK_LABEL[rank]}님`;
  if (isIntern(sabun)) return '인턴님';
  return '기관사님';
}

/**
 * 개인별 임무카드 분류 (재난 대응 임무 카드)
 * 출처: 2026년 5월 인력운용 분류
 */
export type MissionCardKind =
  | 'so-jang'
  | 'bu-so-jang'
  | 'jido-bujang-lee-hyungoo'
  | 'jido-bujang-lee-seongil'
  | 'anjeon-gwanrija'
  | 'jido-gigwansa'
  | 'samu-jikwon'
  | 'unyong-bujang'
  | 'jiwon-gigwansa'
  | 'kiji-gwanjewon'
  | 'gigwansa';

// 사번별 전용 임무카드 (개인 이름이 박힌 카드 — 일반 역할 카드보다 우선)
const SABUN_SPECIFIC_CARDS: Record<string, MissionCardKind> = {
  '21704630': 'so-jang',                  // 안성숙 — 소장
  '21711216': 'bu-so-jang',               // 이태원 — 부소장
  '21711694': 'jido-bujang-lee-hyungoo',  // 이현구 — 지도부장
  '21711197': 'jido-bujang-lee-seongil',  // 이선길 — 지도부장
  '21713568': 'anjeon-gwanrija',          // 신승헌 — 안전관리자
  '21714898': 'jido-gigwansa',            // 강병우 — 지도기관사
  '21715676': 'samu-jikwon',              // 김민정 — 사무직원
};

// 운용부장 (운용계획부장) — 8명
const UNYONG_BUJANG_SABUNS: ReadonlySet<string> = new Set([
  '21707096', // 장진수
  '21709589', // 김진완
  '21707420', // 김창환
  '21706206', // 최승곤
  '21707406', // 김봉철
  '21706208', // 이병홍
  '21707084', // 김재범
  '21709373', // 조재홍
]);

// 지원기관사 — 8명
const JIWON_GIGWANSA_SABUNS: ReadonlySet<string> = new Set([
  '21711719', // 박종길
  '21715437', // 석영훈
  '21713554', // 반헌준
  '21714586', // 이수윤
  '21715494', // 김준홍
  '21714013', // 정광구
  '21714357', // 정용식
  '21713547', // 한태환
]);

/**
 * 그 사람의 업무 — 관리자 모드에서 바꾼 것이 있으면 그것이 이긴다.
 *
 * 아래 사번 목록들은 «처음 값»이다. [관리자 모드 → 명부 관리]에서 업무를 바꾸면
 * 배포 없이 이 함수의 답이 바뀌고, 지원기관사 권한 등이 따라온다.
 */
export function dutyOf(sabun: string | undefined | null, at: Date = new Date()): Duty | null {
  if (!sabun) return null;
  const changed = activeDuties(at);
  if (changed.has(sabun)) return changed.get(sabun) ?? null;
  if (JIWON_GIGWANSA_SABUNS.has(sabun)) return 'jiwon_gisa';
  return null;
}

/** 지원기관사 여부 — 대기충당현황 등 지원업무 자료를 관리한다 */
export function isJiwonGigwansa(sabun: string | undefined | null): boolean {
  return dutyOf(sabun) === 'jiwon_gisa';
}

/**
 * 대기충당현황 삭제 권한 — 올린 본인 · 지원기관사 · 관리자.
 * API(서버 검증)와 화면(버튼 노출)이 이 함수 하나를 함께 써야 기준이 어긋나지 않는다.
 */
export function canDeleteStandby(
  sabun: string | undefined | null,
  uploaderSabun: string | undefined | null,
): boolean {
  if (!sabun) return false;
  return sabun === uploaderSabun || isJiwonGigwansa(sabun) || isAdmin(sabun);
}

// 기지관제원 — 8명
const KIJI_GWANJEWON_SABUNS: ReadonlySet<string> = new Set([
  '21706327', // 현덕일
  '21711438', // 박용덕
  '21706306', // 윤경일
  '21711304', // 전동규
  '21709635', // 정성한
  '21710720', // 이동복
  '21709575', // 신제윤
  '21711443', // 이승훈
]);

/**
 * 사번에 해당하는 임무카드 종류 반환.
 * 우선순위: 사번별 전용 카드(SABUN_SPECIFIC_CARDS) > 역할별 카드 > 기관사(기본).
 */
export function getMissionCardKind(sabun: string | undefined | null): MissionCardKind | null {
  if (!sabun) return 'gigwansa';
  if (SABUN_SPECIFIC_CARDS[sabun]) return SABUN_SPECIFIC_CARDS[sabun];
  if (UNYONG_BUJANG_SABUNS.has(sabun)) return 'unyong-bujang';
  if (JIWON_GIGWANSA_SABUNS.has(sabun)) return 'jiwon-gigwansa';
  if (KIJI_GWANJEWON_SABUNS.has(sabun)) return 'kiji-gwanjewon';
  return 'gigwansa';
}

export const MISSION_CARD_META: Record<MissionCardKind, { label: string; image: string }> = {
  'so-jang':                 { label: '소장',         image: '/notice/mission-cards/so-jang.jpg' },
  'bu-so-jang':              { label: '부소장',       image: '/notice/mission-cards/bu-so-jang.jpg' },
  'jido-bujang-lee-hyungoo': { label: '지도부장',     image: '/notice/mission-cards/jido-bujang-lee-hyungoo.jpg' },
  'jido-bujang-lee-seongil': { label: '지도부장',     image: '/notice/mission-cards/jido-bujang-lee-seongil.jpg' },
  'anjeon-gwanrija':         { label: '안전관리자',   image: '/notice/mission-cards/anjeon-gwanrija.jpg' },
  'jido-gigwansa':           { label: '지도기관사',   image: '/notice/mission-cards/jido-gigwansa.jpg' },
  'samu-jikwon':             { label: '사무직원',     image: '/notice/mission-cards/samu-jikwon.jpg' },
  'unyong-bujang':           { label: '운용부장',     image: '/notice/mission-cards/unyong-bujang.jpg' },
  'jiwon-gigwansa':          { label: '지원기관사',   image: '/notice/mission-cards/jiwon-gigwansa.jpg' },
  'kiji-gwanjewon':          { label: '기지관제원',   image: '/notice/mission-cards/kiji-gwanjewon.jpg' },
  'gigwansa':                { label: '기관사',       image: '/notice/mission-cards/gigwansa.jpg' },
};
