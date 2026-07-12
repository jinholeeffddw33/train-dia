import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 내근직 대시보드/일정관리 — 할 일 / 일정 / 메모 (기기 보관) */
export type OfficePriority = 'urgent' | 'important' | 'normal';
export interface OfficeTodo {
  id: string;
  text: string;
  time: string;
  urgent: boolean;
  done: boolean;
  /** 아래는 오늘의 할 일 전체보기(TaskBoard)용 선택 필드 — 없으면 기본값 처리 */
  priority?: OfficePriority;
  progress?: number;    // 0~100
  assignee?: string;
  memo?: string;
  completedAt?: string; // 'HH:MM'
  inSchedule?: boolean; // '일정에 추가' — 오늘의 일정/시간표에 노출할지 (time 없으면 종일)
}

/** 기존 urgent 불리언 → 우선순위 해석 (하위호환) */
export function todoPriority(t: OfficeTodo): OfficePriority {
  return t.priority ?? (t.urgent ? 'urgent' : 'normal');
}
/** 일정 — 날짜(YYYY-MM-DD)·시작/종료·카테고리 포함 */
export interface OfficeSchedule {
  id: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM 시작
  end: string;       // HH:MM 종료(선택)
  title: string;
  place: string;
  category: string;  // OFFICE_CATEGORIES key
  repeatId?: string; // 반복 일정 그룹 id (같은 시리즈끼리 공유)
}
export interface OfficeNote { id: string; title: string; body: string; category: string; pinned: boolean; ts: number }

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
  addTodo: (t: { text: string; time?: string; urgent?: boolean; priority?: OfficePriority; progress?: number; assignee?: string; memo?: string; inSchedule?: boolean }) => void;
  toggleTodo: (id: string) => void;
  updateTodo: (id: string, patch: Partial<Omit<OfficeTodo, 'id'>>) => void;
  removeTodo: (id: string) => void;
  addSchedule: (s: { date: string; time: string; end?: string; title: string; place?: string; category?: string }) => void;
  addSchedules: (items: { date: string; time: string; end?: string; title: string; place?: string; category?: string; repeatId?: string }[]) => void;
  updateSchedule: (id: string, patch: Partial<Omit<OfficeSchedule, 'id'>>) => void;
  removeSchedule: (id: string) => void;
  removeSeries: (repeatId: string) => void;
  addNote: (n: { title?: string; body: string; category?: string; pinned?: boolean }) => void;
  updateNote: (id: string, patch: Partial<Omit<OfficeNote, 'id'>>) => void;
  togglePin: (id: string) => void;
  removeNote: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const hhmmNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const sortSched = (a: OfficeSchedule, b: OfficeSchedule) =>
  a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set) => ({
      todos: [],
      schedules: [],
      notes: [],

      addTodo: ({ text, time = '', urgent = false, priority, progress, assignee, memo, inSchedule }) =>
        set((s) => ({ todos: [...s.todos, { id: uid(), text, time, urgent, done: false, priority, progress, assignee, memo, inSchedule }] })),
      toggleTodo: (id) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? hhmmNow() : undefined } : t)) })),
      updateTodo: (id, patch) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),

      addSchedule: ({ date, time, end = '', title, place = '', category = 'blue' }) =>
        set((s) => ({
          schedules: [...s.schedules, { id: uid(), date, time, end, title, place, category }].sort(sortSched),
        })),
      addSchedules: (items) =>
        set((s) => ({
          schedules: [
            ...s.schedules,
            ...items.map((it) => ({ id: uid(), date: it.date, time: it.time, end: it.end ?? '', title: it.title, place: it.place ?? '', category: it.category ?? 'blue', repeatId: it.repeatId })),
          ].sort(sortSched),
        })),
      updateSchedule: (id, patch) =>
        set((s) => ({ schedules: s.schedules.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(sortSched) })),
      removeSchedule: (id) => set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) })),
      removeSeries: (repeatId) => set((s) => ({ schedules: s.schedules.filter((x) => x.repeatId !== repeatId) })),

      addNote: ({ title = '', body, category = 'gray', pinned = false }) =>
        set((s) => ({ notes: [{ id: uid(), title, body, category, pinned, ts: Date.now() }, ...s.notes] })),
      updateNote: (id, patch) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
      togglePin: (id) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    {
      name: 'officeDash',
      version: 3,
      // v1 일정→날짜·카테고리 / v2 메모(text만)→제목·카테고리·고정 구조로 이전
      migrate: (persisted, version) => {
        const p = persisted as { todos?: OfficeTodo[]; schedules?: OfficeSchedule[]; notes?: unknown[] } | null;
        if (!p) return p as unknown as OfficeState;
        if (version < 2 && Array.isArray(p.schedules)) {
          const d = new Date();
          const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          p.schedules = (p.schedules as OfficeSchedule[]).map((s) => ({
            id: s.id, title: s.title, place: s.place ?? '',
            time: s.time ?? '', end: s.end ?? '', date: s.date ?? today, category: s.category ?? 'blue',
          }));
        }
        if (version < 3 && Array.isArray(p.notes)) {
          p.notes = (p.notes as { id: string; text?: string; body?: string }[]).map((n) => ({
            id: n.id, title: '', body: n.body ?? n.text ?? '', category: 'gray', pinned: false, ts: Date.now(),
          }));
        }
        return p as unknown as OfficeState;
      },
    },
  ),
);
