'use client';

import { useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import CalendarGrid from './CalendarGrid';
import ScheduleDetail from './ScheduleDetail';
import styles from '../styles/Calendar.module.css';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarTab() {
  const driver = useDriverStore((s) => s.current);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

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
    const fresh = new Date();
    setYear(fresh.getFullYear());
    setMonth(fresh.getMonth() + 1);
    setSelectedDate(todayStr());
  };

  if (!driver) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📅</span>
        <p className={styles.emptyText}>기관사를 선택하면{'\n'}달력에 교번이 표시돼요</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 월 네비게이션 */}
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="이전 달">‹</button>
        <button type="button" className={styles.navTitle} onClick={goToday}>
          {year}년 <span className={styles.navMonth}>{month}월</span>
        </button>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      {/* 기관사 이름 */}
      <div className={styles.driverInfo}>
        <span className={styles.driverName}>{driver.n}</span>
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
