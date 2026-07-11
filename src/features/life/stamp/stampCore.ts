'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';

/** localStorage 저장 형식: { sabun: { 'YYYY-MM-DD': true } } */
export const STAMP_STORAGE_KEY = 'attendance-stamp-v1';

/** 오늘(또는 지정일) 키 'YYYY-MM-DD' */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadStamps(sabun: string): Set<string> {
  try {
    const raw = localStorage.getItem(STAMP_STORAGE_KEY);
    if (!raw) return new Set();
    const obj = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return new Set(Object.keys(obj[sabun] ?? {}));
  } catch {
    return new Set();
  }
}

export function saveStamp(sabun: string, dayKey: string) {
  try {
    const raw = localStorage.getItem(STAMP_STORAGE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {};
    if (!obj[sabun]) obj[sabun] = {};
    obj[sabun][dayKey] = true;
    localStorage.setItem(STAMP_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

/** 연속 일수 (오늘 또는 어제부터 거꾸로 세기) */
export function calcStreak(stamps: Set<string>): number {
  let count = 0;
  const d = new Date();
  for (;;) {
    if (stamps.has(todayKey(d))) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/**
 * 출근 도장 상태 훅 — 도장은 '본인(myDriver)' 기준(조회 대상 아님).
 * 홈 카드·전체 도장 화면이 같은 localStorage 데이터를 공유한다.
 */
export function useAttendanceStamp() {
  const myDriver = useDriverStore((s) => s.myDriver);
  const authUser = useAuthStore((s) => s.user);
  const sabun = myDriver?.s ?? authUser?.sabun ?? 'guest';

  const [stamps, setStamps] = useState<Set<string>>(new Set());
  useEffect(() => {
    setStamps(loadStamps(sabun));
  }, [sabun]);

  const stampedToday = stamps.has(todayKey());
  const streak = useMemo(() => calcStreak(stamps), [stamps]);
  const totalDays = stamps.size;

  /** 오늘 도장 찍기 — 이미 찍었으면 무시. 새 streak 반환 */
  const stampToday = useCallback((): number => {
    const key = todayKey();
    if (stamps.has(key)) return calcStreak(stamps);
    saveStamp(sabun, key);
    const next = new Set(stamps);
    next.add(key);
    setStamps(next);
    return calcStreak(next);
  }, [sabun, stamps]);

  return { stamps, setStamps, sabun, stampedToday, streak, totalDays, stampToday };
}
