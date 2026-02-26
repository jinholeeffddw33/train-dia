'use client';

import { useState, useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { getMonthSummary, today } from '@/lib/schedule';
import styles from '../styles/Home.module.css';

export default function MonthSummary() {
  const driver = useDriverStore((s) => s.current);
  const td = today();
  const [offset, setOffset] = useState(0);

  const targetYear = td.getFullYear();
  const targetMonth = td.getMonth() + 1 + offset;
  const adjustedYear = targetYear + Math.floor((targetMonth - 1) / 12);
  const adjustedMonth = ((targetMonth - 1) % 12 + 12) % 12 + 1;

  const summary = useMemo(() => {
    if (!driver) return null;
    return getMonthSummary(driver, adjustedYear, adjustedMonth);
  }, [driver, adjustedYear, adjustedMonth]);

  if (!driver || !summary) return null;

  const totalWork = summary.dayWork + summary.nightWork;
  const totalStandby = summary.dayStandby + summary.nightStandby;

  return (
    <section className={styles.monthSection}>
      <div className={styles.monthHeader}>
        <button
          type="button"
          className={styles.monthNav}
          onClick={() => setOffset((o) => o - 1)}
          aria-label="이전 달"
        >
          ‹
        </button>
        <h3 className={styles.monthTitle}>
          {adjustedYear}년 {adjustedMonth}월
        </h3>
        <button
          type="button"
          className={styles.monthNav}
          onClick={() => setOffset((o) => o + 1)}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className={styles.monthGrid}>
        <div className={styles.monthItem}>
          <span className={styles.monthValue}>{totalWork}</span>
          <span className={styles.monthLabel}>근무일</span>
        </div>
        <div className={styles.monthItem}>
          <span className={styles.monthValue}>{summary.dayWork}</span>
          <span className={`${styles.monthLabel} ${styles.monthLabelDay}`}>주간</span>
        </div>
        <div className={styles.monthItem}>
          <span className={styles.monthValue}>{summary.nightWork}</span>
          <span className={`${styles.monthLabel} ${styles.monthLabelNight}`}>야간</span>
        </div>
        <div className={styles.monthItem}>
          <span className={styles.monthValue}>{totalStandby}</span>
          <span className={`${styles.monthLabel} ${styles.monthLabelStandby}`}>대기</span>
        </div>
      </div>
    </section>
  );
}
