'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import moreStyles from '../styles/More.module.css';
import styles from '../styles/ShuttleSchedule.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'shuttle' | 'depot';

export default function ShuttleScheduleOverlay({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('shuttle');
  const [zoomed, setZoomed] = useState<string | null>(null);

  if (!open) return null;

  const imgSrc = tab === 'shuttle'
    ? '/images/shuttle-schedule.jpg'
    : '/images/depot-schedule.jpg';

  const imgAlt = tab === 'shuttle'
    ? '2026년 고덕기지 승용차 운행 시간표'
    : '2026년 고덕기지 입고열차';

  return (
    <div className={moreStyles.fullOverlay}>
      <div className={moreStyles.overlayHeader}>
        <button
          type="button"
          className={moreStyles.overlayClose}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={22} />
        </button>
        <h2 className={moreStyles.overlayTitle}>승용차 운행 시간표(고덕기지 입고열차)</h2>
      </div>

      <div className={styles.shuttleBody}>
        <div className={styles.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'shuttle'}
            className={`${styles.tabBtn} ${tab === 'shuttle' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('shuttle')}
          >
            승용차 운행시간표
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'depot'}
            className={`${styles.tabBtn} ${tab === 'depot' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('depot')}
          >
            고덕기지 입고열차
          </button>
        </div>

        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => setZoomed(imgSrc)}
          aria-label="확대"
        >
          <img
            src={imgSrc}
            alt={imgAlt}
            className={styles.scheduleImg}
            loading="eager"
          />
        </button>
      </div>

      {zoomed && (
        <div
          className={styles.zoomOverlay}
          onClick={() => setZoomed(null)}
          role="button"
          tabIndex={0}
          aria-label="닫기"
          onKeyDown={(e) => e.key === 'Escape' && setZoomed(null)}
        >
          <img
            src={zoomed}
            alt={imgAlt}
            className={styles.zoomImg}
          />
        </div>
      )}
    </div>
  );
}
