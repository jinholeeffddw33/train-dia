'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, PartyPopper } from 'lucide-react';
import { requestEntryModal } from '@/lib/entryModalGate';
import styles from './WhatsNewModal.module.css';

const STORAGE_KEY = 'welcome-interns-2026-07-07-dismiss';
const SHOW_FROM = '2026-07-07';
const SHOW_UNTIL = '2026-07-09'; // 3일간 (07/07·07/08·07/09)

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

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldShow()) requestEntryModal('whats-new', () => setOpen(true));
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
      aria-label="신규 인턴 환영"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <PartyPopper size={20} className={styles.titleIcon} />
            <h2 className={styles.title}>신규 인턴 환영</h2>
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
          <p className={styles.welcomeIntro}>
            답십리 승무사업소에 새로 오신 <strong>두 분</strong>을 진심으로 환영합니다.
          </p>

          <figure className={styles.photoWrap}>
            <img
              src="/welcome/interns-2026-07.jpg"
              alt="신규 인턴 조건희(왼쪽), 신석희(오른쪽)"
              className={styles.photo}
            />
            <div className={styles.nameOverlay}>
              <span className={`${styles.nameTag} ${styles.nameTagLeft}`}>
                <span className={styles.nameLabel}>왼쪽</span>
                <strong>조건희</strong>
              </span>
              <span className={`${styles.nameTag} ${styles.nameTagRight}`}>
                <span className={styles.nameLabel}>오른쪽</span>
                <strong>신석희</strong>
              </span>
            </div>
          </figure>

          <ul className={styles.internList}>
            <li className={styles.internItem}>
              <span className={`${styles.internBadge} ${styles.internBadgeLeft}`}>왼쪽</span>
              <span className={styles.internName}>조건희</span>
              <span className={styles.internSabun}>사번 22601134</span>
            </li>
            <li className={styles.internItem}>
              <span className={`${styles.internBadge} ${styles.internBadgeRight}`}>오른쪽</span>
              <span className={styles.internName}>신석희</span>
              <span className={styles.internSabun}>사번 22601146</span>
            </li>
          </ul>

          <p className={styles.welcomeNote}>
            마주치시면 반갑게 인사 부탁드립니다.
          </p>
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
            환영합니다
          </button>
        </div>
      </div>
    </div>
  );
}
