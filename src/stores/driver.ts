import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';
import { P } from '@/data/cycle';
import { EXTRA_USERS } from '@/lib/auth';

const ALL_PEOPLE = [...P, ...EXTRA_USERS];

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

export const useDriverStore = create<DriverState>()(
  persist(
    (set, get) => ({
      myDriver: null,
      current: null,
      isViewMode: false,

      pick: (id: string) => {
        const person = ALL_PEOPLE.find((p) => p.I === id) ?? null;
        if (!person) return;
        const { myDriver } = get();
        // myDriver는 절대 변경하지 않음 — 로그인 시에만 설정됨
        const isViewMode = myDriver ? person.I !== myDriver.I : false;
        set({ current: person, isViewMode });
      },

      setCurrent: (person: Person) => {
        const { myDriver } = get();
        // myDriver는 절대 변경하지 않음 — 로그인 시에만 설정됨
        const isViewMode = myDriver ? person.I !== myDriver.I : false;
        set({ current: person, isViewMode });
      },

      setMyDriver: (person: Person) => {
        set({ myDriver: person, current: person, isViewMode: false });
      },

      setMyDriverById: (id: string) => {
        // P + EXTRA_USERS 모두에서 검색
        const person = ALL_PEOPLE.find((p) => p.I === id) ?? null;
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
      partialize: (state) => ({
        current: state.current,
        myDriver: state.myDriver,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.myDriver && state.current) {
          state.isViewMode = state.current.I !== state.myDriver.I;
        }
      },
    },
  ),
);
