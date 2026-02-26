'use client';

import { useState, useCallback } from 'react';
import { ArrowUpDown } from 'lucide-react';
import Modal from '@/components/common/Modal';
import RouteResult from './RouteResult';
import styles from '../styles/Subway.module.css';

const TIME_MODES = [
  { key: 'now', label: '지금 출발' },
  { key: 'first', label: '첫차' },
  { key: 'last', label: '막차' },
] as const;

function getDayType(): '1' | '2' | '3' {
  const day = new Date().getDay();
  if (day === 0) return '3';
  if (day === 6) return '2';
  return '1';
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

interface RouteSearchResult {
  totalTime: number;
  travelTime: number;
  walkTime: number;
  transfers: number;
  fare: number;
  departure: string;
  arrival: string;
  segments: Array<{
    type: 'ride' | 'transfer';
    laneId?: number;
    from?: string;
    to?: string;
    time?: number;
    stopCount?: number;
    destination?: string;
    departure?: string;
    arrival?: string;
  }>;
}

export default function SubwaySearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'now' | 'first' | 'last'>('now');
  const [results, setResults] = useState<RouteSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRoute = useCallback(async () => {
    if (!from.trim() || !to.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // 1) 출발역 ID 조회
      const [fromRes, toRes] = await Promise.all([
        fetch(`/api/odsay/search-station?name=${encodeURIComponent(from.trim())}`),
        fetch(`/api/odsay/search-station?name=${encodeURIComponent(to.trim())}`),
      ]);

      if (!fromRes.ok || !toRes.ok) {
        setError('역 검색에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      const fromData = await fromRes.json();
      const toData = await toRes.json();

      const fromStation = fromData.stations?.[0];
      const toStation = toData.stations?.[0];

      if (!fromStation) { setError(`"${from}" 역을 찾을 수 없습니다.`); return; }
      if (!toStation) { setError(`"${to}" 역을 찾을 수 없습니다.`); return; }

      // 2) 경로 검색
      const modeMap = { now: '1', first: '3', last: '4' };
      const params = new URLSearchParams({
        sid: String(fromStation.id),
        eid: String(toStation.id),
        mode: modeMap[mode],
        day: getDayType(),
        time: getCurrentTime(),
      });

      const routeRes = await fetch(`/api/odsay/route-search?${params}`);
      if (!routeRes.ok) {
        setError('경로 검색에 실패했습니다. 다시 시도해주세요.');
        return;
      }
      const routeData = await routeRes.json();

      if (routeData.paths?.length) {
        setResults(routeData.paths);
      } else {
        setError(routeData.message ?? '경로를 찾을 수 없습니다.');
      }
    } catch {
      setError('네트워크 오류 — 인터넷 연결을 확인하세요.');
    } finally {
      setLoading(false);
    }
  }, [from, to, mode]);

  return (
    <Modal open={open} onClose={onClose} title="지하철 경로검색">
      <div className={styles.container}>
        {/* 출발/도착 입력 */}
        <div className={styles.inputGroup}>
          <div className={styles.inputRow}>
            <span className={styles.inputLabel}>출발</span>
            <input
              type="text"
              className={styles.stationInput}
              placeholder="출발역"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="출발역"
            />
          </div>
          <button
            type="button"
            className={styles.swapBtn}
            onClick={() => { setFrom(to); setTo(from); }}
            aria-label="출발/도착 교환"
          >
            <ArrowUpDown size={16} />
          </button>
          <div className={styles.inputRow}>
            <span className={styles.inputLabel}>도착</span>
            <input
              type="text"
              className={styles.stationInput}
              placeholder="도착역"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="도착역"
            />
          </div>
        </div>

        {/* 시간 모드 */}
        <div className={styles.modeRow}>
          {TIME_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`${styles.modeBtn} ${mode === m.key ? styles.modeBtnActive : ''}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 검색 버튼 */}
        <button
          type="button"
          className={styles.searchBtn}
          onClick={searchRoute}
          disabled={loading || !from.trim() || !to.trim()}
        >
          {loading ? '검색 중...' : '경로 검색'}
        </button>

        {/* 에러 */}
        {error && <p className={styles.searchError}>{error}</p>}

        {/* 결과 */}
        {results && results.map((route, i) => (
          <RouteResult key={i} route={route} index={i} />
        ))}
      </div>
    </Modal>
  );
}
