'use client';

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

export default function Line5Tab() {
  const { branch, viewMode, loading, error, lastFetch, setBranch, setViewMode } = useTrainStore();
  const { refresh } = useTrainPolling();

  const lastTime = lastFetch
    ? new Date(lastFetch).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>5호선 실시간</h2>
        <button
          type="button"
          className={`${styles.refreshBtn} ${loading ? styles.refreshSpin : ''}`}
          onClick={refresh}
          disabled={loading}
          aria-label="새로고침"
        >
          ↻
        </button>
      </div>

      {lastTime && (
        <p className={styles.lastUpdate}>마지막 갱신: {lastTime}</p>
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
