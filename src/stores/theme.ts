import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

/** localStorage에서 테마를 동기적으로 읽기 (persist rehydration 전에 정확한 초기값 보장) */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = localStorage.getItem('dia-theme');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.theme === 'light') return 'light';
    }
  } catch { /* 무시 */ }
  return 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: getInitialTheme(),

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
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

// 모듈 로드 시 즉시 DOM 적용 (FOUC 방지 보강)
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme());
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F0F4F8');
  }
}
