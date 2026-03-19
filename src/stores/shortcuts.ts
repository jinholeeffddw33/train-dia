import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShortcutType = 'web' | 'image' | 'file';

export interface Shortcut {
  id: string;
  type: ShortcutType;
  title: string;
  /** 웹: URL, 이미지: base64 data URL, 파일: base64 data URL */
  url: string;
  /** 파일 원본 이름 (image/file 타입) */
  fileName?: string;
  pinned?: boolean;
  createdAt: number;
}

interface ShortcutsState {
  items: Shortcut[];
  add: (item: Omit<Shortcut, 'id' | 'createdAt'>) => void;
  update: (id: string, patch: Partial<Pick<Shortcut, 'title' | 'url' | 'pinned'>>) => void;
  remove: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  /** JSON 내보내기 */
  exportData: () => string;
  /** JSON 가져오기 (기존 데이터에 병합) */
  importData: (json: string) => { added: number; skipped: number };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item) =>
        set((state) => ({
          items: [
            { ...item, id: generateId(), createdAt: Date.now() },
            ...state.items,
          ],
        })),

      update: (id, patch) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, ...patch } : it,
          ),
        })),

      remove: (id) =>
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        })),

      reorder: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.items];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { items: next };
        }),

      exportData: () => {
        const { items } = get();
        return JSON.stringify({ version: 1, shortcuts: items }, null, 2);
      },

      importData: (json) => {
        const parsed = JSON.parse(json);
        const incoming: Shortcut[] = parsed.shortcuts ?? [];
        const existing = get().items;
        const existingUrls = new Set(existing.map((it) => it.url));
        const newItems = incoming.filter((it) => !existingUrls.has(it.url));
        if (newItems.length > 0) {
          set({ items: [...newItems, ...existing] });
        }
        return { added: newItems.length, skipped: incoming.length - newItems.length };
      },
    }),
    {
      name: 'diaShortcuts',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
