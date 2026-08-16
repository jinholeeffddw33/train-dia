import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';
import { getRoster } from '@/data/cycle';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';

// 내근직·인턴은 I('순번')가 전원 '0' → 고유값인 사번(s)을 우선 키로 사용
// 발령 시행일 반영 — 호출 시점에 계산한다
const allPeople = () => [...getRoster(), ...EXTRA_USERS, ...INTERN_USERS];
function findById(id: string | null | undefined): Person | null {
  if (!id || id === '0') return null;
  return allPeople().find((p) => p.I === id) ?? null;
}
function findBySabun(sabun: string | null | undefined): Person | null {
  if (!sabun) return null;
  return allPeople().find((p) => p.s === sabun) ?? null;
}
/** 사번 우선 → 순번 순으로 fresh Person 해석 */
function resolvePerson(sabun: string | null | undefined, id: string | null | undefined): Person | null {
  return findBySabun(sabun) ?? findById(id);
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
  personSabuns?: (string | null)[];
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
      version: 3,
      // Person 객체는 휘발 — 식별자(사번+ID)만 저장하고 로드시 fresh 조회.
      // 사번 우선 — I='0'인 내근직/인턴이 서로 뒤바뀌지 않도록.
      partialize: (state) => ({
        activeGroup: state.activeGroup,
        groups: state.groups.map((g) => ({
          memo: g.memo,
          count: g.count,
          personIds: g.persons.map((p) => p?.I ?? null),
          personSabuns: g.persons.map((p) => p?.s ?? null),
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
            personSabuns: (g.persons ?? []).map((p) => p?.s ?? null),
          }));
          while (groups.length < 4) groups.push({ memo: '', count: 2, personIds: [null, null], personSabuns: [null, null] });
          return { activeGroup: old.activeGroup ?? 0, groups };
        }
        // v2: personIds만 존재 (사번 없음) — 그대로 두면 rehydrate가 ID로만 해석
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        // 어떤 단계에서도 throw하지 않도록 전체를 try/catch로 감쌈
        // — Samsung Internet 등 오래된 단말에서 손상된 persist로 인한 화이트 화면 방지
        try {
          if (!state) return;
          const raw = state as unknown as { activeGroup?: number; groups?: (PersistedGroup | CompareGroup | null | undefined)[] };
          const groupsArr = Array.isArray(raw.groups) ? raw.groups : [];
          const hydratedGroups: CompareGroup[] = groupsArr.map((g): CompareGroup => {
            if (!g || typeof g !== 'object') return emptyGroup();
            // persisted 형태 (personIds 보유)
            if ('personIds' in g && Array.isArray((g as PersistedGroup).personIds)) {
              const pg = g as PersistedGroup;
              const sabuns = Array.isArray(pg.personSabuns) ? pg.personSabuns : [];
              return {
                memo: typeof pg.memo === 'string' ? pg.memo : '',
                count: typeof pg.count === 'number' && pg.count >= 2 ? pg.count : 2,
                persons: pg.personIds.map((id, i) => {
                  try { return resolvePerson(sabuns[i] ?? null, id); } catch { return null; }
                }),
              };
            }
            // live/default 형태 — 인원 객체만 fresh로 갱신
            const cg = g as CompareGroup;
            const personsArr = Array.isArray(cg.persons) ? cg.persons : [null, null];
            return {
              memo: typeof cg.memo === 'string' ? cg.memo : '',
              count: typeof cg.count === 'number' && cg.count >= 2 ? cg.count : 2,
              persons: personsArr.map((p) => {
                try { return p ? resolvePerson(p.s, p.I) : null; } catch { return null; }
              }),
            };
          });
          // 4개 미만이면 빈 그룹으로 채움
          while (hydratedGroups.length < 4) hydratedGroups.push(emptyGroup());
          const fixedGroups = hydratedGroups.slice(0, 4) as [CompareGroup, CompareGroup, CompareGroup, CompareGroup];
          state.groups = fixedGroups;
          const activeIdx = typeof raw.activeGroup === 'number' && raw.activeGroup >= 0 && raw.activeGroup < 4 ? raw.activeGroup : 0;
          const active = fixedGroups[activeIdx] ?? fixedGroups[0];
          state.count = active.count;
          state.persons = active.persons;
        } catch {
          // 복원 실패 시 default로 초기화 — 절대 화이트 화면 X
          if (state) {
            state.groups = [emptyGroup(), emptyGroup(), emptyGroup(), emptyGroup()];
            state.count = 2;
            state.persons = [null, null];
            state.activeGroup = 0;
          }
        }
      },
    },
  ),
);
