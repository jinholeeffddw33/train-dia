'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import {
  getDia, getType, getSchedule, getLabel, getDiaDisplay,
  getWorkTime, getNextShift, getBannerState, formatTimeUntil, today,
} from '@/lib/schedule';
import { LABELS } from '@/lib/constants';
import styles from '../styles/Home.module.css';

export default function TodayCard() {
  const driver = useDriverStore((s) => s.current);
  const td = today();
  const now = new Date();

  const dia = useMemo(() => driver ? getDia(driver, td) : null, [driver]);
  const diaType = useMemo(() => dia ? getType(dia) : null, [dia]);
  const schedule = useMemo(() => dia ? getSchedule(dia, td) : null, [dia]);
  const nextShift = useMemo(() => driver ? getNextShift(driver, td) : null, [driver]);
  const banner = useMemo(
    () => (schedule || nextShift) ? getBannerState(schedule, nextShift, now) : null,
    [schedule, nextShift],
  );

  if (!driver || !dia) {
    return (
      <section className={styles.emptyCard}>
        <span className={styles.emptyIcon}>🚇</span>
        <p className={styles.emptyText}>기관사를 선택하면{'\n'}오늘의 교번을 확인합니다</p>
      </section>
    );
  }

  const typeClass = diaType ? styles[`type_${diaType}`] : '';

  return (
    <section className={styles.todayCard}>
      {/* 교번 표시 */}
      <div className={styles.diaHeader}>
        <span className={styles.cardLabel}>{LABELS.TODAY_DIA}</span>
      </div>

      <div className={styles.diaMain}>
        <div className={`${styles.diaBadge} ${typeClass}`}>
          <span className={styles.diaBadgeText}>{getDiaDisplay(dia)}</span>
        </div>
        <div className={styles.diaInfo}>
          <span className={styles.diaTypeLabel}>{getLabel(dia)}</span>
          {schedule && (
            <span className={styles.diaTime}>
              {schedule.s} ~ {schedule.e}
            </span>
          )}
        </div>
        {schedule && (
          <span className={styles.workTime}>{getWorkTime(schedule)}</span>
        )}
      </div>

      {/* 운전행로 */}
      {schedule?.m && (
        <div className={styles.routeSection}>
          <span className={styles.routeLabel}>운전행로</span>
          <p className={styles.routeText}>{schedule.m}</p>
        </div>
      )}

      {/* 상태 배너 */}
      {banner && (
        <div className={`${styles.statusBanner} ${styles[`banner_${banner.state}`]}`}>
          {banner.state === 'working' && (
            <><span className={styles.bannerDot} />{LABELS.WORK} 중</>
          )}
          {banner.state === 'done' && (
            <>{LABELS.GOOD_JOB} 😊</>
          )}
          {banner.state === 'preparing' && (
            <>출근 준비 · {formatTimeUntil(banner.minsUntil)}</>
          )}
          {banner.state === 'idle' && banner.next && (
            <>{LABELS.NEXT_WORK} · {banner.next.dia} ({formatTimeUntil(banner.minsUntil)})</>
          )}
        </div>
      )}
    </section>
  );
}
