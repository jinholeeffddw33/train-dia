'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/theme';
import styles from './DevThemeToggle.module.css';

export default function DevThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (process.env.NODE_ENV !== 'development') return null;
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={`현재: ${isDark ? '다크' : '라이트'} (개발 전용)`}
    >
      {isDark ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
      <span className={styles.label}>{isDark ? 'DARK' : 'LIGHT'}</span>
    </button>
  );
}
