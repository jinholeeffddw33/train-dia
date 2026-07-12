import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 내근직 대시보드 — 오늘의 할 일 / 일정 / 메모 (기기 보관) */
export interface OfficeTodo { id: string; text: string; time: string; urgent: boolean; done: boolean; }
export interface OfficeSchedule { id: string; time: string; title: string; place: string; }
export interface OfficeNote { id: string; text: string }

interface OfficeState {
  todos: OfficeTodo[];
  schedules: OfficeSchedule[];
  notes: OfficeNote[];
  addTodo: (t: { text: string; time?: string; urgent?: boolean }) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  addSchedule: (s: { time: string; title: string; place?: string }) => void;
  removeSchedule: (id: string) => void;
  addNote: (text: string) => void;
  removeNote: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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

      addSchedule: ({ time, title, place = '' }) =>
        set((s) => ({
          schedules: [...s.schedules, { id: uid(), time, title, place }]
            .sort((a, b) => a.time.localeCompare(b.time)),
        })),
      removeSchedule: (id) => set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) })),

      addNote: (text) => set((s) => ({ notes: [{ id: uid(), text }, ...s.notes] })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    { name: 'officeDash' },
  ),
);
