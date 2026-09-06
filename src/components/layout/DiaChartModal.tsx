'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { getType, isHoliday } from '@/lib/schedule';
import styles from './DiaChartModal.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
interface DiaChartModalProps {
  open: boolean;
  dia: string | null;
  date: Date;
  diaLabel?: string;
  /** 작은 미리보기 — 화면을 꽉 채우지 않고 작게 표시 (예: 5호선 운행 화면 기관사 탭) */
  compact?: boolean;
  onClose: () => void;
}

function getRouteImagePath(dia: string, date: Date): string | null {
  if (dia.startsWith('휴') || dia.startsWith('대')) return null;
  const diaNum = parseInt(dia.replace(/\D/g, ''));
  if (isNaN(diaNum)) return null;
  const h = isHoliday(date);
  const tm = new Date(date);
  tm.setDate(tm.getDate() + 1);
  const th = isHoliday(tm);
  const isNight = getType(dia) === 'night';
  let prefix: string;
  if (!isNight) { prefix = h ? 'p_hol' : 'p_ord'; }
  else if (h && th) prefix = 'p_hh';
  else if (h && !th) prefix = 'p_hp';
  else if (!h && th) prefix = 'p_ph';
  else prefix = 'p_pp';
  return `/images/route/${prefix}_${diaNum}.png`;
}

/**
 * 이 교번에 볼 행로표가 있는가 — 휴무·비번·대기는 운전행로가 없다.
 * 누를 수 있는 것만 누르게 하려고 부르는 쪽에서 미리 쓴다(눌렀더니 빈 창이 뜨지 않도록).
 */
export function hasDiaChart(dia: string | null | undefined): boolean {
  if (!dia) return false;
  if (dia.startsWith('휴') || dia.startsWith('대') || dia.endsWith('~')) return false;
  return !isNaN(parseInt(dia.replace(/\D/g, '')));
}

export default function DiaChartModal({ open, dia, date, diaLabel, compact, onClose }: DiaChartModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    setImgError(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    acquireScrollLock();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
    };
  }, [open, handleClose]);

  if (!open) return null;

  const imgPath = dia ? getRouteImagePath(dia, date) : null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="다이아 표"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={`${styles.content} ${compact ? styles.contentCompact : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {diaLabel ? `${diaLabel} 다이아 표` : '다이아 표'}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="닫기"
          >
            <X size={22} strokeWidth={2.4} />
          </button>
        </div>
        <div className={styles.body}>
          {imgPath && !imgError ? (
            <div className={styles.imgWrap}>
              <Image
                src={imgPath}
                alt={`${diaLabel ?? dia} 다이아 운전행로`}
                width={1200}
                height={900}
                className={styles.img}
                onError={() => setImgError(true)}
                priority
                unoptimized
              />
            </div>
          ) : (
            <div className={styles.empty}>
              <p>이 다이아의 표 이미지가 준비되지 않았어요.</p>
              <p className={styles.emptySub}>
                {dia ? `(${dia})` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
