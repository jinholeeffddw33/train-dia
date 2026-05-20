'use client';

import { useCallback, useEffect, useState } from 'react';

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
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (currentId !== null) {
    currentId = null;
    notify();
  }
}

export function useBroadcastAudio() {
  const [playingId, setPlayingId] = useState<string | null>(currentId);

  useEffect(() => {
    listeners.add(setPlayingId);
    return () => { listeners.delete(setPlayingId); };
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
      audio.onended = () => { if (currentId === id) stopAll(); };
      currentAudio = audio;
      currentId = id;
      notify();
      audio.play().then(() => {
        if (!resolved) { resolved = true; resolve(true); }
      }).catch(onErr);
    });
  }, []);

  const stop = useCallback(() => { stopAll(); }, []);

  return { play, stop, playingId };
}
