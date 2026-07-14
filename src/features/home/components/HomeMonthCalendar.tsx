'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import CalendarGrid from '@/features/calendar/components/CalendarGrid';
import ScheduleDetail from '@/features/calendar/components/ScheduleDetail';
import Modal from '@/components/common/Modal';
import styles from '../styles/Home.module.css';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 비번·휴무날 홈 하단에 표시하는 월 근무 달력.
 * 달력 탭과 동일하게 날짜를 누르면 근무 상세(행로 포함) 팝업이 뜬다.
 */
export default function HomeMonthCalendar() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [detailOpen, setDetailOpen] = useState(false);

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
    const f = new Date();
    setYear(f.getFullYear());
    setMonth(f.getMonth() + 1);
    setSelectedDate(todayStr());
  };

  const handleSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setDetailOpen(true);
  };

  return (
    <div className={styles.homeCal}>
      <div className={styles.homeCalLabel}>
        <CalendarDays size={14} className={styles.homeCalLabelIcon} />이번 달 근무
      </div>
      <div className={styles.homeCalNav}>
        <button type="button" className={`z-glass-pill ${styles.homeCalNavBtn}`} onClick={prevMonth} aria-label="이전 달">‹</button>
        <button type="button" className={styles.homeCalTitle} onClick={goToday}>
          {year}년 <span className={styles.homeCalMonth}>{month}월</span>
        </button>
        <button type="button" className={`z-glass-pill ${styles.homeCalNavBtn}`} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        selectedDate={selectedDate}
        onSelectDate={handleSelect}
        swapMode={false}
      />

      {selectedDate && (
        <Modal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title={(() => {
            const [, m, dd] = selectedDate.split('-');
            return `${Number(m)}월 ${Number(dd)}일 근무`;
          })()}
        >
          <ScheduleDetail dateStr={selectedDate} />
        </Modal>
      )}
    </div>
  );
}
