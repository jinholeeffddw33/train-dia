'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, Sparkles } from 'lucide-react';
import styles from './InternIntroModal.module.css';

const STORAGE_KEY = 'intern-intro-2026-dismiss';
const SHOW_FROM = '2026-05-03';
const SHOW_UNTIL = '2026-05-05';

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

export default function InternIntroModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldShow()) setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleDismissToday = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, todayStr()); } catch { /* ignore */ }
    setOpen(false);
  }, []);

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
      aria-label="2026년 신규임용 직원 안내"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div ref={contentRef} className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Sparkles size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>2026년 신규임용 직원</h2>
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
          <div className={styles.photoWrap}>
            <Image
              src="/images/interns-2026.jpg"
              alt="2026년 신규임용 직원 6명 사진 (이름과 사번 포함)"
              width={620}
              height={840}
              className={styles.photo}
              priority
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleDismissToday}
          >
            오늘 그만 보기
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
