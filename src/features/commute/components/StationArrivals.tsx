'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, RefreshCw, Star } from 'lucide-react';
import styles from '../styles/Commute.module.css';

interface ArrivalInfo {
  subwayId: string;
  direction: string;
  destination: string;
  arrivalMsg: string;
  currentStation: string;
  arrivalSec: number;
  trainNo: string;
  trainType: string;
  isLast: boolean;
}

const LINE_NAMES: Record<string, string> = {
  '1001': '1호선', '1002': '2호선', '1003': '3호선', '1004': '4호선',
  '1005': '5호선', '1006': '6호선', '1007': '7호선', '1008': '8호선',
  '1009': '9호선', '1063': '경의중앙', '1065': '공항철도', '1067': '경춘선',
  '1075': '수인분당', '1077': '신분당', '1092': '우이신설',
};

export default function StationArrivals({
  station,
  onClose,
  isFavorite,
  onToggleFavorite,
}: {
  station: string;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [arrivals, setArrivals] = useState<ArrivalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArrivals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/realtime/arrivals?station=${encodeURIComponent(station)}&count=30`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? '도착 정보를 불러오지 못했어요');
        return;
      }
      const data = await res.json();
      setArrivals(data.arrivals ?? []);
    } catch {
      setError('네트워크 연결을 확인해주세요');
    } finally {
      setLoading(false);
    }
  }, [station]);

  useEffect(() => {
    fetchArrivals();
    // 30초마다 자동 갱신
    const id = setInterval(fetchArrivals, 30000);
    return () => clearInterval(id);
  }, [fetchArrivals]);

  // 방향별 그룹핑
  const grouped = arrivals.reduce<Record<string, ArrivalInfo[]>>((acc, a) => {
    const key = `${a.direction}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className={styles.arrivalsContainer}>
      <div className={styles.arrivalsHeader}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="뒤로">
          <ChevronLeft size={20} />
        </button>
        <h3 className={styles.arrivalsTitle}>{station}</h3>
        <button
          type="button"
          className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ''}`}
          onClick={onToggleFavorite}
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className={styles.refreshSmall} onClick={fetchArrivals} aria-label="새로고침">
          <RefreshCw size={18} />
        </button>
      </div>

      {loading && (
        <div className={styles.loadingSmall}>
          <div className={styles.spinnerSmall} />
          <span>불러오고 있어요...</span>
        </div>
      )}

      {error && (
        <div className={styles.errorSmall}>
          <span>{error}</span>
          <button type="button" className={styles.errorRetryBtn} onClick={fetchArrivals} aria-label="다시 시도">다시 시도해볼게요</button>
        </div>
      )}

      {!loading && !error && arrivals.length === 0 && (
        <p className={styles.noArrivals}>도착 예정 열차가 없어요</p>
      )}

      {Object.entries(grouped).map(([dir, items]) => (
        <div key={dir} className={styles.dirGroup}>
          <h4 className={styles.dirLabel}>{dir}</h4>
          {items.map((a) => (
            <div key={`${a.trainNo}-${a.direction}`} className={styles.arrivalRow}>
              <div className={styles.arrivalLeft}>
                <span className={styles.lineBadge}>
                  {LINE_NAMES[a.subwayId] ?? a.subwayId}
                </span>
                <span className={styles.arrivalDest}>→ {a.destination}</span>
                {a.isLast && <span className={styles.lastBadge}>막차</span>}
              </div>
              <div className={styles.arrivalRight}>
                <span className={styles.arrivalMsg}>{a.arrivalMsg}</span>
                <span className={styles.arrivalPos}>{a.currentStation}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
