'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 브라우저 내장 음성인식(Web Speech API) → 텍스트.
 * 지원: Chrome(안드로이드/PC)·삼성인터넷 ✅ / iOS Safari 는 제한적(미지원 시 supported=false).
 * onFinal: 최종 인식된 문장 조각을 콜백(호출부에서 이어붙이기). interim: 인식 중 임시 텍스트.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function useSpeechRecognition(onFinal: (text: string) => void, lang = 'ko-KR') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const appendedRef = useRef<Set<number>>(new Set()); // 이미 반영한 최종결과 인덱스(중복 방지)
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SRClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRClass) { setSupported(false); return; }
    setSupported(true);

    const rec = new SRClass();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interimStr = '';
      // 전체 결과를 훑되, 각 인덱스의 최종결과는 딱 한 번만 반영(Chrome 중복 이벤트 방지)
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          if (!appendedRef.current.has(i)) {
            appendedRef.current.add(i);
            onFinalRef.current(res[0].transcript);
          }
        } else {
          interimStr += res[0].transcript;
        }
      }
      setInterim(interimStr);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.onerror = () => { setListening(false); setInterim(''); };
    recRef.current = rec;

    return () => { try { rec.stop(); } catch { /* noop */ } recRef.current = null; };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current || listeningRef.current) return;
    appendedRef.current = new Set(); // 새 세션 → 인덱스 0부터 다시 시작하므로 초기화
    try { recRef.current.start(); setListening(true); } catch { /* 이미 시작됨 */ }
  }, []);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try { recRef.current.stop(); } catch { /* noop */ }
    setListening(false);
    setInterim('');
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop(); else start();
  }, [start, stop]);

  return { supported, listening, interim, start, stop, toggle };
}
