'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 브라우저 내장 Web Speech API(speechSynthesis) 한국어 TTS 훅.
 * - 동시에 한 번에 하나의 발화만 유지(global queue 대체)
 * - 같은 텍스트 재생 시 토글(정지)로 동작
 */
export function useSpeak() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const supported = typeof window !== 'undefined'
    && typeof window.speechSynthesis !== 'undefined';
  const currentUtterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    currentUtterRef.current = null;
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback((id: string, text: string) => {
    if (!supported) return;
    // 같은 항목 다시 클릭 → 정지
    if (speakingId === id) {
      stop();
      return;
    }
    // 다른 항목이 재생 중이면 중단 후 시작
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 1.0;
    utter.pitch = 1.0;

    // 가능하면 한국어 음성 선택
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find((v) => v.lang === 'ko-KR' || v.lang.startsWith('ko'));
    if (koVoice) utter.voice = koVoice;

    utter.onend = () => {
      currentUtterRef.current = null;
      setSpeakingId(null);
    };
    utter.onerror = () => {
      currentUtterRef.current = null;
      setSpeakingId(null);
    };

    currentUtterRef.current = utter;
    setSpeakingId(id);
    window.speechSynthesis.speak(utter);
  }, [supported, speakingId, stop]);

  // 언마운트 시 안전 정리
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { speak, stop, speakingId, supported };
}
