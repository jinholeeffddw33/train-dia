'use client';

import { useClock } from '../hooks/useClock';
import styles from '../styles/Home.module.css';

/** 시계 영역만 매초 리렌더 — HomeHeader 전체 리렌더 방지 */
export default function HeaderClock() {
  const clock = useClock();
  const ampm = parseInt(clock.hours) < 12 ? '오전' : '오후';

  return (
    <>
      <span className={styles.clockAmPm}>{ampm}</span>
      <span className={styles.clockBig}>{clock.hours}:{clock.minutes}</span>
      <span className={styles.clockSec}>:{clock.seconds}</span>
    </>
  );
}
