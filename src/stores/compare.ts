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

interface CompareGroup {
  memo: string;
  count: number;
  persons: (Person | null)[];
}

interface PersistedGroup {
  memo: string;
  count: number;
  personIds: (string | null)[];
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
      version: 2,
      // Person 객체는 휘발 — ID만 저장하고 로드시 cycle.ts에서 fresh 조회
      partialize: (state) => ({
        activeGroup: state.activeGroup,
        groups: state.groups.map((g) => ({
          memo: g.memo,
          count: g.count,
          personIds: g.persons.map((p) => p?.I ?? null),
        })) as [PersistedGroup, PersistedGroup, PersistedGroup, PersistedGroup],
      }) as unknown as { activeGroup: number; groups: PersistedGroup[] },
      migrate: (persisted: unknown, version: number) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        if (version < 2) {
          const old = persisted as { activeGroup?: number; groups?: { memo: string; count: number; persons: (Person | null)[] }[] };
          const groups = (old.groups ?? []).map((g) => ({
            memo: g.memo ?? '',
            count: g.count ?? 2,
            personIds: (g.persons ?? []).map((p) => p?.I ?? null),
          }));
          while (groups.length < 4) groups.push({ memo: '', count: 2, personIds: [null, null] });
          return { activeGroup: old.activeGroup ?? 0, groups };
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 첫 실행(저장 데이터 없음): 그대로 두면 default 유지
        // persisted 데이터 있음: groups[i]가 personIds를 가지므로 fresh Person으로 복원
        const raw = state as unknown as { activeGroup: number; groups: (PersistedGroup | CompareGroup)[] };
        const hydratedGroups = raw.groups.map((g): CompareGroup => {
          if (g && typeof g === 'object' && 'personIds' in g && Array.isArray((g as PersistedGroup).personIds)) {
            const pg = g as PersistedGroup;
            return {
              memo: pg.memo ?? '',
              count: pg.count ?? 2,
              persons: pg.personIds.map((id) => findById(id)),
            };
          }
          // 이미 live 상태(또는 default) — 인원 객체만 fresh로 갱신
          const cg = g as CompareGroup;
          return {
            memo: cg?.memo ?? '',
            count: cg?.count ?? 2,
            persons: (cg?.persons ?? [null, null]).map((p) => (p ? findById(p.I) : null)),
          };
        }) as [CompareGroup, CompareGroup, CompareGroup, CompareGroup];
        // 4개 미만이면 빈 그룹으로 채움
        while (hydratedGroups.length < 4) {
          hydratedGroups.push({ memo: '', count: 2, persons: [null, null] });
        }
        state.groups = hydratedGroups;
        const active = hydratedGroups[raw.activeGroup] ?? hydratedGroups[0];
        state.count = active.count;
        state.persons = active.persons;
      },
    },
  ),
);
