'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTrainStore } from '@/stores/train';

const POLL_INTERVAL = 120_000; // 2분

export function useTrainPolling() {
  const { setData, setLoading, setError, loading } = useTrainStore();
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
        // API에서 정제된 데이터를 store 형식으로 매핑
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

  useEffect(() => {
    fetchTrains();
    timerRef.current = setInterval(fetchTrains, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchTrains]);

  return { refresh: fetchTrains, loading };
}
