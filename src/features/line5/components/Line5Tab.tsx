'use client';

import { useState, useEffect } from 'react';
import { useTrainStore } from '@/stores/train';
import { useTrainPolling } from '../hooks/useTrainPolling';
import TrainList from './TrainList';
import RouteMap from './RouteMap';
import styles from '../styles/Line5.module.css';

const BRANCHES = [
  { key: 'main' as const, label: '본선' },
  { key: 'macheon' as const, label: '마천' },
  { key: 'hanam' as const, label: '하남' },
];

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return '방금';
  if (diff < 60) return `${diff}초 전`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}시간 전`;
}

export default function Line5Tab() {
  const { branch, viewMode, loading, error, lastFetch, setBranch, setViewMode } = useTrainStore();
  const { refresh } = useTrainPolling();

  // 상대시간 갱신 (10초마다)
  const [relTime, setRelTime] = useState('');
  useEffect(() => {
    if (!lastFetch) return;
    setRelTime(formatRelativeTime(lastFetch));
    const id = setInterval(() => setRelTime(formatRelativeTime(lastFetch)), 10000);
    return () => clearInterval(id);
  }, [lastFetch]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>5호선 실시간</h2>
          <span className={`${styles.liveDot} ${loading ? styles.liveDotLoading : ''}`} />
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={refresh}
          disabled={loading}
          aria-label="새로고침"
        >
          ↻
        </button>
      </div>

      {relTime && (
        <p className={styles.lastUpdate}>{relTime} 갱신</p>
      )}

      {/* 지선 탭 */}
      <div className={styles.branchTabs} role="tablist">
        {BRANCHES.map((b) => (
          <button
            key={b.key}
            type="button"
            role="tab"
            aria-selected={branch === b.key}
            className={`${styles.branchTab} ${branch === b.key ? styles.branchTabActive : ''}`}
            onClick={() => setBranch(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 보기 모드 토글 */}
      <div className={styles.viewToggle}>
        <button
          type="button"
          className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
          onClick={() => setViewMode('list')}
        >
          리스트
        </button>
        <button
          type="button"
          className={`${styles.viewBtn} ${viewMode === 'map' ? styles.viewBtnActive : ''}`}
          onClick={() => setViewMode('map')}
        >
          노선도
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button type="button" className={styles.errorRetry} onClick={refresh}>
            다시 시도
          </button>
        </div>
      )}

      {/* 로딩 */}
      {loading && !lastFetch && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>열차 정보 불러오는 중...</p>
        </div>
      )}

      {/* 콘텐츠 */}
      {viewMode === 'list' ? <TrainList /> : <RouteMap />}
    </div>
  );
}
