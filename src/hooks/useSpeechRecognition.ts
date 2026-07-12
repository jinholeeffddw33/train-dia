'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 브라우저 내장 음성인식(Web Speech API) → 텍스트.
 * 지원: Chrome(안드로이드/PC)·삼성인터넷 ✅ / iOS Safari 는 제한적(미지원 시 supported=false).
 *
 * onTranscript(sessionFinal): 이번 듣기 세션의 "누적 최종 텍스트"를 통째로 전달.
 *   호출부는 이어붙이지 말고 base + sessionFinal 로 '설정'만 하면 됨 → 중복 이벤트가 와도 안전.
 *   (안드로이드 크롬은 같은 문장을 여러 번/다른 인덱스로 내보내므로 스냅샷 설정 방식이 필수)
 * interim: 인식 중 임시 텍스트(회색 미리보기용).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function useSpeechRecognition(onTranscript: (sessionFinal: string) => void, lang = 'ko-KR') {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const onRef = useRef(onTranscript);
  onRef.current = onTranscript;
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
      // 매 이벤트마다 결과 목록 전체에서 최종/임시를 새로 계산(스냅샷) → 이어붙이기 X, 설정 O
      let finalStr = '';
      let interimStr = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalStr += t;
        else interimStr += t;
      }
      setInterim(interimStr);
      onRef.current(finalStr);
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.onerror = () => { setListening(false); setInterim(''); };
    recRef.current = rec;

    return () => { try { rec.stop(); } catch { /* noop */ } recRef.current = null; };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current || listeningRef.current) return;
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
