import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSize = 'small' | 'normal' | 'large';

interface FontSizeState {
  size: FontSize;
  setSize: (s: FontSize) => void;
}

const FONT_SIZE_CLASS_MAP: Record<FontSize, string> = {
  small: 'font-small',
  normal: '',
  large: 'font-large',
};

function applyFontSize(size: FontSize) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // 이전 클래스 제거
  root.classList.remove('font-small', 'font-large');
  // 새 클래스 추가 (normal은 기본이므로 클래스 없음)
  const cls = FONT_SIZE_CLASS_MAP[size];
  if (cls) {
    root.classList.add(cls);
  }
}

export const useFontSizeStore = create<FontSizeState>()(
  persist(
    (set) => ({
      size: 'normal' as FontSize,

      setSize: (s: FontSize) => {
        set({ size: s });
        applyFontSize(s);
      },
    }),
    {
      name: 'dia-font-size',
      partialize: (state) => ({ size: state.size }),
      onRehydrateStorage: () => (state) => {
        if (state) applyFontSize(state.size);
      },
    },
  ),
);
