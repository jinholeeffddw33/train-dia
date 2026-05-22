'use client';

import { useEffect, useRef, useCallback } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { getMissionCardKind, MISSION_CARD_META } from '@/lib/auth';
import styles from '../styles/MissionCard.module.css';

interface Props {
  sabun: string | undefined | null;
  name: string;
  onClose: () => void;
}

export default function MissionCardModal({ sabun, name, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const kind = getMissionCardKind(sabun);
  const meta = MISSION_CARD_META[kind];

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [handleClose]);

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="개인별 임무카드"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <ShieldAlert size={20} className={styles.titleIcon} />
            <div className={styles.titleWrap}>
              <h2 className={styles.title}>개인별 임무카드</h2>
              <span className={styles.subtitle}>{name} · <strong>{meta.label}</strong></span>
            </div>
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
            {/* 일반 <img> 사용 — Next/Image는 외부 host 설정 필요. 로컬 자산이므로 img로 충분 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.image}
              alt={`${meta.label} 임무카드`}
              className={styles.photo}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnPrimary} onClick={handleClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
