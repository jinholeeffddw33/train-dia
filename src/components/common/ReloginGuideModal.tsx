'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, LogOut } from 'lucide-react';
import styles from './ReloginGuideModal.module.css';

const STORAGE_KEY = 'relogin-guide-2026-06-dismiss';
const SHOW_FROM = '2026-06-16';
const SHOW_UNTIL = '2026-06-18';

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

export default function ReloginGuideModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

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
      aria-label="근무 정보 안내"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <LogOut size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>근무 정보 안내</h2>
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
            근무가 맞지 않는 분들은<br />
            <strong>설정</strong>에서 <strong>로그아웃 후 다시 로그인</strong>하시면<br />
            정확히 맞아요.
          </p>
          <div className={styles.photoWrap}>
            <Image
              src="/notice/relogin-guide-2026-06.jpg"
              alt="설정 화면에서 로그아웃 버튼 위치 안내"
              width={714}
              height={670}
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
