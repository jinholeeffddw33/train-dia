'use client';

import { useMemo } from 'react';
import { TrainFront } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import {
  getDia, getType, getSchedule, getLabel, getDiaDisplay,
  getWorkTime, getNextShift, getBannerState, formatTimeUntil,
  getRouteDirection, getCurrentSegmentInfo,
} from '@/lib/schedule';
import { LABELS, dirShort } from '@/lib/constants';
import { STATION_ABBR } from '@/data/station-abbr';
import { useClock } from '../hooks/useClock';
import RouteTimeline from './RouteTimeline';
import styles from '../styles/Home.module.css';

interface TodayCardProps {
  selectedDate?: Date;
}

export default function TodayCard({ selectedDate }: TodayCardProps) {
  const driver = useDriverStore((s) => s.current);
  const clock = useClock();
  const now = useMemo(() => {
    const d = new Date();
    d.setHours(parseInt(clock.hours), parseInt(clock.minutes), parseInt(clock.seconds));
    return d;
  }, [clock.hours, clock.minutes, clock.seconds]);
  const td = selectedDate || now;
  const isToday = !selectedDate || td.toDateString() === now.toDateString();

  const dia = useMemo(() => driver ? getDia(driver, td) : null, [driver, td]);
  const diaType = useMemo(() => dia ? getType(dia) : null, [dia]);
  const schedule = useMemo(() => dia ? getSchedule(dia, td) : null, [dia, td]);
  const nextShift = useMemo(() => driver ? getNextShift(driver, td) : null, [driver, td]);
  const banner = useMemo(
    () => isToday && (schedule || nextShift) ? getBannerState(schedule, nextShift, now) : null,
    [schedule, nextShift, isToday, now],
  );
  const direction = useMemo(
    () => schedule?.m ? getRouteDirection(schedule.m, STATION_ABBR) : null,
    [schedule],
  );
  const segInfo = useMemo(
    () => getCurrentSegmentInfo(schedule?.g, now),
    [schedule, now],
  );

  if (!driver || !dia) {
    return (
      <section className={styles.emptyCard}>
        <TrainFront size={48} className={styles.emptyIcon} />
        <p className={styles.emptyText}>기관사를 선택하면{'\n'}오늘의 교번을 볼 수 있어요</p>
      </section>
    );
  }

  const typeClass = diaType ? styles[`type_${diaType}`] : '';

  // 선택 날짜 표시
  const dateLabel = isToday
    ? LABELS.TODAY_DIA
    : `${td.getMonth() + 1}월 ${td.getDate()}일 교번`;

  return (
    <section className={styles.todayCard}>
      {/* 교번 표시 */}
      <div className={styles.diaHeader}>
        <span className={styles.cardLabel}>{dateLabel}</span>
      </div>

      <div className={styles.diaMain}>
        <div className={`${styles.diaBadge} ${typeClass}`}>
          <span className={styles.diaBadgeText}>{getDiaDisplay(dia)}</span>
        </div>
        <div className={styles.diaInfo}>
          {diaType !== 'rest' && (
            <span className={styles.diaTypeLabel}>{getLabel(dia)}</span>
          )}
          {schedule && (
            <span className={styles.diaTime}>
              <span className={styles.diaTimeStart}>{schedule.s}</span>
              {' ~ '}
              {schedule.e}
            </span>
          )}
        </div>
        {schedule && (
          <div className={styles.workTimeWrap}>
            <span className={styles.workTimeLabel}>근무시간</span>
            <span className={styles.workTime}>{getWorkTime(schedule)}</span>
          </div>
        )}
      </div>

      {/* 방향 배너 (v1 스타일) — 현재 구간 기준 */}
      {isToday && banner && direction && banner.state === 'working' && (
        <div className={`${styles.dirBanner} ${styles[`dirBanner_${direction.dir}`]}`}>
          <div className={styles.dirBannerDir}>{direction.label}</div>
          <div className={styles.dirBannerSub}>{direction.sub}</div>
          {segInfo && schedule?.g && (
            <div className={styles.dirBannerTime}>
              {segInfo.status === 'running'
                ? `운행 중 · ${schedule.g[segInfo.idx].d} → ${schedule.g[segInfo.idx].a}`
                : segInfo.status === 'waiting'
                  ? `대기 중 · 다음 출발 ${schedule.g[segInfo.idx].d}`
                  : segInfo.status === 'after'
                    ? '운행이 끝났어요'
                    : `출발 ${schedule.g[segInfo.idx].d}`}
            </div>
          )}
          {!segInfo && schedule?.s && (
            <div className={styles.dirBannerTime}>출발 {schedule.s}</div>
          )}
        </div>
      )}

      {isToday && banner && banner.state === 'done' && (
        <div className={`${styles.dirBanner} ${styles.dirBanner_done}`}>
          <div className={styles.dirBannerDir}>근무 완료</div>
          <div className={styles.dirBannerSub}>오늘 하루도 수고 많으셨어요</div>
          {nextShift && nextShift.schedule && (
            <div className={styles.dirBannerNext}>
              다음근무 {nextShift.daysAhead === 1 ? '내일' : `${nextShift.daysAhead}일 후`} {nextShift.schedule.s} {nextShift.schedule.m ? dirShort(getRouteDirection(nextShift.schedule.m, STATION_ABBR)?.dir || '') : ''}
              {banner.minsUntil ? ` (${formatTimeUntil(banner.minsUntil)})` : ''}
            </div>
          )}
        </div>
      )}

      {isToday && banner && banner.state === 'idle' && (
        <div className={`${styles.dirBanner} ${styles.dirBanner_idle}`}>
          <div className={styles.dirBannerDir}>
            {diaType === 'rest' ? '오늘은 쉬는 날이에요' : '오늘 근무가 끝났어요'}
          </div>
          {diaType === 'rest' && (
            <div className={styles.dirBannerSub}>푹 쉬고 내일 힘내요</div>
          )}
          {nextShift && nextShift.schedule && (
            <div className={styles.dirBannerNext}>
              다음근무 {nextShift.daysAhead === 0 ? '오늘' : nextShift.daysAhead === 1 ? '내일' : `${nextShift.daysAhead}일 후`} {nextShift.schedule.s}
              {banner.minsUntil ? ` (${formatTimeUntil(banner.minsUntil)})` : ''}
            </div>
          )}
        </div>
      )}

      {isToday && banner && banner.state === 'preparing' && (
        <div className={`${styles.dirBanner} ${styles.dirBanner_prep} ${direction ? styles[`dirBanner_${direction.dir}`] : ''}`}>
          <div className={styles.dirBannerDir}>
            {direction ? `다음 근무 · ${direction.label}` : '다음 근무'}
          </div>
          {direction && <div className={styles.dirBannerSub}>{direction.sub}</div>}
          <div className={styles.dirBannerTime}>
            출근 {banner.next?.schedule?.s || ''} ({formatTimeUntil(banner.minsUntil)})
          </div>
        </div>
      )}

      {/* 배너 없을 때 (비근무 상태 등) - 간단 상태 표시 */}
      {isToday && banner && !direction && banner.state === 'working' && (
        <div className={`${styles.statusBanner} ${styles.banner_working}`}>
          <span className={styles.bannerDot} />{LABELS.WORK} 중
        </div>
      )}

      {/* 운전행로 구간 타임라인 */}
      {schedule && driver && (
        <RouteTimeline schedule={schedule} person={driver} date={td} />
      )}
    </section>
  );
}
