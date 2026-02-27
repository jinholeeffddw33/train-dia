import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark' as Theme,

      toggle: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      },

      setTheme: (t: Theme) => {
        set({ theme: t });
        applyTheme(t);
      },
    }),
    {
      name: 'dia-theme',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // persist 실패 시 localStorage 직접 읽기
          readAndApplyTheme();
          return;
        }
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

// 클라이언트 안전장치: persist 실패 대비 직접 읽기
if (typeof window !== 'undefined') {
  readAndApplyTheme();
}

/** localStorage에서 직접 읽어 테마 적용 (persist 실패 대비) */
function readAndApplyTheme() {
  try {
    const raw = localStorage.getItem('dia-theme');
    if (raw) {
      const parsed = JSON.parse(raw);
      const t = parsed?.state?.theme;
      if (t === 'light' || t === 'dark') applyTheme(t);
    }
  } catch { /* 무시 */ }
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
  // 테마 컬러 메타 태그 업데이트
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F0F4F8');
  }
}
