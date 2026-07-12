import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 내근직 대시보드/일정관리 — 할 일 / 일정 / 메모 (기기 보관) */
export interface OfficeTodo { id: string; text: string; time: string; urgent: boolean; done: boolean; }
/** 일정 — 날짜(YYYY-MM-DD)·시작/종료·카테고리 포함 */
export interface OfficeSchedule {
  id: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM 시작
  end: string;       // HH:MM 종료(선택)
  title: string;
  place: string;
  category: string;  // OFFICE_CATEGORIES key
}
export interface OfficeNote { id: string; text: string }

/** 일정 카테고리 — 색으로 한눈에 구분 (dot 색은 라이트/다크 공통) */
export const OFFICE_CATEGORIES = [
  { key: 'blue',   label: '업무·회의',  dot: '#3b82f6' },
  { key: 'amber',  label: '검토·문서',  dot: '#f59e0b' },
  { key: 'green',  label: '외부·미팅',  dot: '#22c55e' },
  { key: 'purple', label: '마감·중요',  dot: '#8b5cf6' },
  { key: 'gray',   label: '개인·기타',  dot: '#94a3b8' },
] as const;
export type OfficeCategoryKey = typeof OFFICE_CATEGORIES[number]['key'];

interface OfficeState {
  todos: OfficeTodo[];
  schedules: OfficeSchedule[];
  notes: OfficeNote[];
  addTodo: (t: { text: string; time?: string; urgent?: boolean }) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  addSchedule: (s: { date: string; time: string; end?: string; title: string; place?: string; category?: string }) => void;
  updateSchedule: (id: string, patch: Partial<Omit<OfficeSchedule, 'id'>>) => void;
  removeSchedule: (id: string) => void;
  addNote: (text: string) => void;
  removeNote: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const sortSched = (a: OfficeSchedule, b: OfficeSchedule) =>
  a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set) => ({
      todos: [],
      schedules: [],
      notes: [],

      addTodo: ({ text, time = '', urgent = false }) =>
        set((s) => ({ todos: [...s.todos, { id: uid(), text, time, urgent, done: false }] })),
      toggleTodo: (id) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),

      addSchedule: ({ date, time, end = '', title, place = '', category = 'blue' }) =>
        set((s) => ({
          schedules: [...s.schedules, { id: uid(), date, time, end, title, place, category }].sort(sortSched),
        })),
      updateSchedule: (id, patch) =>
        set((s) => ({ schedules: s.schedules.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(sortSched) })),
      removeSchedule: (id) => set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) })),

      addNote: (text) => set((s) => ({ notes: [{ id: uid(), text }, ...s.notes] })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    {
      name: 'officeDash',
      version: 2,
      // v1 일정(날짜·카테고리 없음) → 오늘 날짜·기본 카테고리로 이전
      migrate: (persisted, version) => {
        const p = persisted as { todos?: OfficeTodo[]; schedules?: OfficeSchedule[]; notes?: OfficeNote[] } | null;
        if (!p) return p as unknown as OfficeState;
        if (version < 2 && Array.isArray(p.schedules)) {
          const d = new Date();
          const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          p.schedules = p.schedules.map((s) => ({
            id: s.id, title: s.title, place: s.place ?? '',
            time: s.time ?? '', end: (s as OfficeSchedule).end ?? '',
            date: (s as OfficeSchedule).date ?? today,
            category: (s as OfficeSchedule).category ?? 'blue',
          }));
        }
        return p as unknown as OfficeState;
      },
    },
  ),
);
