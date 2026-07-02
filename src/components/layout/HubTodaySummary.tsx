'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useGetSwappedDia } from '@/hooks/useSwappedDia';
import {
  getType, getSchedule, getDiaDisplay, getBannerState, getNextShift,
  formatTimeUntil, isSpecialRest, getSpecialRestLabel,
} from '@/lib/schedule';
import { useClockMinute } from '@/features/home/hooks/useClock';
import { useSeoulWeather } from '@/features/home/hooks/useWeather';
import styles from './HubTodaySummary.module.css';

export default function HubTodaySummary() {
  const driver = useDriverStore((s) => s.current);
  const getSwappedDia = useGetSwappedDia();
  // 초 미표시 — 분 단위 시계로 매초 재렌더 방지
  const clock = useClockMinute();
  const weather = useSeoulWeather();

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(parseInt(clock.hours), parseInt(clock.minutes), parseInt(clock.seconds));
    return d;
  }, [clock.hours, clock.minutes, clock.seconds]);

  const summary = useMemo(() => {
    if (!driver) return null;
    const dia = getSwappedDia(driver, now);
    if (!dia) return null;
    const schedule = getSchedule(dia, now);
    const nextShift = getNextShift(driver, now);
    const banner = getBannerState(schedule, nextShift, now);
    const diaType = getType(dia);
    const specialRest = isSpecialRest(schedule);

    const whenLabel = (days: number) => {
      if (days === 0) return '오늘';
      if (days === 1) return '내일';
      if (days === 2) return '모레';
      return `${days}일 뒤`;
    };

    if (banner.state === 'working') {
      return {
        label: '오늘 근무 중',
        value: `${getDiaDisplay(dia)} · ${schedule?.s ?? ''} ~ ${schedule?.e ?? ''}`,
        tone: 'working' as const,
      };
    }

    if (banner.state === 'preparing' && banner.next?.schedule) {
      return {
        label: '곧 출근',
        value: `${getDiaDisplay(banner.next.dia)} · ${banner.next.schedule.s} · ${formatTimeUntil(banner.minsUntil)}`,
        tone: 'preparing' as const,
      };
    }

    if (banner.state === 'done') {
      const next = banner.next;
      if (next?.schedule) {
        return {
          label: '오늘 근무 완료',
          value: `${whenLabel(next.daysAhead)} ${next.schedule.s} 출근`,
          tone: 'done' as const,
        };
      }
      return { label: '오늘 근무 완료', value: '편안한 하루 보내세요', tone: 'done' as const };
    }

    if (specialRest) {
      const restLabel = getSpecialRestLabel(schedule) ?? '휴무';
      return {
        label: `오늘 ${restLabel}`,
        value: banner.next?.schedule
          ? `${whenLabel(banner.next.daysAhead)} ${banner.next.schedule.s} 출근`
          : '푹 쉬세요',
        tone: 'rest' as const,
      };
    }

    if (diaType === 'rest') {
      return {
        label: '오늘 휴무',
        value: banner.next?.schedule
          ? `${whenLabel(banner.next.daysAhead)} ${banner.next.schedule.s} 출근`
          : '푹 쉬세요',
        tone: 'rest' as const,
      };
    }

    if (schedule?.s) {
      const isToday = banner.next?.daysAhead === 0;
      return {
        label: isToday ? '오늘 출근' : '다음 근무',
        value: `${getDiaDisplay(dia)} · ${schedule.s}${banner.minsUntil ? ` · ${formatTimeUntil(banner.minsUntil)}` : ''}`,
        tone: 'preparing' as const,
      };
    }

    return null;
  }, [driver, getSwappedDia, now]);

  return (
    <div className={styles.row} role="group" aria-label="오늘의 요약">
      {weather && (
        <div
          className={styles.weather}
          aria-label={`서울 날씨 ${weather.condition} ${weather.temp}도${weather.precipProb > 0 ? `, 강수확률 ${weather.precipProb}%` : ''}${weather.dustLabel ? `, 미세먼지 ${weather.dustLabel}` : ''}`}
        >
          <div className={styles.wMain}>
            <span className={styles.wIcon} aria-hidden>{weather.icon}</span>
            <span className={styles.wCity}>서울</span>
            <span className={styles.wTemp}>{weather.temp}°</span>
            <span className={styles.wCond}>{weather.condition}</span>
          </div>
          {(weather.precipProb >= 20 || weather.dustLevel) && (
            <div className={styles.wExtra}>
              {weather.precipProb >= 20 && (
                <span className={styles.wChip}>
                  <span aria-hidden>💧</span>
                  <span>강수 {weather.precipProb}%</span>
                </span>
              )}
              {weather.dustLevel && weather.dustLabel && (
                <span className={`${styles.wChip} ${styles[`dust_${weather.dustLevel}`]}`}>
                  <span className={styles.dustDot} aria-hidden />
                  <span>미세먼지 {weather.dustLabel}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {summary && (
        <div className={`${styles.duty} ${styles[`tone_${summary.tone}`]}`}>
          <span className={styles.label}>{summary.label}</span>
          <span className={styles.value}>{summary.value}</span>
        </div>
      )}
    </div>
  );
}
