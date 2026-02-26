'use client';

import { useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import CalendarGrid from './CalendarGrid';
import ScheduleDetail from './ScheduleDetail';
import styles from '../styles/Calendar.module.css';

export default function CalendarTab() {
  const driver = useDriverStore((s) => s.current);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(null);
  };

  if (!driver) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📅</span>
        <p className={styles.emptyText}>기관사를 선택하면{'\n'}교번이 달력에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 월 네비게이션 */}
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="이전 달">‹</button>
        <button type="button" className={styles.navTitle} onClick={goToday}>
          {year}년 {month}월
        </button>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      {/* 기관사 이름 */}
      <div className={styles.driverInfo}>
        <span className={styles.driverName}>{driver.n}</span>
        <span className={styles.driverNum}>{driver.I}번</span>
      </div>

      {/* 달력 그리드 */}
      <CalendarGrid
        year={year}
        month={month}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* 선택된 날짜 상세 */}
      {selectedDate && <ScheduleDetail dateStr={selectedDate} />}
    </div>
  );
}
