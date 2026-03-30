import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';

interface CompareGroup {
  memo: string;
  count: number;
  persons: (Person | null)[];
}

interface CompareState {
  /** 현재 선택된 그룹 인덱스 (0~3) */
  activeGroup: number;
  /** 4개 비교 그룹 */
  groups: [CompareGroup, CompareGroup, CompareGroup, CompareGroup];
  /** 비교 연도 */
  year: number;
  /** 비교 월 */
  month: number;

  /** 현재 그룹의 비교 인원 수 */
  count: number;
  /** 현재 그룹의 비교 대상 배열 */
  persons: (Person | null)[];

  setActiveGroup: (index: number) => void;
  setGroupMemo: (index: number, memo: string) => void;
  setCount: (n: number) => void;
  setPerson: (index: number, p: Person | null) => void;
  removePerson: (index: number) => void;
  setPersonsBatch: (people: Person[]) => void;
  resetGroup: () => void;
  prevMonth: () => void;
  nextMonth: () => void;
  resetMonth: () => void;
}

const emptyGroup = (): CompareGroup => ({ memo: '', count: 2, persons: [null, null] });
const now = new Date();

function syncFromGroup(group: CompareGroup) {
  return { count: group.count, persons: group.persons };
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      activeGroup: 0,
      groups: [emptyGroup(), emptyGroup(), emptyGroup(), emptyGroup()],
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      count: 2,
      persons: [null, null],

      setActiveGroup: (index) =>
        set((s) => {
          // 현재 그룹에 현재 상태 저장
          const groups = [...s.groups] as CompareState['groups'];
          groups[s.activeGroup] = { memo: groups[s.activeGroup].memo, count: s.count, persons: s.persons };
          // 새 그룹 로드
          const next = groups[index];
          return { activeGroup: index, groups, ...syncFromGroup(next) };
        }),

      setGroupMemo: (index, memo) =>
        set((s) => {
          const trimmed = memo.slice(0, 10);
          const groups = [...s.groups] as CompareState['groups'];
          groups[index] = { ...groups[index], memo: trimmed };
          return { groups };
        }),

      setCount: (n) =>
        set((s) => {
          const next = Array.from({ length: n }, (_, i) => s.persons[i] ?? null);
          const groups = [...s.groups] as CompareState['groups'];
          groups[s.activeGroup] = { ...groups[s.activeGroup], count: n, persons: next };
          return { count: n, persons: next, groups };
        }),

      setPerson: (index, p) =>
        set((s) => {
          const next = [...s.persons];
          next[index] = p;
          const groups = [...s.groups] as CompareState['groups'];
          groups[s.activeGroup] = { ...groups[s.activeGroup], persons: next };
          return { persons: next, groups };
        }),

      removePerson: (index) =>
        set((s) => {
          const next = [...s.persons];
          next[index] = null;
          const groups = [...s.groups] as CompareState['groups'];
          groups[s.activeGroup] = { ...groups[s.activeGroup], persons: next };
          return { persons: next, groups };
        }),

      setPersonsBatch: (people) =>
        set((s) => {
          const n = Math.max(people.length, 2);
          const next: (Person | null)[] = Array.from({ length: n }, (_, i) => people[i] ?? null);
          const groups = [...s.groups] as CompareState['groups'];
          groups[s.activeGroup] = { ...groups[s.activeGroup], count: n, persons: next };
          return { count: n, persons: next, groups };
        }),

      resetGroup: () =>
        set((s) => {
          const fresh = emptyGroup();
          fresh.memo = s.groups[s.activeGroup].memo;
          const groups = [...s.groups] as CompareState['groups'];
          groups[s.activeGroup] = fresh;
          return { count: fresh.count, persons: fresh.persons, groups };
        }),

      prevMonth: () =>
        set((s) => {
          if (s.month === 1) return { year: s.year - 1, month: 12 };
          return { month: s.month - 1 };
        }),

      nextMonth: () =>
        set((s) => {
          if (s.month === 12) return { year: s.year + 1, month: 1 };
          return { month: s.month + 1 };
        }),

      resetMonth: () =>
        set({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        }),
    }),
    {
      name: 'dia-compare',
      partialize: (state) => ({
        activeGroup: state.activeGroup,
        groups: state.groups,
      }),
      // 로드 시 activeGroup의 데이터를 count/persons에 동기화
      onRehydrateStorage: () => (state) => {
        if (state) {
          const group = state.groups[state.activeGroup];
          state.count = group.count;
          state.persons = group.persons;
        }
      },
    },
  ),
);
