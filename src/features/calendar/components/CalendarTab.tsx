'use client';

import { useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { isOffice, getOfficeName, getMissionCardKind } from '@/lib/auth';
import { ShieldAlert } from 'lucide-react';
import CalendarGrid from './CalendarGrid';
import ScheduleDetail from './ScheduleDetail';
import SwapBottomSheet from './SwapBottomSheet';
import MissionCardModal from './MissionCardModal';
import { MonthSummary, DutyInfoCard } from '@/features/home';
import styles from '../styles/Calendar.module.css';
import missionStyles from '../styles/MissionCard.module.css';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarTab() {
  const driver = useDriverStore((s) => s.current);
  const authUser = useAuthStore((s) => s.user);
  // 내근직 모드: driver 있으면 driver 기준, 없으면 로그인 사용자 기준
  const officeMode = driver
    ? driver.I === '0'
    : !!authUser && isOffice(authUser.sabun);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [swapMode, setSwapMode] = useState(false);
  const [swapTargetDate, setSwapTargetDate] = useState<string | null>(null);
  const [missionOpen, setMissionOpen] = useState(false);

  // 임무카드 표시용 사번·이름 (카드 미발급 대상은 진입 버튼 숨김)
  const missionSabun = driver?.s ?? authUser?.sabun ?? '';
  const missionName = driver?.n ?? (authUser ? getOfficeName(authUser.sabun) ?? authUser.name : '');
  const hasMissionCard = !!missionSabun && getMissionCardKind(missionSabun) !== null;

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

  if (!driver && !officeMode) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📅</span>
        <p className={styles.emptyText}>기관사를 선택하면{'\n'}달력에 교번이 표시돼요</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 월 네비게이션 — 좌우 화살표는 버튼 4법 ② 무색 3D 솟음 알약(아이콘만 → data-press 금지) */}
      <div className={`${styles.nav} z-app-header z-app-header-frost`}>
        <button type="button" className={`z-glass-pill ${styles.navBtn}`} onClick={prevMonth} aria-label="이전 달">‹</button>
        <button type="button" className={styles.navTitle} onClick={goToday}>
          {year}년 <span className={styles.navMonth}>{month}월</span>
        </button>
        <button type="button" className={`z-glass-pill ${styles.navBtn}`} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      {/* 기관사/내근직 이름 + 임무카드 진입 (우측) */}
      <div className={styles.driverInfo}>
        <span className={styles.driverName}>{driver?.n ?? authUser?.name ?? ''}</span>
        {missionName && hasMissionCard && (
          <button
            type="button"
            className={missionStyles.entryBtn}
            onClick={() => setMissionOpen(true)}
            aria-label="개인별 임무카드 열기"
          >
            <ShieldAlert size={16} className={missionStyles.entryIcon} />
            <span>개인별 임무카드</span>
          </button>
        )}
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

      {/* 교번변경 버튼 — 내근직은 숨김 */}
      {!officeMode && (
        <div className={styles.swapBtnRow}>
          <button
            type="button"
            className={`${styles.swapToggleBtn} ${swapMode ? styles.swapToggleBtnActive : ''}`}
            onClick={toggleSwapMode}
          >
            {swapMode ? '변경 취소' : '교번변경'}
          </button>
        </div>
      )}

      {/* 선택된 날짜 상세 — 기관사만 */}
      {!officeMode && selectedDate && !swapMode && <ScheduleDetail dateStr={selectedDate} />}

      {/* 월간 근무 요약 + 내근 근무 */}
      <MonthSummary />
      <DutyInfoCard selectedDate={selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined} />

      {/* 임무카드 모달 */}
      {missionOpen && (
        <MissionCardModal
          sabun={missionSabun}
          name={missionName}
          onClose={() => setMissionOpen(false)}
        />
      )}

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
