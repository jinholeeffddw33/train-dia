import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';
import { P } from '@/data/cycle';
import { EXTRA_USERS } from '@/lib/auth';

const ALL_PEOPLE = [...P, ...EXTRA_USERS];

function findById(id: string | null | undefined): Person | null {
  if (!id) return null;
  return ALL_PEOPLE.find((p) => p.I === id) ?? null;
}

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
  myDriverId: string | null;
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
        const isViewMode = myDriver ? person.I !== myDriver.I : false;
        set({ current: person, isViewMode });
      },

      setCurrent: (person: Person) => {
        const { myDriver } = get();
        const fresh = findById(person.I) ?? person;
        const isViewMode = myDriver ? fresh.I !== myDriver.I : false;
        set({ current: fresh, isViewMode });
      },

      setMyDriver: (person: Person) => {
        const fresh = findById(person.I) ?? person;
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
      version: 2,
      // ID만 저장 — Person 객체 본체는 매번 cycle.ts에서 fresh 조회 (stale 방지)
      partialize: (state) => ({
        myDriverId: state.myDriver?.I ?? null,
        currentId: state.current?.I ?? null,
      }) as unknown as PersistedShape,
      // v1(전체 Person 객체 저장) → v2(ID만 저장) 마이그레이션
      migrate: (persisted: unknown, version: number) => {
        if (!persisted || typeof persisted !== 'object') {
          return { myDriverId: null, currentId: null } as PersistedShape;
        }
        if (version < 2) {
          const old = persisted as { myDriver?: Person | null; current?: Person | null };
          return {
            myDriverId: old.myDriver?.I ?? null,
            currentId: old.current?.I ?? null,
          } as PersistedShape;
        }
        return persisted as PersistedShape;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const raw = state as unknown as PersistedShape & DriverState;
        const myDriver = findById(raw.myDriverId);
        const current = findById(raw.currentId) ?? myDriver;
        state.myDriver = myDriver;
        state.current = current;
        state.isViewMode = !!(myDriver && current && current.I !== myDriver.I);
      },
    },
  ),
);
