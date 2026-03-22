'use client';

import { useState, useEffect } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useSwapStore } from '@/stores/swap';
import CalendarGrid from './CalendarGrid';
import ScheduleDetail from './ScheduleDetail';
import SwapBottomSheet from './SwapBottomSheet';
import styles from '../styles/Calendar.module.css';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarTab() {
  const driver = useDriverStore((s) => s.current);
  const cleanExpired = useSwapStore((s) => s.cleanExpired);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [swapMode, setSwapMode] = useState(false);
  const [swapTargetDate, setSwapTargetDate] = useState<string | null>(null);

  // 앱 시작 시 만료된 교번변경 정리
  useEffect(() => {
    cleanExpired();
  }, [cleanExpired]);

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

  const handleDateSelect = (dateStr: string) => {
    if (swapMode) {
      // 교번변경 모드: 날짜 탭 → 바텀시트 열기
      setSwapTargetDate(dateStr);
    } else {
      setSelectedDate(dateStr);
    }
  };

  const toggleSwapMode = () => {
    setSwapMode((prev) => !prev);
    setSwapTargetDate(null);
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

      {/* 교번변경 모드 안내 배너 */}
      {swapMode && (
        <div className={styles.swapBanner}>
          <span className={styles.swapBannerText}>변경할 날짜를 탭하세요</span>
          <button type="button" className={styles.swapBannerClose} onClick={toggleSwapMode}>
            취소
          </button>
        </div>
      )}

      {/* 달력 그리드 */}
      <CalendarGrid
        year={year}
        month={month}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        swapMode={swapMode}
      />

      {/* 교번변경 버튼 */}
      <div className={styles.swapBtnRow}>
        <button
          type="button"
          className={`${styles.swapToggleBtn} ${swapMode ? styles.swapToggleBtnActive : ''}`}
          onClick={toggleSwapMode}
        >
          {swapMode ? '변경 취소' : '교번변경'}
        </button>
      </div>

      {/* 선택된 날짜 상세 */}
      {selectedDate && !swapMode && <ScheduleDetail dateStr={selectedDate} />}

      {/* 교번변경 바텀시트 */}
      {swapTargetDate && (
        <SwapBottomSheet
          dateStr={swapTargetDate}
          onClose={() => {
            setSwapTargetDate(null);
            // 바텀시트 닫으면 변경 모드 자동 해제 + 해당 날짜 선택
            setSwapMode(false);
            setSelectedDate(swapTargetDate);
          }}
        />
      )}
    </div>
  );
}
