'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { getDia, getType, getDiaDisplay, isHoliday } from '@/lib/schedule';
import { useMemoStore } from '@/stores/memo';
import styles from '../styles/Calendar.module.css';

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
}

export default function CalendarGrid({ year, month, selectedDate, onSelectDate }: CalendarGridProps) {
  const driver = useDriverStore((s) => s.current);
  const memos = useMemoStore((s) => s.memos);

  // 매 렌더마다 현재 날짜 계산 (자정 후에도 정확한 오늘 표시)
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  const cells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];

    // 빈 셀
    for (let i = 0; i < firstDay; i++) {
      result.push({ key: `e${i}`, empty: true } as const);
    }

    // 날짜 셀
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dia = driver ? getDia(driver, date) : null;
      const type = dia ? getType(dia) : null;
      const display = dia ? getDiaDisplay(dia) : '';
      const hol = isHoliday(date);
      const hasMemo = !!memos[dateStr];
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const isSun = date.getDay() === 0;
      const isSat = date.getDay() === 6;

      result.push({
        key: dateStr,
        empty: false,
        d,
        dateStr,
        dia,
        type,
        display,
        hol,
        hasMemo,
        isToday,
        isSelected,
        isSun,
        isSat,
      } as const);
    }
    return result;
  }, [driver, year, month, selectedDate, memos, todayStr]);

  return (
    <div className={styles.grid}>
      {/* 요일 헤더 */}
      {['일', '월', '화', '수', '목', '금', '토'].map((dow, i) => (
        <div
          key={dow}
          className={`${styles.dowHeader} ${i === 0 ? styles.dowSun : ''} ${i === 6 ? styles.dowSat : ''}`}
        >
          {dow}
        </div>
      ))}

      {/* 날짜 셀 */}
      {cells.map((cell) =>
        cell.empty ? (
          <div key={cell.key} className={styles.cellEmpty} />
        ) : (
          <button
            key={cell.key}
            type="button"
            className={`${styles.cell} ${cell.isToday ? styles.cellToday : ''} ${cell.isSelected ? styles.cellSelected : ''}`}
            onClick={() => onSelectDate(cell.dateStr)}
            aria-label={`${month}월 ${cell.d}일 ${cell.display || ''}`}
            aria-current={cell.isToday ? 'date' : undefined}
          >
            <span className={`${styles.cellDate} ${cell.isSun || cell.hol ? styles.cellDateSun : ''} ${cell.isSat ? styles.cellDateSat : ''}`}>
              {cell.d}
            </span>
            {cell.type && (
              <span className={`${styles.cellDia} ${styles[`cellType_${cell.type}`]}`}>
                {cell.display}
              </span>
            )}
            {cell.hasMemo && <span className={styles.memoDot} />}
          </button>
        ),
      )}
    </div>
  );
}
