'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { X, RefreshCw } from 'lucide-react';
import styles from './RefreshGuideModal.module.css';

const STORAGE_KEY = 'refresh-guide-2026-05-dismiss';
const SHOW_FROM = '2026-05-09';
const SHOW_UNTIL = '2026-05-11';

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

export default function RefreshGuideModal() {
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
      aria-label="새로고침 기능 및 게임 랭킹 안내"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <RefreshCw size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>업데이트 안내</h2>
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
              src="/notice/refresh-guide.jpg"
              alt="홈 화면 우측 상단 새로고침 버튼 위치 안내"
              width={300}
              height={420}
              className={styles.photo}
              priority
            />
          </div>

          <p className={styles.message}>
            <span className={styles.highlight}>새로고침 기능</span>이 추가되었습니다.{'\n'}
            가끔 눌러주시면 자동 업데이트가 안 되시는 분들도 강제 업데이트가 가능합니다.{'\n\n'}
            그리고 <span className={styles.highlight}>게임 랭킹은 매달 재설정</span>됩니다.{'\n'}
            새롭게 도전해보세요!
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
