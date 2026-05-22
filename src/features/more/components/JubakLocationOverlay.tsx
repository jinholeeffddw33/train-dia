'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ArrowLeft, MapPin } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import moreStyles from '../styles/More.module.css';
import styles from '../styles/JubakLocation.module.css';

const STATIONS: { slug: string; label: string }[] = [
  { slug: 'hwagok',          label: '화곡' },
  { slug: 'yeouido',         label: '여의도' },
  { slug: 'aeogae',          label: '애오개' },
  { slug: 'wangsimni',       label: '왕십리' },
  { slug: 'gunja',           label: '군자' },
  { slug: 'hanamgeomdansan', label: '하남검단산' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function JubakLocationOverlay({ open, onClose }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const handleBack = useCallback(() => {
    if (zoomed) { setZoomed(false); return; }
    if (activeSlug) { setActiveSlug(null); return; }
    onClose();
  }, [zoomed, activeSlug, onClose]);

  useHistoryBack('jubak-location', handleBack, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleBack(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleBack]);

  // 모달 닫히면 상태 초기화
  useEffect(() => {
    if (!open) { setActiveSlug(null); setZoomed(false); }
  }, [open]);

  if (!open) return null;
  const activeLabel = STATIONS.find((s) => s.slug === activeSlug)?.label;

  return (
    <div className={moreStyles.fullOverlay}>
      <div className={moreStyles.overlayHeader}>
        <button
          type="button"
          className={moreStyles.overlayClose}
          onClick={handleBack}
          aria-label="닫기"
        >
          {activeSlug ? <ArrowLeft size={22} /> : <X size={22} />}
        </button>
        <h2 className={moreStyles.overlayTitle}>
          {activeSlug ? `${activeLabel} 주박위치` : '5호선 주박위치'}
        </h2>
      </div>

      <div className={styles.body}>
        {!activeSlug && (
          <>
            <p className={styles.intro}>주박위치를 확인할 역을 선택하세요</p>
            <div className={styles.grid}>
              {STATIONS.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  className={styles.stationBtn}
                  onClick={() => setActiveSlug(s.slug)}
                  aria-label={`${s.label} 주박위치 보기`}
                >
                  <div className={styles.stationIcon}>
                    <MapPin size={26} strokeWidth={2.2} />
                  </div>
                  <span className={styles.stationLabel}>{s.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {activeSlug && (
          <button
            type="button"
            className={styles.photoBtn}
            onClick={() => setZoomed(true)}
            aria-label="확대"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/notice/jubak/${activeSlug}.png`}
              alt={`${activeLabel} 주박위치`}
              className={styles.photo}
              loading="eager"
            />
          </button>
        )}
      </div>

      {zoomed && activeSlug && (
        <div
          className={styles.zoomOverlay}
          onClick={() => setZoomed(false)}
          role="button"
          tabIndex={0}
          aria-label="닫기"
          onKeyDown={(e) => e.key === 'Escape' && setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/notice/jubak/${activeSlug}.png`}
            alt={`${activeLabel} 주박위치 확대`}
            className={styles.zoomImg}
          />
        </div>
      )}
    </div>
  );
}
