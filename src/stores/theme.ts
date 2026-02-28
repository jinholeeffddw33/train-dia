import { create } from 'zustand';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'dia-theme';

interface ThemeState {
  theme: Theme;
  isLoaded: boolean;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

/** localStorage에서 테마 읽기 (레거시 Zustand persist 포맷 호환) */
function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // 새 포맷: plain string
    if (raw === 'light' || raw === 'dark') return raw;
    // 레거시: Zustand persist 포맷 {"state":{"theme":"light"},"version":0}
    const parsed = JSON.parse(raw);
    if (parsed?.state?.theme) return parsed.state.theme as Theme;
  } catch { /* 무시 */ }
  return null;
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

function saveTheme(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* quota 초과 등 무시 */ }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  isLoaded: false,

  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    applyTheme(next);
    saveTheme(next);
  },

  setTheme: (t: Theme) => {
    set({ theme: t });
    applyTheme(t);
    saveTheme(t);
  },
}));

// 모듈 로드 시 즉시 초기화 (FOUC 방지)
if (typeof window !== 'undefined') {
  const stored = readStoredTheme();
  const theme = stored ?? 'dark';
  applyTheme(theme);
  // 레거시 포맷이면 새 포맷으로 마이그레이션
  saveTheme(theme);
  useThemeStore.setState({ theme, isLoaded: true });
}
