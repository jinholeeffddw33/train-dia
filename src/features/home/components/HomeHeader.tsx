'use client';

import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import { today } from '@/lib/schedule';
import HeaderClock from './HeaderClock';
import styles from '../styles/Home.module.css';

export default function HomeHeader() {
  const driver = useDriverStore((s) => s.current);
  const td = today();
  const dow = DOW[td.getDay()];
  const dateStr = `${td.getMonth() + 1}월 ${td.getDate()}일 (${dow})`;

  return (
    <header className={styles.headerSection}>
      <div className={styles.headerTop}>
        <div className={styles.headerLeft}>
          {driver ? (
            <span className={styles.headerName}>{driver.n} <span className={styles.headerRole}>기관사님</span></span>
          ) : (
            <span className={styles.headerName}>기관사 DIA</span>
          )}
          <span className={styles.headerDate}>{dateStr}</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.clockRow}>
            <HeaderClock />
          </div>
          <span className={styles.headerOrg}>답십리승무사업소</span>
        </div>
      </div>
    </header>
  );
}
