'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants';
import { requestEntryModal } from '@/lib/entryModalGate';
import styles from './CycleChangeModal.module.css';

const STORAGE_KEY = 'cycle-change-2026-05-15-dismiss';
const SHOW_FROM = '2026-05-12';
const SHOW_UNTIL = '2026-05-15';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shouldShow(): boolean {
  const today = todayStr();
  if (today < SHOW_FROM || today > SHOW_UNTIL) return false;
  try {
    const dismissedOn = localStorage.getItem(STORAGE_KEY);
    if (dismissedOn === today) return false;
  } catch { /* ignore */ }
  return true;
}

export default function CycleChangeModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 진입 모달 스택 정리 — 세션당 1개만 (우선순위 게이트)
    if (shouldShow()) requestEntryModal('cycle-change', () => setOpen(true));
  }, []);

  const handleDismissToday = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, todayStr()); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="교번 배열 변경 안내"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <AlertCircle size={20} className={styles.titleIcon} />
            <h2 className={styles.title}>교번 배열 변경 안내</h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="닫기"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>
            <span className={styles.highlight}>15일부터</span> 변경된 교번 배열이 적용되었습니다.{'\n'}
            오류가 있을 경우 알려주시면 수정하겠습니다.{'\n\n'}
            현재 이 앱의 버전은 <span className={styles.highlight}>{APP_VERSION.toUpperCase()}</span>입니다.
          </p>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`z-cta ${styles.btnPrimary}`}
            onClick={handleDismissToday}
            data-press
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
