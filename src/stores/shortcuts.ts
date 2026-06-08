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
  /** 시드 식별자 — 기본 제공 바로가기 (사용자 삭제 후 재시드 방지) */
  seedKey?: string;
}

interface ShortcutsState {
  items: Shortcut[];
  /** 이미 시드 처리된 기본 바로가기 키 — 사용자가 지워도 다시 추가하지 않음 */
  seededKeys: string[];
  add: (item: Omit<Shortcut, 'id' | 'createdAt'>) => void;
  update: (id: string, patch: Partial<Pick<Shortcut, 'title' | 'url' | 'pinned'>>) => void;
  remove: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  /** JSON 내보내기 */
  exportData: () => string;
  /** JSON 가져오기 (기존 데이터에 병합) */
  importData: (json: string) => { added: number; skipped: number };
  /** 기본 바로가기 시드 (처음 한 번만, 사용자 삭제 후 재시드 안 함) */
  seedDefaults: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 모든 사용자에게 기본 제공되는 바로가기 */
const DEFAULT_SHORTCUTS: Array<{
  seedKey: string;
  type: ShortcutType;
  title: string;
  url: string;
  pinned?: boolean;
}> = [
  {
    seedKey: 'smrthink-cafe',
    type: 'web',
    title: '스마트띵크 카페',
    url: 'https://cafe.naver.com/smrthink',
    pinned: true,
  },
];

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      items: [],
      seededKeys: [],

      seedDefaults: () =>
        set((state) => {
          const newSeeds: Shortcut[] = [];
          const seededKeys = [...state.seededKeys];
          for (const def of DEFAULT_SHORTCUTS) {
            if (seededKeys.includes(def.seedKey)) continue;
            newSeeds.push({
              ...def,
              id: generateId(),
              createdAt: Date.now(),
            });
            seededKeys.push(def.seedKey);
          }
          if (newSeeds.length === 0) return state;
          // 시드는 목록 맨 앞에 배치 (pinned 효과)
          return { items: [...newSeeds, ...state.items], seededKeys };
        }),

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
      partialize: (state) => ({ items: state.items, seededKeys: state.seededKeys }),
      onRehydrateStorage: () => (state) => {
        // 저장소 복원 직후 시드 (브라우저 환경에서만)
        if (typeof window !== 'undefined' && state) {
          // setTimeout으로 다음 tick에 실행 — Zustand 상태가 완전히 안정된 뒤 동작
          setTimeout(() => useShortcutsStore.getState().seedDefaults(), 0);
        }
      },
    },
  ),
);
