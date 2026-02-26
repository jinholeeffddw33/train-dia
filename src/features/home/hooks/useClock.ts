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

function getClock(): ClockData {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
    ampm: h < 12 ? 'AM' : 'PM',
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  };
}
