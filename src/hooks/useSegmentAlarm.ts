'use client';

import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useAlarmStore } from '@/stores/alarm';
import { useNotification } from './useNotification';
import type { Segment } from '@/lib/types';
import { timeToMins } from '@/lib/schedule';
import { buildAlarmPlan } from '@/lib/alarmPlan';
import { isNativeApp } from '@/lib/native/platform';
import { syncScheduledAlarms } from '@/lib/native/localAlarms';

/** 알람음 재생 — 사용자 인터랙션 후에만 동작 (브라우저 정책) */
function playAlarmSound() {
  try {
    const audio = new Audio('/sounds/alarm.mp3');
    audio.volume = 1.0;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

/** 지나간 알람을 몇 초까지 거슬러 찾아 발화할지 — 폴링 간격(30초)보다 넉넉히 잡는다 */
const LOOKBACK_MS = 60_000;
const POLL_MS = 30_000;

/**
 * 2·3근무 출발 전 알람 훅.
 *
 * ── 두 개의 전혀 다른 전달 경로를 쓴다 ──
 *  · 네이티브 앱: 계획을 **OS 에 예약**한다. 앱이 꺼져 있어도, 폰이 잠겨 있어도 울린다.
 *                 (앱 안에서 다시 울리면 이중이 되므로 여기서는 소리·알림을 내지 않는다)
 *  · 웹/PWA:      30초마다 폴링하며 직접 알림을 띄운다. 앱 화면이 떠 있어야만 동작한다 —
 *                 웹의 한계이고, 바로 이것 때문에 네이티브 앱이 의미를 갖는다.
 *
 * ★ "언제 울리나"는 양쪽 다 @/lib/alarmPlan 하나만 본다. 규칙이 두 벌이 되면
 *   앱을 켠 사람과 끈 사람이 다른 알람을 받게 된다.
 */
export function useSegmentAlarm(
  segments: Segment[] | undefined,
  scheduleStart: string | undefined,
) {
  const { selected, fixedTimes, fired, markFired, resetFired, clearAll } = useAlarmStore();
  const { notify } = useNotification();
  const lastDateRef = useRef('');
  const clearedRef = useRef(false);

  // ── 네이티브: 설정이나 근무가 바뀔 때마다 OS 예약을 계획과 일치시킨다 ──
  useEffect(() => {
    if (!isNativeApp()) return;

    let disposed = false;
    let deferred = false;

    const sync = () => {
      if (disposed) return;

      // 화면에 없을 때는 동기화를 **복귀 시점으로 미룬다**.
      //   이유는 두 가지다:
      //   ① 앱이 안 보이는 동안 계획을 다시 짤 이유가 없다 — 설정을 바꾸는 UI 는 포그라운드에만 있다.
      //   ② 복귀할 때 어차피 한 번 다시 맞춰야 한다. 밤새 열어 둔 채 날짜가 바뀌면
      //      "오늘 근무"가 달라져 있기 때문이다(아래 appStateChange/visibilitychange).
      //
      //   ⚠️ 처음에는 "백그라운드에서 네이티브 호출이 무응답이라서"라고 적었는데 **그건 틀렸다**.
      //      재실측(2026-08-18): 앱이 포그라운드(topResumedActivity)여도 CDP 로 밀어넣은
      //      schedule 의 Promise 는 응답하지 않았고, 그런데도 알림은 제 시각에 발화했다
      //      (logcat 발화 기록 + getPending 잔존 + dumpsys alarm 의 RTC_WAKEUP 등록으로 3중 확인).
      //      즉 무응답은 **CDP 로 코드를 주입했을 때의 현상**이지 앱 코드의 문제가 아니다.
      //      가드는 위 ①②의 이유로 남긴다.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        deferred = true;
        return;
      }

      deferred = false;
      // 계획이 비면 syncScheduledAlarms 가 기존 예약을 전부 취소한다 = 알람 끄기.
      void syncScheduledAlarms(
        buildAlarmPlan({ segments, scheduleStart, selected, fixedTimes, now: new Date() })
      );
    };

    sync();

    // 앱으로 돌아왔을 때: 미뤄 둔 동기화를 처리하고, 겸사겸사 계획을 최신화한다.
    // (밤새 앱을 열어 둔 채 날짜가 바뀌면 "오늘 근무"가 달라져 있다)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (deferred) sync();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const stateHandle = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) sync();
    });

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stateHandle.then((h) => h.remove()).catch(() => {});
    };
  }, [segments, scheduleStart, selected, fixedTimes]);

  // ── 발화(웹) + 하루 경계 정리(공통) ──
  useEffect(() => {
    if (selected.length === 0 && fixedTimes.length === 0) return;

    const dateKey = new Date().toDateString();
    if (lastDateRef.current && lastDateRef.current !== dateKey) {
      resetFired();
    }
    lastDateRef.current = dateKey;

    const native = isNativeApp();

    const check = () => {
      const now = new Date();

      // 방금 지나간 알람을 찾는다: 1분 전을 기준으로 계획을 뽑으면
      // "그 사이에 도래한 것"이 목록 앞쪽에 남는다(계획은 시간순 정렬).
      if (!native) {
        const plan = buildAlarmPlan({
          segments,
          scheduleStart,
          selected,
          fixedTimes,
          now: new Date(now.getTime() - LOOKBACK_MS),
        });

        for (const event of plan) {
          if (event.at.getTime() > now.getTime()) break; // 아직 미래 — 뒤는 볼 것도 없다
          if (fired.includes(event.key)) continue;

          markFired(event.key);
          playAlarmSound();
          notify(event.title, {
            body: event.body,
            tag: event.key,
            requireInteraction: true,
          });
        }
      }

      // ── 마지막 구간 출발이 지나면 알람 설정을 정리한다 (기존 정책 유지) ──
      // 네이티브에서도 돌아야 한다 — 안 그러면 끝난 근무의 설정이 남아 다음 날 예약된다.
      if (!clearedRef.current && segments && segments.length >= 2) {
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const lastSeg = segments[segments.length - 1];
        let lastDep = timeToMins(lastSeg.d);
        if (lastDep >= 0) {
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
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [segments, scheduleStart, selected, fixedTimes, fired, markFired, resetFired, clearAll, notify]);
}
