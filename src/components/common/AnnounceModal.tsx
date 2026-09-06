'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Megaphone, MapPin, CalendarDays, AlertTriangle } from 'lucide-react';
import { requestEntryModal } from '@/lib/entryModalGate';
import styles from './InternWelcomeModal.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
// 3분기 철도안전교육 안내 (2026-09-06 ~ 09-11 금). 전 직원 대상.
// SHOW_UNTIL 은 그 날짜까지 포함이라 11일 밤 12시에 저절로 내려간다.
// 안내가 바뀔 때 STORAGE_KEY 도 함께 바꾼다 — 안 바꾸면 지난 안내를 «오늘 그만 보기»
// 로 닫아 둔 사람에게 새 안내가 안 뜬다.
const STORAGE_KEY = 'announce-2026-09-06-safety-edu-dismiss';
const SHOW_FROM = '2026-09-06';
const SHOW_UNTIL = '2026-09-11';

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
    if (shouldShow()) requestEntryModal('announce-2026-09-06-safety-edu', () => setOpen(true));
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
          <div className={styles.noticeBody}>
            <h3 className={styles.noticeHead}>3분기 철도안전교육 실시</h3>
            <p className={styles.noticeWhere}>
              <CalendarDays size={18} strokeWidth={2.2} />
              9월 7일(월) ~ 17일(목)
            </p>
            <p className={styles.noticeWhere}>
              <MapPin size={18} strokeWidth={2.2} />
              고덕차량기지 시험선
            </p>
            <p className={styles.noticeAlert}>
              <AlertTriangle size={20} strokeWidth={2.4} aria-hidden />
              <span>원하는 날짜에 꼭 미리 기록해 주세요</span>
            </p>
            <p className={styles.noticeUntil}>이 안내는 9월 11일(금)까지 보입니다.</p>
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
