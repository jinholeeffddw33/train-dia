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

export const useCommuteStore = create<CommuteState>()(
  persist(
    (set) => ({
      favorites: [],

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
      partialize: (state) => ({ favorites: state.favorites }),
    },
  ),
);
