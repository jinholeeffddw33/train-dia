'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
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

function useUpdateCounter(lastFetch: number | null) {
  const [label, setLabel] = useState('업데이트 대기중');
  const [dotState, setDotState] = useState<'idle' | 'loading' | 'success' | 'stale'>('idle');

  useEffect(() => {
    if (!lastFetch) {
      setLabel('업데이트 대기중');
      setDotState('idle');
      return;
    }
    const tick = () => {
      const diff = Math.floor((Date.now() - lastFetch) / 1000);
      if (diff < 5) { setLabel('방금 갱신'); setDotState('success'); }
      else if (diff < 60) { setLabel(`${diff}초 전 갱신`); setDotState('success'); }
      else if (diff < 120) { setLabel(`${Math.floor(diff / 60)}분 전 갱신`); setDotState('success'); }
      else { setLabel(`${Math.floor(diff / 60)}분 전 갱신`); setDotState('stale'); }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lastFetch]);

  return { label, dotState };
}

/** "N초 전 갱신" 라벨 leaf — 1초 tick 재렌더를 이 컴포넌트 안에 격리 (탭 전체 매초 재렌더 방지) */
function UpdatedAgoLabel({ lastFetch, loading }: { lastFetch: number | null; loading: boolean }) {
  const { label, dotState } = useUpdateCounter(lastFetch);
  return (
    <span className={`${styles.fabTime} ${styles[`fabTime_${loading ? 'loading' : dotState}`]}`}>
      <span className={`${styles.fabDot} ${styles[`dot_${loading ? 'loading' : dotState}`]}`} />
      {loading ? '갱신중' : label}
    </span>
  );
}

export default function Line5Tab() {
  const { branch, viewMode, loading, error, lastFetch, setBranch, setViewMode, triggerScroll } = useTrainStore();
  const { refresh } = useTrainPolling();

  const handleRefresh = () => {
    refresh();
    triggerScroll();
  };

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={`${styles.header} z-app-header z-app-header-frost`}>
        <h2 className={styles.title}>5호선 실시간</h2>
      </div>

      {/* 지선 탭 — 법① 세그먼트 */}
      <div
        className={`z-segment ${styles.branchTabs}`}
        role="tablist"
        data-no-press
        style={{ '--seg-count': BRANCHES.length, '--seg-idx': BRANCHES.findIndex((b) => b.key === branch) } as React.CSSProperties}
      >
        {BRANCHES.map((b) => (
          <button
            key={b.key}
            type="button"
            role="tab"
            aria-selected={branch === b.key}
            className={`z-segment-item ${branch === b.key ? 'is-on' : ''}`}
            onClick={() => setBranch(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 보기 모드 토글 — 법① 세그먼트 */}
      <div
        className={`z-segment ${styles.viewToggle}`}
        data-no-press
        style={{ '--seg-count': 2, '--seg-idx': viewMode === 'map' ? 1 : 0 } as React.CSSProperties}
      >
        <button
          type="button"
          className={`z-segment-item ${viewMode === 'list' ? 'is-on' : ''}`}
          onClick={() => setViewMode('list')}
        >
          리스트
        </button>
        <button
          type="button"
          className={`z-segment-item ${viewMode === 'map' ? 'is-on' : ''}`}
          onClick={() => setViewMode('map')}
        >
          노선도
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button type="button" className={`z-cta ${styles.errorRetry}`} onClick={refresh} data-press>
            다시 시도해볼게요
          </button>
        </div>
      )}

      {/* 로딩 */}
      {loading && !lastFetch && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>열차 정보를 불러오고 있어요...</p>
        </div>
      )}

      {/* 콘텐츠 */}
      {viewMode === 'list' ? <TrainList /> : <RouteMap />}

      {/* 플로팅 새로고침 + 갱신 시간 */}
      <div className={styles.fabGroup}>
        <button
          type="button"
          className={`${styles.fab} ${loading ? styles.fabSpin : ''}`}
          onClick={handleRefresh}
          disabled={loading}
          aria-label="새로고침"
        >
          <RefreshCw size={20} strokeWidth={2.5} />
        </button>
        <UpdatedAgoLabel lastFetch={lastFetch} loading={loading} />
      </div>
    </div>
  );
}
