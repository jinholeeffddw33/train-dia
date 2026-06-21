'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Sparkles, Moon, ClipboardCheck } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants';
import styles from './WhatsNewModal.module.css';

const STORAGE_KEY = 'whats-new-2026-06-22-dismiss';
const SHOW_FROM = '2026-06-22';
const SHOW_UNTIL = '2026-06-24';

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
      aria-label="새로운 기능 안내"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Sparkles size={20} className={styles.titleIcon} />
            <h2 className={styles.title}>새로운 기능 안내</h2>
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
          <p className={styles.intro}>
            <strong>새롭게 디자인과 기능이 추가</strong>되었습니다.
          </p>

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <Moon size={18} strokeWidth={2.2} />
              </span>
              <div className={styles.featureText}>
                <strong>다크 모드</strong>
                <span>설정에서 활성화 가능</span>
              </div>
            </li>
            <li className={styles.featureItem}>
              <span className={`${styles.featureIcon} ${styles.featureIconIndigo}`}>
                <ClipboardCheck size={18} strokeWidth={2.2} />
              </span>
              <div className={styles.featureText}>
                <strong>대기충당기록부 확인</strong>
                <span>홈 화면에서 최근 3일치 확인</span>
              </div>
            </li>
          </ul>

          <p className={styles.versionLine}>
            현재 버전 <span className={styles.versionBadge}>{APP_VERSION}</span>
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
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
