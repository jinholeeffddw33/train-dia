'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Megaphone, Gauge } from 'lucide-react';
import { requestEntryModal } from '@/lib/entryModalGate';
import styles from './InternWelcomeModal.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
// 스피드 마스터 안내 (2026-08-26 ~ 08-28). 전 직원 대상.
// SHOW_UNTIL 은 그 날짜까지 포함이라 28일 밤 12시에 저절로 내려간다.
const STORAGE_KEY = 'announce-2026-08-26-speedmaster-dismiss';
const SHOW_FROM = '2026-08-26';
const SHOW_UNTIL = '2026-08-28';

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
    if (shouldShow()) requestEntryModal('announce-2026-08-26-speedmaster', () => setOpen(true));
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
            <h3 className={styles.noticeHead}>새 게임 — 스피드 마스터</h3>
            <p className={styles.noticeText}>
              쉬는 시간에 <b>운행 속도를 익히는 게임</b>이 새로 생겼습니다.
            </p>
            <p className={styles.noticeText}>
              화면에는 상황만 나옵니다. <b>몇 km/h로 가야 하는지 직접 판단</b>해서,
              주간제어기를 잡고 역행·제동으로 속도를 맞추면 됩니다.
              구간이 끝나면 정답을 알려드립니다.
            </p>
            <p className={styles.noticeWhere}>
              <Gauge size={18} strokeWidth={2.2} />
              라이프 → 스피드 마스터
            </p>
            <p className={styles.noticeUntil}>이 안내는 8월 28일까지 보입니다.</p>
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
