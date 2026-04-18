'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { useSwapStore } from '@/stores/swap';
import { getDia, getType, getDiaDisplay, isHoliday } from '@/lib/schedule';
import { findDutyByName } from '@/lib/dutySchedule';
import { isOffice, getOfficeName } from '@/lib/auth';
import { useMemoStore } from '@/stores/memo';
import styles from '../styles/Calendar.module.css';

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  swapMode?: boolean;
}

export default function CalendarGrid({ year, month, selectedDate, onSelectDate, swapMode }: CalendarGridProps) {
  const driver = useDriverStore((s) => s.current);
  const authUser = useAuthStore((s) => s.user);
  const memos = useMemoStore((s) => s.memos);
  const swaps = useSwapStore((s) => s.swaps);
  // 내근직 모드: driver 있으면 driver 기준, 없으면 로그인 사용자 기준
  const officeMode = driver
    ? driver.I === '0'
    : !!authUser && isOffice(authUser.sabun);

  // 매 렌더마다 현재 날짜 계산 (자정 후에도 정확한 오늘 표시)
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  type EmptyCell = { key: string; empty: true };
  type DateCell = {
    key: string; empty: false; d: number; dateStr: string;
    dia: string | null; type: string | null; display: string;
    hol: boolean; hasMemo: boolean; isToday: boolean; isSelected: boolean;
    isSun: boolean; isSat: boolean; isSwapped: boolean;
  };
  type CalendarCell = EmptyCell | DateCell;

  const cells = useMemo((): CalendarCell[] => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: CalendarCell[] = [];

    // 빈 셀
    for (let i = 0; i < firstDay; i++) {
      result.push({ key: `e${i}`, empty: true });
    }

    // 날짜 셀
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      let dia: string | null;
      let type: string | null;
      let display: string;
      let isMySwap: boolean;

      if (officeMode) {
        // 내근직: 주/본, 야/기, 주/관, 비(비번), 휴(휴무) 형식 표시
        const name = driver
          ? driver.n
          : (authUser ? getOfficeName(authUser.sabun) ?? authUser.name : '');
        const duty = findDutyByName(name, date);
        if (duty === 'standby') {
          dia = 'standby';
          type = 'standby';
          display = '비';
        } else if (duty === 'rest') {
          dia = 'rest';
          type = 'rest';
          display = '휴';
        } else {
          const shiftShort = duty.shift === '주간' ? '주' : '야';
          const locShort = duty.location === '본소' ? '본' : duty.location === '기지' ? '기' : '관';
          dia = `${shiftShort}/${locShort}`;
          type = duty.shift === '주간' ? 'day' : 'night';
          display = `${shiftShort}/${locShort}`;
        }
        isMySwap = false;
      } else {
        const originalDia = driver ? getDia(driver, date) : null;
        const swap = swaps[dateStr] || null;
        isMySwap = !!(swap && driver && swap.driverId === driver.I);
        dia = isMySwap ? swap!.dia : originalDia;
        type = dia ? getType(dia) : null;
        // 캘린더에서는 휴무 번호 표시 (휴37 등), 비번은 라벨만
        display = dia
          ? (dia.startsWith('휴') ? dia : getDiaDisplay(dia))
          : '';
      }
      const hol = isHoliday(date);
      const hasMemo = !!memos[dateStr];
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const isSun = date.getDay() === 0;
      const isSat = date.getDay() === 6;
      const isSwapped = !!isMySwap;

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
        isSwapped,
      });
    }
    return result;
  }, [driver, authUser, officeMode, year, month, selectedDate, memos, swaps, todayStr]);

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
            className={`${styles.cell} ${cell.isToday ? styles.cellToday : ''} ${cell.isSelected ? styles.cellSelected : ''} ${swapMode ? styles.cellSwapMode : ''} ${cell.isSwapped ? styles.cellSwapped : ''}`}
            onClick={() => onSelectDate(cell.dateStr)}
            aria-label={`${month}월 ${cell.d}일 ${cell.display || ''}${cell.isSwapped ? ' (변경됨)' : ''}`}
            aria-current={cell.isToday ? 'date' : undefined}
          >
            <span className={`${styles.cellDate} ${cell.isSun || cell.hol ? styles.cellDateSun : ''} ${cell.isSat ? styles.cellDateSat : ''}`}>
              {cell.d}
            </span>
            {cell.type && (
              <span className={`${styles.cellDia} ${cell.isSwapped ? styles.cellDiaSwapped : styles[officeMode ? `cellOffice_${cell.type}` : `cellType_${cell.type}`]}`}>
                {cell.display}
              </span>
            )}
            {cell.isSwapped && <span className={styles.swapTag}>변경</span>}
            {cell.hasMemo && !cell.isSwapped && <span className={styles.memoDot} />}
          </button>
        ),
      )}
    </div>
  );
}
