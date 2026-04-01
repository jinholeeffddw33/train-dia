'use client';

import { useMemo } from 'react';
import { TrainFront } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import {
  getDia, getType, getSchedule, getLabel, getDiaDisplay,
  getWorkTime, getNextShift, getBannerState, formatTimeUntil,
  getRouteDirection, getSegmentDirection, getCurrentSegmentInfo,
  isSpecialRest, getSpecialRestLabel, isDepotStart, timeToMins,
} from '@/lib/schedule';
import { useGetSwappedDia } from '@/hooks/useSwappedDia';
import { useSegmentAlarm } from '@/hooks/useSegmentAlarm';
import { LABELS, dirShort } from '@/lib/constants';
import { STATION_ABBR } from '@/data/station-abbr';
import { useClock } from '../hooks/useClock';
import RouteTimeline from './RouteTimeline';
import styles from '../styles/Home.module.css';

interface TodayCardProps {
  selectedDate?: Date;
  onEmptyClick?: () => void;
}

export default function TodayCard({ selectedDate, onEmptyClick }: TodayCardProps) {
  const driver = useDriverStore((s) => s.current);
  const getSwappedDia = useGetSwappedDia();
  const clock = useClock();
  const now = useMemo(() => {
    const d = new Date();
    d.setHours(parseInt(clock.hours), parseInt(clock.minutes), parseInt(clock.seconds));
    return d;
  }, [clock.hours, clock.minutes, clock.seconds]);
  const td = selectedDate || now;
  const isToday = !selectedDate || td.toDateString() === now.toDateString();

  const dia = useMemo(() => driver ? getSwappedDia(driver, td) : null, [driver, td, getSwappedDia]);
  const diaType = useMemo(() => dia ? getType(dia) : null, [dia]);
  const schedule = useMemo(() => dia ? getSchedule(dia, td) : null, [dia, td]);
  const nextShift = useMemo(() => driver ? getNextShift(driver, td) : null, [driver, td]);
  const banner = useMemo(
    () => isToday && (schedule || nextShift) ? getBannerState(schedule, nextShift, now) : null,
    [schedule, nextShift, isToday, now],
  );
  const segInfo = useMemo(
    () => getCurrentSegmentInfo(schedule?.g, now, schedule?.s),
    [schedule, now],
  );
  // 현재 구간 기준 방향 (구간별 전환)
  const currentDirection = useMemo(() => {
    if (!schedule?.m) return null;
    if (segInfo && segInfo.status !== 'after') {
      return getSegmentDirection(schedule.m, segInfo.idx, schedule.g);
    }
    return getRouteDirection(schedule.m, STATION_ABBR, schedule.g);
  }, [schedule, segInfo]);
  // 2·3근무 출발 전 알람
  useSegmentAlarm(isToday ? schedule?.g : undefined, schedule?.s);
  // preparing/done 상태에서 다음 근무 방향 (banner.next 기준)
  const nextDirection = useMemo(
    () => banner?.next?.schedule?.m
      ? getRouteDirection(banner.next.schedule.m, STATION_ABBR, banner.next.schedule.g)
      : null,
    [banner],
  );
  // 1근무 출발 1시간 전부터 배너 표시 여부
  const showDirBanner = useMemo(() => {
    if (!segInfo || !schedule?.g) return false;
    if (segInfo.status === 'running' || segInfo.status === 'waiting') return true;
    if (segInfo.status === 'after') return true;
    // 'before': 1근무 출발 1시간 전부터
    if (segInfo.status === 'before') {
      const firstDep = timeToMins(schedule.g[0].d);
      if (firstDep < 0) return false;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      return nowMins >= firstDep - 60;
    }
    return false;
  }, [segInfo, schedule, now]);

  if (!driver || !dia) {
    return (
      <section className={styles.emptyCard} onClick={onEmptyClick} role={onEmptyClick ? 'button' : undefined} tabIndex={onEmptyClick ? 0 : undefined}>
        <TrainFront size={48} className={styles.emptyIcon} />
        <p className={styles.emptyText}>기관사를 선택하면{'\n'}오늘의 교번을 볼 수 있어요</p>
      </section>
    );
  }

  // 운휴/대휴 체크 — 휴무와 동일하게 표시
  const specialRest = isSpecialRest(schedule);
  const specialRestLabel = getSpecialRestLabel(schedule);
  const effectiveType = specialRest ? 'rest' : diaType;
  const typeClass = effectiveType ? styles[`type_${effectiveType}`] : '';
  const depotStart = dia ? isDepotStart(dia, td) : false;

  // 선택 날짜 표시
  const dateLabel = isToday
    ? LABELS.TODAY_DIA
    : `${td.getMonth() + 1}월 ${td.getDate()}일 교번`;

  return (
    <section className={styles.todayCard}>
      {/* 교번 + 근무시간 헤더 */}
      <div className={styles.diaHeader}>
        <span className={styles.cardLabel}>{dateLabel}</span>
        {schedule && !specialRest && (
          <div className={styles.workTimeWrap}>
            <span className={styles.workTimeLabel}>근무시간</span>
            <span className={styles.workTime}>{getWorkTime(schedule)}</span>
          </div>
        )}
      </div>

      <div className={styles.diaMain}>
        <div className={`${styles.diaBadge} ${typeClass}`}>
          <span className={styles.diaBadgeText}>
            {specialRest ? specialRestLabel : getDiaDisplay(dia)}
          </span>
        </div>
        <div className={styles.diaInfo}>
          {effectiveType !== 'rest' && (
            <span className={styles.diaTypeLabel}>
              {getLabel(dia)}
              {depotStart && (
                <span className={styles.depotBadge}>기지 출근</span>
              )}
            </span>
          )}
          {specialRest && (
            <span className={styles.diaTypeLabel}>
              {specialRestLabel}
              <span className={styles.diaTypeSub}>{schedule?.s}</span>
            </span>
          )}
          {schedule && !specialRest && (
            <span className={styles.diaTime}>
              <span className={styles.diaTimeStart}>{schedule.s}</span>
              {' ~ '}
              {schedule.e}
            </span>
          )}
        </div>
      </div>

      {/* 방향 배너 — 구간별 전환 */}
      {isToday && banner && banner.state === 'working' && showDirBanner && segInfo && schedule?.g && (
        segInfo.status === 'after' ? (
          <div className={`${styles.dirBanner} ${styles.dirBanner_done}`}>
            <div className={styles.dirBannerDir}>근무 완료</div>
            <div className={styles.dirBannerSub}>오늘도 수고하셨습니다</div>
          </div>
        ) : currentDirection && (
          <div className={`${styles.dirBanner} ${styles[`dirBanner_${currentDirection.dir}`]}`}>
            <div className={styles.dirBannerDir}>{currentDirection.label}</div>
            <div className={styles.dirBannerSub}>{currentDirection.sub}</div>
            <div className={styles.dirBannerTime}>
              {segInfo.status === 'running'
                ? `운행 중 · ${schedule.g[segInfo.idx].d} → ${schedule.g[segInfo.idx].a}`
                : segInfo.status === 'waiting'
                  ? `대기 중 · 다음 ${segInfo.idx + 1}근무 출발 ${schedule.g[segInfo.idx].d}`
                  : `${segInfo.idx + 1}근무 출발 ${schedule.g[segInfo.idx].d}`}
            </div>
          </div>
        )
      )}

      {isToday && banner && banner.state === 'done' && (
        <div className={`${styles.dirBanner} ${styles.dirBanner_done}`}>
          <div className={styles.dirBannerDir}>근무 완료</div>
          <div className={styles.dirBannerSub}>오늘 하루도 수고 많으셨어요</div>
          {banner.next && banner.next.schedule && (
            <div className={styles.dirBannerNext}>
              다음근무 {banner.next.daysAhead === 1 ? '내일' : `${banner.next.daysAhead}일 후`} {banner.next.schedule.s} {nextDirection ? dirShort(nextDirection.dir) : ''}
              {banner.minsUntil ? ` (${formatTimeUntil(banner.minsUntil)})` : ''}
            </div>
          )}
        </div>
      )}

      {isToday && banner && banner.state === 'idle' && (
        <div className={`${styles.dirBanner} ${styles.dirBanner_idle}`}>
          <div className={styles.dirBannerDir}>
            {effectiveType === 'rest'
              ? '오늘은 쉬는 날이에요'
              : banner.next?.daysAhead === 0
                ? '출근 전이에요'
                : '오늘 근무가 끝났어요'}
          </div>
          {effectiveType === 'rest' && (
            <div className={styles.dirBannerSub}>푹 쉬고 내일 힘내요</div>
          )}
          {banner.next?.daysAhead === 0 && diaType !== 'rest' && (
            <div className={styles.dirBannerSub}>오늘도 안전 운행 하세요</div>
          )}
          {banner.next && banner.next.schedule && (
            <div className={styles.dirBannerNext}>
              {banner.next.daysAhead === 0
                ? `오늘 출근 ${banner.next.schedule.s}`
                : `다음근무 ${banner.next.daysAhead === 1 ? '내일' : `${banner.next.daysAhead}일 후`} ${banner.next.schedule.s}`}
              {banner.minsUntil ? ` (${formatTimeUntil(banner.minsUntil)})` : ''}
            </div>
          )}
        </div>
      )}

      {isToday && banner && banner.state === 'preparing' && (
        <div className={`${styles.dirBanner} ${styles.dirBanner_prep} ${nextDirection ? styles[`dirBanner_${nextDirection.dir}`] : ''}`}>
          <div className={styles.dirBannerDir}>
            {nextDirection ? `다음 근무 · ${nextDirection.label}` : '다음 근무'}
          </div>
          {nextDirection && <div className={styles.dirBannerSub}>{nextDirection.sub}</div>}
          <div className={styles.dirBannerTime}>
            출근 {banner.next?.schedule?.s || ''} ({formatTimeUntil(banner.minsUntil)})
          </div>
        </div>
      )}

      {/* 배너 없을 때 (비근무 상태 등) - 간단 상태 표시 */}
      {isToday && banner && !currentDirection && banner.state === 'working' && !showDirBanner && (
        <div className={`${styles.statusBanner} ${styles.banner_working}`}>
          <span className={styles.bannerDot} />{LABELS.WORK} 중
        </div>
      )}

      {/* 운전행로 구간 타임라인 */}
      {schedule && driver && (
        <RouteTimeline schedule={schedule} person={driver} date={td} dia={dia ?? undefined} />
      )}
    </section>
  );
}
