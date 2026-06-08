'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionResult = { transcript: string; isFinal: boolean };

interface Options {
  /** 인식된 텍스트(최종)를 받아 처리. 자동 전송 등 후속 처리에 사용 */
  onResult?: (transcript: string) => void;
  /** 인식 진행 중간 결과 (옵션 — interim) */
  onInterim?: (transcript: string) => void;
  /** 언어 코드. 기본 ko-KR */
  lang?: string;
}

/**
 * Web Speech API (SpeechRecognition) 훅 — STT.
 * Chrome·Edge·Safari(iOS 14.5+) 지원. Firefox 미지원.
 */
export function useSpeechRecognition(opts: Options = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any | null>(null);
  const onResultRef = useRef(opts.onResult);
  const onInterimRef = useRef(opts.onInterim);
  const langRef = useRef(opts.lang || 'ko-KR');

  // 콜백 최신 참조 유지 (재구성 없이)
  useEffect(() => { onResultRef.current = opts.onResult; }, [opts.onResult]);
  useEffect(() => { onInterimRef.current = opts.onInterim; }, [opts.onInterim]);
  useEffect(() => { langRef.current = opts.lang || 'ko-KR'; }, [opts.lang]);

  const supported = typeof window !== 'undefined'
    && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
    }
  }, []);

  const start = useCallback(() => {
    if (!supported) { setError('이 브라우저는 음성 인식을 지원하지 않아요'); return; }
    if (listening) return;
    setError(null);
    setTranscript('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = langRef.current;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i] as SpeechRecognitionResult;
        if (result.isFinal) final += result.transcript;
        else interim += result.transcript;
      }
      const text = (final || interim).trim();
      setTranscript(text);
      if (final && onResultRef.current) onResultRef.current(final.trim());
      else if (interim && onInterimRef.current) onInterimRef.current(interim.trim());
    };
    rec.onerror = (e: any) => {
      const code = e?.error;
      const msg =
        code === 'not-allowed' || code === 'permission-denied' ? '마이크 권한이 필요해요'
        : code === 'no-speech' ? '음성이 감지되지 않았어요'
        : code === 'audio-capture' ? '마이크를 찾을 수 없어요'
        : code === 'network' ? '네트워크 오류'
        : '음성 인식 오류';
      setError(msg);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
    } catch (e) {
      setError('음성 인식을 시작할 수 없어요');
      setListening(false);
    }
  }, [supported, listening]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, transcript, error, start, stop };
}
