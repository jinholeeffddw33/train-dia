'use client';

import { ChevronRight } from 'lucide-react';
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
  const ampm = parseInt(clock.hours) < 12 ? '오전' : '오후';

  return (
    <header className={styles.headerSection}>
      {/* v1 스타일: 좌우 분할 */}
      <div className={styles.headerTop}>
        <div className={styles.headerLeft}>
          {driver ? (
            <>
              <span className={styles.headerName}>{driver.n} <span className={styles.headerRole}>기관사</span></span>
              <span className={styles.headerGreeting}>안녕하세요</span>
            </>
          ) : (
            <span className={styles.headerName}>기관사 DIA</span>
          )}
          <span className={styles.headerDate}>{dateStr}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.clockAmPm}>{ampm}</span>
          <span className={styles.clockBig}>{clock.hours}:{clock.minutes}</span>
          <span className={styles.clockSec}>:{clock.seconds}</span>
        </div>
      </div>

      {/* 기관사 선택 버튼 (글래스모피즘) */}
      <button
        type="button"
        className={styles.driverSelector}
        onClick={onDriverSelect}
        aria-label="기관사 선택"
      >
        {driver ? (
          <>
            <span className={styles.driverBtnText}>{driver.n}</span>
            <ChevronRight size={18} className={styles.driverBtnArrow} />
          </>
        ) : (
          <>
            <span className={styles.driverBtnText}>기관사를 선택하세요</span>
            <ChevronRight size={18} className={styles.driverBtnArrow} />
          </>
        )}
      </button>

    </header>
  );
}
