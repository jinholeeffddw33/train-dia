'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTrainStore } from '@/stores/train';

const POLL_INTERVAL = 120_000; // 2분
const STALE_THRESHOLD = 30_000; // 30초 이상 지났으면 복귀 시 즉시 갱신

export function useTrainPolling() {
  const { setData, setLoading, setError, loading, lastFetch } = useTrainStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTrains = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/realtime/trains', {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '서버 오류' }));
        setError(err.message ?? '열차 정보를 가져올 수 없습니다.');
        return;
      }
      const data = await res.json();
      if (data.trains) {
        setData(
          data.trains.map((t: Record<string, string>) => ({
            statnNm: t.station,
            trainNo: t.trainNo,
            updnLine: t.direction === 'up' ? '상행' : '하행',
            statnTnm: t.destination,
            bstatnNm: t.destination,
            recptnDt: '',
            trainSttus: t.status,
            directAt: '0',
            lstcarAt: '0',
          })),
        );
      } else {
        setData([]);
        if (data.message) setError(data.message);
      }
    } catch {
      setError('네트워크 오류 — 인터넷 연결을 확인하세요.');
    }
  }, [setData, setLoading, setError]);

  // 폴링 시작/정지 헬퍼
  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchTrains, POLL_INTERVAL);
  }, [fetchTrains]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // 최초 로드
    fetchTrains();
    startPolling();

    // 탭 복귀 시 즉시 갱신 + 폴링 재시작
    // 탭 이탈 시 폴링 중지 (배터리 절약)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = lastFetch ? Date.now() - lastFetch : Infinity;
        if (elapsed >= STALE_THRESHOLD) {
          fetchTrains();
        }
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchTrains, startPolling, stopPolling, lastFetch]);

  return { refresh: fetchTrains, loading };
}
