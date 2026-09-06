'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 안내방송 MP3 단일 재생 관리자.
 * - 모듈 레벨 singleton — 동시에 하나만 재생
 * - 새 재생 시 진행 중 audio + Web Speech 모두 정지
 * - playingId 구독 (여러 카드 동기화)
 */
let currentAudio: HTMLAudioElement | null = null;
let currentId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function notify() {
  listeners.forEach((fn) => fn(currentId));
}

function stopAll() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; } catch { /* ignore */ }
    currentAudio = null;
  }
  if (currentId !== null) {
    /* 음성 정지는 «우리가 틀어 놓은 것이 있을 때만». speechSynthesis.cancel() 은
       페이지 전체에 걸리는 명령이라, 아무것도 안 틀어 놓고 부르면 화면이 가려지는
       순간 규정 읽어주기까지 함께 꺼졌다. */
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    currentId = null;
    notify();
  }
}

export function useBroadcastAudio() {
  const [playingId, setPlayingId] = useState<string | null>(currentId);
  // 이 훅 인스턴스가 재생 중인 오디오를 시작했는지 추적 → unmount 시 자기가 시작한 것만 정지
  const startedByMeRef = useRef(false);

  useEffect(() => {
    listeners.add(setPlayingId);
    // 탭이 백그라운드로 가면 재생 정지 (사용자가 화면을 벗어난 것과 동일 처리)
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        stopAll();
        startedByMeRef.current = false;
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      listeners.delete(setPlayingId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      // 컴포넌트가 언마운트될 때 이 인스턴스가 시작한 재생이 아직 진행 중이면 정지
      if (startedByMeRef.current) {
        stopAll();
        startedByMeRef.current = false;
      }
    };
  }, []);

  const play = useCallback((id: string, url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      stopAll();
      const audio = new Audio(url);
      audio.preload = 'auto';
      let resolved = false;
      const onErr = () => {
        if (currentId === id) stopAll();
        if (!resolved) { resolved = true; resolve(false); }
      };
      audio.onerror = onErr;
      audio.onended = () => {
        if (currentId === id) {
          stopAll();
          startedByMeRef.current = false;
        }
      };
      currentAudio = audio;
      currentId = id;
      startedByMeRef.current = true;
      notify();
      audio.play().then(() => {
        if (!resolved) { resolved = true; resolve(true); }
      }).catch(onErr);
    });
  }, []);

  const stop = useCallback(() => {
    stopAll();
    startedByMeRef.current = false;
  }, []);

  return { play, stop, playingId };
}
