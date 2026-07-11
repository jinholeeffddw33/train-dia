import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CommuteState {
  /** 즐겨찾기 역 목록 (최대 10개) */
  favorites: string[];
  /** 즐겨찾기 추가 */
  addFavorite: (station: string) => void;
  /** 즐겨찾기 제거 */
  removeFavorite: (station: string) => void;
  /** 순서 이동 */
  reorder: (from: number, to: number) => void;
}

/** 사업소 홈 역 — 도착정보 즐겨찾기에 기본 등록 */
const DEFAULT_FAVORITE = '답십리';

export const useCommuteStore = create<CommuteState>()(
  persist(
    (set) => ({
      favorites: [DEFAULT_FAVORITE],

      addFavorite: (station) =>
        set((state) => {
          if (state.favorites.includes(station)) return state;
          if (state.favorites.length >= 10) return state;
          return { favorites: [...state.favorites, station] };
        }),

      removeFavorite: (station) =>
        set((state) => ({
          favorites: state.favorites.filter((s) => s !== station),
        })),

      reorder: (from, to) =>
        set((state) => {
          const next = [...state.favorites];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return { favorites: next };
        }),
    }),
    {
      name: 'cmFavStations',
      version: 1,
      // 기존 사용자(v0)도 답십리 기본 즐겨찾기 1회 주입 (없을 때 맨 앞에)
      migrate: (persisted, version) => {
        const favs: string[] = (persisted as { favorites?: string[] } | null)?.favorites ?? [];
        if (version < 1 && !favs.includes(DEFAULT_FAVORITE)) {
          return { favorites: [DEFAULT_FAVORITE, ...favs].slice(0, 10) };
        }
        return { favorites: favs };
      },
      partialize: (state) => ({ favorites: state.favorites }),
    },
  ),
);
