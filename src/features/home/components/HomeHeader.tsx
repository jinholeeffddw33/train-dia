'use client';

import { useClock } from '../hooks/useClock';
import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import { today } from '@/lib/schedule';
import styles from '../styles/Home.module.css';

interface HomeHeaderProps {
  onDriverSelect: () => void;
}

export default function HomeHeader({ onDriverSelect }: HomeHeaderProps) {
  const driver = useDriverStore((s) => s.current);
  const clock = useClock();
  const td = today();
  const dow = DOW[td.getDay()];
  const dateStr = `${td.getMonth() + 1}월 ${td.getDate()}일 (${dow})`;

  return (
    <header className={styles.headerSection}>
      <div className={styles.headerTop}>
        <div className={styles.headerInfo}>
          <h1 className={styles.appTitle}>기관사 DIA</h1>
          <span className={styles.dateText}>{dateStr}</span>
        </div>
        <div className={styles.clockArea}>
          <span className={styles.clockTime}>
            {clock.hours}:{clock.minutes}
          </span>
          <span className={styles.clockSeconds}>:{clock.seconds}</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.driverSelector}
        onClick={onDriverSelect}
        aria-label="기관사 선택"
      >
        {driver ? (
          <>
            <span className={styles.driverName}>{driver.n}</span>
            <span className={styles.driverNum}>{driver.I}번</span>
          </>
        ) : (
          <span className={styles.driverPlaceholder}>기관사를 선택하세요</span>
        )}
        <span className={styles.driverArrow}>›</span>
      </button>
    </header>
  );
}
