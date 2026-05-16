'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 안내방송 TTS 재생 훅.
 * 우선순위:
 *   1. 사전 생성된 MP3 (announce-manifest.json에 매핑된 텍스트)
 *   2. 브라우저 내장 Web Speech API (fallback)
 *
 * - 동시에 한 항목만 재생, 같은 항목 재클릭 시 정지(토글)
 */
export function useSpeak() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const supported = typeof window !== 'undefined'
    && (typeof window.speechSynthesis !== 'undefined' || typeof window.Audio !== 'undefined');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const manifestRef = useRef<Record<string, string> | null>(null);
  const manifestLoaded = useRef<Promise<void> | null>(null);

  // 매니페스트 1회 로드
  const ensureManifest = useCallback(() => {
    if (!manifestLoaded.current) {
      manifestLoaded.current = fetch('/data/edu/announce-manifest.json')
        .then((r) => (r.ok ? r.json() : {}))
        .then((j) => { manifestRef.current = j as Record<string, string>; })
        .catch(() => { manifestRef.current = {}; });
    }
    return manifestLoaded.current;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') ensureManifest();
  }, [ensureManifest]);

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const playMp3 = useCallback((id: string, url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeakingId(id);
    audio.onended = () => {
      audioRef.current = null;
      setSpeakingId((cur) => (cur === id ? null : cur));
    };
    audio.onerror = () => {
      audioRef.current = null;
      setSpeakingId((cur) => (cur === id ? null : cur));
    };
    audio.play().catch(() => {
      audioRef.current = null;
      setSpeakingId(null);
    });
  }, []);

  const playTts = useCallback((id: string, text: string) => {
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 1.0;
    utter.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find((v) => v.lang === 'ko-KR' || v.lang.startsWith('ko'));
    if (koVoice) utter.voice = koVoice;
    utter.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
    utter.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
    setSpeakingId(id);
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(async (id: string, rawText: string, spokenText?: string) => {
    if (!supported) return;
    // 토글: 같은 항목 재클릭 시 정지
    if (speakingId === id) {
      stop();
      return;
    }
    // 진행 중인 다른 재생 중단
    stop();

    await ensureManifest();
    const url = manifestRef.current?.[rawText];
    if (url) {
      playMp3(id, url);
    } else {
      playTts(id, spokenText ?? rawText);
    }
  }, [supported, speakingId, stop, ensureManifest, playMp3, playTts]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      }
    };
  }, []);

  return { speak, stop, speakingId, supported };
}
