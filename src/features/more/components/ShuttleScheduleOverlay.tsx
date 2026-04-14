'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import moreStyles from '../styles/More.module.css';
import styles from '../styles/ShuttleSchedule.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShuttleScheduleOverlay({ open, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false);

  if (!open) return null;

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
        <h2 className={moreStyles.overlayTitle}>승용차 운행 시간표</h2>
      </div>

      <div className={styles.shuttleBody}>
        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => setZoomed(true)}
          aria-label="확대"
        >
          <img
            src="/images/shuttle-schedule.jpg"
            alt="2026년 고덕기지 승용차 운행 시간표"
            className={styles.scheduleImg}
            loading="eager"
          />
        </button>
      </div>

      {zoomed && (
        <div
          className={styles.zoomOverlay}
          onClick={() => setZoomed(false)}
          role="button"
          tabIndex={0}
          aria-label="닫기"
          onKeyDown={(e) => e.key === 'Escape' && setZoomed(false)}
        >
          <img
            src="/images/shuttle-schedule.jpg"
            alt="2026년 고덕기지 승용차 운행 시간표"
            className={styles.zoomImg}
          />
        </div>
      )}
    </div>
  );
}
