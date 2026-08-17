'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, Trophy } from 'lucide-react';
import { requestEntryModal } from '@/lib/entryModalGate';
import styles from './InternWelcomeModal.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
const STORAGE_KEY = 'kim-minkyung-award-2026-05-dismiss';
const SHOW_FROM = '2026-05-21';
const SHOW_UNTIL = '2026-05-26';

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

export default function KimMinkyungAwardModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 진입 모달 스택 정리 — 세션당 1개만 (우선순위 게이트)
    if (shouldShow()) requestEntryModal('kim-minkyung-award', () => setOpen(true));
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
      aria-label="김민경 기관사 우수상 수상 축하"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Trophy size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>우수상 수상 축하</h2>
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
              src="/notice/kim-minkyung-award-2026.png"
              alt="김민경 기관사 최우수방송왕 우수상 수상 축하 이미지"
              width={1671}
              height={941}
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
