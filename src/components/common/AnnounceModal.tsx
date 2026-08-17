'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, Megaphone } from 'lucide-react';
import { requestEntryModal } from '@/lib/entryModalGate';
import styles from './InternWelcomeModal.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
// 3일 공지 (2026-07-14 ~ 07-16). 전 직원 대상.
const STORAGE_KEY = 'announce-2026-07-14-dismiss';
const SHOW_FROM = '2026-07-14';
const SHOW_UNTIL = '2026-07-16';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shouldShow(): boolean {
  const today = todayStr();
  if (today < SHOW_FROM || today > SHOW_UNTIL) return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === today) return false;
  } catch { /* ignore */ }
  return true;
}

export default function AnnounceModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldShow()) requestEntryModal('announce-2026-07-14', () => setOpen(true));
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
    acquireScrollLock();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="공지사항"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Megaphone size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>공지사항</h2>
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
              src="/notice/announce-2026-07-14.png"
              alt="공지사항 이미지"
              width={1536}
              height={1024}
              className={styles.photo}
              priority
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`z-glass-pill ${styles.btnSecondary}`}
            onClick={handleDismissToday}
            data-press
          >
            오늘 그만 보기
          </button>
          <button
            type="button"
            className={`z-cta ${styles.btnPrimary}`}
            onClick={handleClose}
            data-press
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
