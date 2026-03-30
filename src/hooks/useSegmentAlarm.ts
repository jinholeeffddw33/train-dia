'use client';

import { useEffect, useRef } from 'react';
import { useAlarmStore, DEPOT_OPTIONS, ALARM_LABELS, type AlarmMinute } from '@/stores/alarm';
import { useNotification } from './useNotification';
import type { Segment } from '@/lib/types';
import { timeToMins } from '@/lib/schedule';

/** 알람음 재생 — 사용자 인터랙션 후에만 동작 (브라우저 정책) */
function playAlarmSound() {
  try {
    const audio = new Audio('/sounds/alarm.mp3');
    audio.volume = 1.0;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

/** 기지 출고 열번 여부 — 첫 번째 열차번호 기준 */
function isDepotTrain(seg: Segment): boolean {
  if (!seg.n || seg.n.length === 0) return false;
  const first = seg.n[0];
  return (first >= 1000 && first <= 1499) || (first >= 1500 && first <= 1599) || (first >= 2000 && first <= 2999);
}

/**
 * 2·3근무 출발 전 알람 훅
 * - segments: 오늘의 구간 배열 (schedule.g)
 * - scheduleStart: 출근 시각 (schedule.s) — 야간 익일 보정용
 */
export function useSegmentAlarm(
  segments: Segment[] | undefined,
  scheduleStart: string | undefined,
) {
  const { selected, fixedTimes, fired, markFired, resetFired, clearAll } = useAlarmStore();
  const { notify } = useNotification();
  const lastDateRef = useRef('');
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!segments || segments.length < 2) return;
    if (selected.length === 0 && fixedTimes.length === 0) return;

    const dateKey = new Date().toDateString();
    if (lastDateRef.current && lastDateRef.current !== dateKey) {
      resetFired();
    }
    lastDateRef.current = dateKey;

    const check = () => {
      const now = new Date();
      const rawNowMins = now.getHours() * 60 + now.getMinutes();

      // ── 고정 시각 알람 (DIA 85~91: 04:30, 04:40) ──
      for (const ft of fixedTimes) {
        const ftMins = timeToMins(ft);
        if (ftMins < 0) continue;
        const diff = rawNowMins - ftMins;
        if (diff >= 0 && diff < 1) {
          const key = `${dateKey}_fixed_${ft}`;
          if (fired.includes(key)) continue;
          markFired(key);
          playAlarmSound();
          notify(`익일 근무 알람 (${ft})`, {
            body: '출발 준비하세요!',
            tag: key,
            requireInteraction: true,
          });
        }
      }

      // ── 상대 시간 알람 (10/20/30분전, 1시간/1시간10분전) ──
      if (selected.length === 0) return;

      let nowMins = rawNowMins;
      let overnight = false;
      if (scheduleStart) {
        const startMins = timeToMins(scheduleStart);
        if (startMins >= 720 && nowMins < startMins && nowMins < 720) {
          overnight = true;
          nowMins += 1440;
        }
      }

      for (let i = 1; i < segments.length; i++) {
        let depMins = timeToMins(segments[i].d);
        if (depMins < 0) continue;

        if (i > 0) {
          const prevArr = timeToMins(segments[i - 1].a);
          if (depMins < prevArr - 240) depMins += 1440;
        }

        const depot = isDepotTrain(segments[i]);

        for (const alarmMin of selected) {
          if (DEPOT_OPTIONS.includes(alarmMin) && !depot) continue;

          const alarmAt = depMins - alarmMin;
          const diff = nowMins - alarmAt;

          if (diff >= 0 && diff < 1) {
            const key = `${dateKey}_${i}_${alarmMin}`;
            if (fired.includes(key)) continue;

            markFired(key);
            playAlarmSound();

            const label = ALARM_LABELS[alarmMin as AlarmMinute];
            const segLabel = `${i + 1}근무`;
            const depTime = segments[i].d;
            const nightNote = overnight ? ' (익일)' : '';
            const title = `${segLabel} 출발 ${label}${nightNote}`;
            const body = `${depTime} 출발 예정 — 준비하세요!`;

            notify(title, { body, tag: key, requireInteraction: true, vibrate: [300, 200, 300, 200, 300] });
          }
        }
      }

      // ── 마지막 구간 출발시간 경과 시 알람 설정 초기화 ──
      if (!clearedRef.current) {
        const lastSeg = segments[segments.length - 1];
        let lastDep = timeToMins(lastSeg.d);
        if (lastDep >= 0) {
          // 야간 보정
          const prevArr = timeToMins(segments[segments.length - 2]?.a ?? '');
          if (prevArr >= 0 && lastDep < prevArr - 240) lastDep += 1440;
          if (nowMins > lastDep) {
            clearAll();
            clearedRef.current = true;
          }
        }
      }
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [segments, scheduleStart, selected, fixedTimes, fired, markFired, resetFired, clearAll, notify]);
}
