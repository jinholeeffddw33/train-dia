'use client';

import { Suspense, lazy, useCallback, useState } from 'react';
import { Stamp, Check } from 'lucide-react';
import { useAttendanceStamp } from '@/features/life/stamp/stampCore';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import styles from './HomeStampCard.module.css';

const AttendanceStamp = lazy(() => import('@/features/life/stamp/AttendanceStamp'));

/**
 * 홈 '출근도장' — 대기충당확인·카페 사이의 작은 3D pill.
 * · 안 찍었으면: 탭 → 도장(쾅! 애니메이션) → 완료 표시
 * · 이미 찍었으면: 탭 → 무사고 출근도장 달력으로 바로 이동
 * 데이터는 무사고 출근도장(라이프) 화면과 공유(useAttendanceStamp).
 */
export default function HomeStampCard() {
  const { stampedToday, stampToday } = useAttendanceStamp();
  const [pop, setPop] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useHistoryBack('home-stamp-calendar', () => setCalendarOpen(false), calendarOpen);

  const handleClick = useCallback(() => {
    if (stampedToday) {
      setCalendarOpen(true);
      return;
    }
    stampToday();
    setPop(true);
    window.setTimeout(() => setPop(false), 900);
  }, [stampedToday, stampToday]);

  return (
    <>
      <button
        type="button"
        className={`${styles.pill} ${stampedToday ? styles.pillDone : ''}`}
        onClick={handleClick}
        aria-label={stampedToday ? '무사고 출근도장 달력 보기' : '오늘 출근 도장 찍기'}
      >
        <span className={styles.icon}>
          {stampedToday
            ? <Check size={15} strokeWidth={3} aria-hidden />
            : <Stamp size={15} strokeWidth={2.4} aria-hidden />}
        </span>
        <span className={styles.label}>{stampedToday ? '완료' : '도장꽝'}</span>

        {pop && (
          <span className={styles.pop} aria-hidden>
            <span className={styles.popStamp}>무사고</span>
          </span>
        )}
      </button>

      {calendarOpen && (
        <div className={styles.calendarOverlay} role="dialog" aria-modal="true" aria-label="무사고 출근도장">
          <Suspense fallback={null}>
            <AttendanceStamp onBack={() => setCalendarOpen(false)} />
          </Suspense>
        </div>
      )}
    </>
  );
}
