'use client';

import { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
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
  const meta = kind ? MISSION_CARD_META[kind] : null;

  const handleClose = useCallback(() => onClose(), [onClose]);

  // 카드 미발급 대상이면 모달 자체를 띄우지 않음 (안전망)
  useEffect(() => { if (!meta) onClose(); }, [meta, onClose]);
  if (!meta) return null;

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
            {/* next/image 최적화 — 원본 700KB+ jpg 를 뷰포트 크기로 리사이즈 전송.
                width/height 는 대표 비율(레이아웃 예약용) — CSS width:100%/height:auto 가 실제 비율 유지 */}
            <Image
              src={meta.image}
              alt={`${meta.label} 임무카드`}
              width={1969}
              height={2908}
              className={styles.photo}
              sizes="(max-width: 720px) 100vw, 720px"
              priority
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnPrimary} onClick={handleClose}>
            다 읽었어요
          </button>
        </div>
      </div>
    </div>
  );
}
