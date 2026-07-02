'use client';

import { useState, useEffect } from 'react';

interface ClockData {
  hours: string;
  minutes: string;
  seconds: string;
  ampm: string;
  /** HH:MM 형식 */
  time: string;
}

/** 실시간 시계 훅 (1초 간격) */
export function useClock(): ClockData {
  const [clock, setClock] = useState<ClockData>(getClock);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(getClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return clock;
}

/**
 * 분 단위 시계 훅 — 초 표시가 필요 없는 컴포넌트용 (매초 재렌더 방지).
 * 첫 타이머를 다음 분 경계에 맞춰 걸어 분 표시가 어긋나지 않는다.
 * seconds 는 항상 '00' — 초가 필요하면 useClock 을 쓸 것.
 */
export function useClockMinute(): ClockData {
  const [clock, setClock] = useState<ClockData>(() => getClock(true));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    // 다음 분 경계까지 대기 후 60초 간격 tick
    const untilNextMinute = (60 - new Date().getSeconds()) * 1000;
    const timeout = setTimeout(() => {
      setClock(getClock(true));
      interval = setInterval(() => setClock(getClock(true)), 60_000);
    }, untilNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return clock;
}

function getClock(minuteOnly = false): ClockData {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = minuteOnly ? 0 : now.getSeconds();
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    ampm: h < 12 ? 'AM' : 'PM',
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}
