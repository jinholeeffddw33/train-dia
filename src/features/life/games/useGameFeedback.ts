'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 미니게임 공용 피드백 훅 — 진동 + 효과음
 *
 * - Web Audio API로 짧은 톤 생성(파일 불필요, 용량 0)
 * - navigator.vibrate는 Android/일부 브라우저만 작동 (iOS Safari 미지원)
 * - 사용자가 on/off 토글 가능 (localStorage 저장)
 * - 음소거/진동 꺼짐 상태에서도 에러 없이 no-op
 */

const LS_SOUND = 'traindia-game-sound';
const LS_VIBRATE = 'traindia-game-vibrate';

type FeedbackKind =
  | 'tick'          // 가벼운 탭 (사과 먹기 · 색 터치)
  | 'success'       // 성공 (정답 · 라운드 클리어)
  | 'fail'          // 실패 (너무 빨리 누름 · 오답)
  | 'gameover'      // 게임오버
  | 'record'        // 신기록
  | 'ready'         // ready 전환 (반응속도 초록 전환)
  | 'button'        // 버튼 눌림
  | 'power'         // 역행 단 올림 (스피드 마스터) — 밝고 짧게
  | 'brake'         // 제동 단 취급 (스피드 마스터) — 낮고 바람 빠지듯
  | 'buzzer';       // 오답 부저 (차단기 마스터) — 실제 부저처럼 두 번 짧게

interface ToneSpec {
  freq: number;
  duration: number; // sec
  type?: OscillatorType;
  gain?: number;
}

const TONES: Record<FeedbackKind, ToneSpec[]> = {
  tick:     [{ freq: 880, duration: 0.05, type: 'sine', gain: 0.15 }],
  success:  [
    { freq: 660, duration: 0.08, type: 'sine', gain: 0.2 },
    { freq: 990, duration: 0.12, type: 'sine', gain: 0.2 },
  ],
  fail:     [{ freq: 180, duration: 0.25, type: 'square', gain: 0.18 }],
  gameover: [
    { freq: 330, duration: 0.12, type: 'sawtooth', gain: 0.2 },
    { freq: 220, duration: 0.18, type: 'sawtooth', gain: 0.2 },
    { freq: 140, duration: 0.25, type: 'sawtooth', gain: 0.2 },
  ],
  record:   [
    { freq: 523, duration: 0.1, type: 'triangle', gain: 0.22 },
    { freq: 659, duration: 0.1, type: 'triangle', gain: 0.22 },
    { freq: 784, duration: 0.1, type: 'triangle', gain: 0.22 },
    { freq: 1047, duration: 0.2, type: 'triangle', gain: 0.25 },
  ],
  ready:    [{ freq: 1320, duration: 0.06, type: 'sine', gain: 0.2 }],
  button:   [
    { freq: 440, duration: 0.06, type: 'triangle', gain: 0.18 },
    { freq: 660, duration: 0.06, type: 'triangle', gain: 0.18 },
    { freq: 880, duration: 0.08, type: 'triangle', gain: 0.2 },
  ],
  /* 역행/제동은 소리로 구분돼야 한다 — 화면을 안 보고 손만 움직여도 어느 쪽인지 알게.
     역행은 위로 뻗는 밝은 두 음, 제동은 아래로 깔리는 탁한 한 음. */
  power:    [
    { freq: 590, duration: 0.04, type: 'triangle', gain: 0.16 },
    { freq: 790, duration: 0.05, type: 'triangle', gain: 0.16 },
  ],
  brake:    [{ freq: 240, duration: 0.09, type: 'sawtooth', gain: 0.14 }],
  /* 오답 부저 — fail 보다 낮고 두 번 끊어 울린다. 틀렸다는 것이 소리만으로 분명해야 한다. */
  buzzer:   [
    { freq: 150, duration: 0.13, type: 'square', gain: 0.2 },
    { freq: 120, duration: 0.2, type: 'square', gain: 0.2 },
  ],
};

const VIBRATE_PATTERNS: Record<FeedbackKind, number | number[]> = {
  tick: 15,
  success: 40,
  fail: 100,
  gameover: [80, 60, 80, 60, 120],
  record: [60, 40, 60, 40, 120],
  ready: 30,
  button: [20, 40, 30],
  power: 12,
  brake: 22,
  buzzer: [90, 60, 120],
};

function loadPref(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === '1';
  } catch {
    return defaultValue;
  }
}

function savePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function useGameFeedback() {
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [vibrateOn, setVibrateOn] = useState<boolean>(true);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync from localStorage
    setSoundOn(loadPref(LS_SOUND, true));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync from localStorage
    setVibrateOn(loadPref(LS_VIBRATE, true));
  }, []);

  // 브라우저 AudioContext는 유저 제스처 후에만 재생 가능 — lazy init
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (ctxRef.current) return ctxRef.current;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playTone = useCallback((spec: ToneSpec, startOffset: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? 'sine';
      osc.frequency.value = spec.freq;
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);

      const now = ctx.currentTime + startOffset;
      const peak = spec.gain ?? 0.2;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.005);
      gain.gain.linearRampToValueAtTime(0, now + spec.duration);

      osc.start(now);
      osc.stop(now + spec.duration + 0.02);
    } catch {
      /* ignore */
    }
  }, [getCtx]);

  const feedback = useCallback((kind: FeedbackKind) => {
    if (soundOn) {
      const tones = TONES[kind];
      let offset = 0;
      for (const t of tones) {
        playTone(t, offset);
        offset += t.duration;
      }
    }

    if (vibrateOn) {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(VIBRATE_PATTERNS[kind]);
        }
      } catch {
        /* ignore */
      }
    }
  }, [soundOn, vibrateOn, playTone]);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      savePref(LS_SOUND, next);
      return next;
    });
  }, []);

  const toggleVibrate = useCallback(() => {
    setVibrateOn((prev) => {
      const next = !prev;
      savePref(LS_VIBRATE, next);
      return next;
    });
  }, []);

  // 컴포넌트 언마운트 시 AudioContext 정리
  useEffect(() => {
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  return {
    feedback,
    soundOn,
    vibrateOn,
    toggleSound,
    toggleVibrate,
  };
}
