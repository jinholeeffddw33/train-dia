'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import moreStyles from '../styles/More.module.css';
import styles from '../styles/ShuttleSchedule.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'shuttle' | 'depot';

// 원본 픽셀 크기 — next/image 레이아웃 예약용 (CSS width:100%/height:auto 가 실제 비율 유지)
const IMG_META: Record<Tab, { src: string; width: number; height: number; alt: string }> = {
  shuttle: {
    src: '/images/shuttle-schedule.jpg',
    width: 2481,
    height: 3508,
    alt: '2026년 고덕기지 승용차 운행 시간표',
  },
  depot: {
    src: '/images/depot-schedule.jpg',
    width: 1959,
    height: 1080,
    alt: '2026년 고덕기지 입고열차',
  },
};

export default function ShuttleScheduleOverlay({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('shuttle');
  const [zoomed, setZoomed] = useState(false);

  // ESC — 확대 상태면 확대 해제, 아니면 닫기
  useEscapeClose(open, () => {
    if (zoomed) setZoomed(false);
    else onClose();
  });

  if (!open) return null;

  const meta = IMG_META[tab];

  return (
    <div className={moreStyles.fullOverlay} role="dialog" aria-modal="true" aria-label="승용차 운행 시간표">
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
        <div
          className={`z-segment ${styles.tabBar}`}
          role="tablist"
          data-no-press
          style={{ '--seg-count': 2, '--seg-idx': tab === 'shuttle' ? 0 : 1 } as React.CSSProperties}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'shuttle'}
            className={`z-segment-item ${styles.tabBtn} ${tab === 'shuttle' ? 'is-on' : ''}`}
            onClick={() => setTab('shuttle')}
          >
            승용차 운행시간표
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'depot'}
            className={`z-segment-item ${styles.tabBtn} ${tab === 'depot' ? 'is-on' : ''}`}
            onClick={() => setTab('depot')}
          >
            고덕기지 입고열차
          </button>
        </div>

        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => setZoomed(true)}
          aria-label="확대"
        >
          <Image
            src={meta.src}
            alt={meta.alt}
            width={meta.width}
            height={meta.height}
            className={styles.scheduleImg}
            sizes="100vw"
            priority
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
          {/* 확대 뷰 — 세밀한 시간표 판독용이라 원본 해상도 유지 (핀치줌 가독성) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.src}
            alt={meta.alt}
            className={styles.zoomImg}
          />
        </div>
      )}
    </div>
  );
}
