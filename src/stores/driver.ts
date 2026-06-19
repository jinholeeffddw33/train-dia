import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';
import { P } from '@/data/cycle';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';

// 내근직(EXTRA_USERS)·인턴(INTERN_USERS)은 교번 미배정이라 I('순번')가 전원 '0'으로 동일하다.
// 따라서 I는 고유 식별자가 아니며, 고유값인 사번(s)을 우선 키로 써야 한다.
const ALL_PEOPLE = [...P, ...EXTRA_USERS, ...INTERN_USERS];

/** 순번(I)으로 조회 — '0'은 내근직/인턴 공용 placeholder라 식별 불가 → 무시 */
function findById(id: string | null | undefined): Person | null {
  if (!id || id === '0') return null;
  return ALL_PEOPLE.find((p) => p.I === id) ?? null;
}

/** 사번(고유)으로 조회 */
function findBySabun(sabun: string | null | undefined): Person | null {
  if (!sabun) return null;
  return ALL_PEOPLE.find((p) => p.s === sabun) ?? null;
}

/** 사번(고유) → 순번 → 원본 순으로 fresh Person 해석 */
function resolvePerson(person: Person | null | undefined): Person | null {
  if (!person) return null;
  return findBySabun(person.s) ?? findById(person.I) ?? person;
}

/** 동일인 비교 키 — 사번 우선(내근직/인턴 구분), 없으면 순번 */
const personKey = (p: Person): string => p.s || p.I;

interface DriverState {
  /** 본인 기관사 (최초 설정 후 잠금 — 행위 주체) */
  myDriver: Person | null;
  /** 현재 조회 중인 기관사 (달력/스케줄 표시용) */
  current: Person | null;
  /** 조회 모드 여부 (current !== myDriver) */
  isViewMode: boolean;
  /** 기관사 조회 전환 (다른 사람 스케줄 보기) */
  pick: (id: string) => void;
  /** 직접 Person 객체 설정 */
  setCurrent: (person: Person) => void;
  /** 내 기관사 설정 (최초 또는 설정에서 변경) */
  setMyDriver: (person: Person) => void;
  /** 내 기관사 ID로 설정 */
  setMyDriverById: (id: string) => void;
  /** 사번으로 내 기관사 설정 */
  setMyDriverBySabun: (sabun: string) => void;
  /** 내 보기로 돌아가기 */
  backToMe: () => void;
  /** 로그아웃 — 인증 초기화 */
  logout: () => void;
  /** 초기화 (localStorage에서 복원) */
  restore: () => void;
}

interface PersistedShape {
  myDriverSabun: string | null;
  myDriverId: string | null;
  currentSabun: string | null;
  currentId: string | null;
}

export const useDriverStore = create<DriverState>()(
  persist(
    (set, get) => ({
      myDriver: null,
      current: null,
      isViewMode: false,

      pick: (id: string) => {
        const person = findById(id);
        if (!person) return;
        const { myDriver } = get();
        const isViewMode = myDriver ? personKey(person) !== personKey(myDriver) : false;
        set({ current: person, isViewMode });
      },

      setCurrent: (person: Person) => {
        const { myDriver } = get();
        const fresh = resolvePerson(person) ?? person;
        const isViewMode = myDriver ? personKey(fresh) !== personKey(myDriver) : false;
        set({ current: fresh, isViewMode });
      },

      setMyDriver: (person: Person) => {
        const fresh = resolvePerson(person) ?? person;
        set({ myDriver: fresh, current: fresh, isViewMode: false });
      },

      setMyDriverById: (id: string) => {
        const person = findById(id);
        if (person) {
          set({ myDriver: person, current: person, isViewMode: false });
        }
      },

      setMyDriverBySabun: (sabun: string) => {
        const person = ALL_PEOPLE.find((p) => p.s === sabun) ?? null;
        if (person) {
          set({ myDriver: person, current: person, isViewMode: false });
        }
      },

      backToMe: () => {
        const { myDriver } = get();
        if (myDriver) {
          set({ current: myDriver, isViewMode: false });
        }
      },

      logout: () => {
        set({ myDriver: null, current: null, isViewMode: false });
      },

      restore: () => {
        // persist middleware가 자동 복원하므로 별도 로직 불필요
      },
    }),
    {
      name: 'dp',
      version: 3,
      // 식별자(사번+순번)만 저장 — Person 본체는 매번 fresh 조회 (stale 방지).
      // 사번을 우선 저장해야 I='0'인 내근직/인턴이 서로 뒤바뀌지 않는다.
      partialize: (state) => ({
        myDriverSabun: state.myDriver?.s ?? null,
        myDriverId: state.myDriver?.I ?? null,
        currentSabun: state.current?.s ?? null,
        currentId: state.current?.I ?? null,
      }) as unknown as PersistedShape,
      // v1(전체 Person 객체) → v2(ID만) → v3(사번+ID) 마이그레이션
      migrate: (persisted: unknown, version: number) => {
        if (!persisted || typeof persisted !== 'object') {
          return { myDriverSabun: null, myDriverId: null, currentSabun: null, currentId: null } as PersistedShape;
        }
        if (version < 2) {
          // v1: Person 객체 전체 보관 → 사번까지 복구 가능
          const old = persisted as { myDriver?: Person | null; current?: Person | null };
          return {
            myDriverSabun: old.myDriver?.s ?? null,
            myDriverId: old.myDriver?.I ?? null,
            currentSabun: old.current?.s ?? null,
            currentId: old.current?.I ?? null,
          } as PersistedShape;
        }
        if (version < 3) {
          // v2: ID만 보관 — 사번은 없음(로그인 세션에서 재해석됨)
          const old = persisted as { myDriverId?: string | null; currentId?: string | null };
          return {
            myDriverSabun: null,
            myDriverId: old.myDriverId ?? null,
            currentSabun: null,
            currentId: old.currentId ?? null,
          } as PersistedShape;
        }
        return persisted as PersistedShape;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const raw = state as unknown as PersistedShape & DriverState;
        const myDriver = findBySabun(raw.myDriverSabun) ?? findById(raw.myDriverId);
        const current = findBySabun(raw.currentSabun) ?? findById(raw.currentId) ?? myDriver;
        state.myDriver = myDriver;
        state.current = current;
        state.isViewMode = !!(myDriver && current && personKey(current) !== personKey(myDriver));
      },
    },
  ),
);
