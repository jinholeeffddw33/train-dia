'use client';

/**
 * APEX RUSH 랭킹 (train-dia) — zinosb 리더보드 임베드 UI 그대로 (진호 2026-07-08 "랭킹도 UI 100%").
 * 스타일 = zinosb leaderboard.module.css(sync) + apex.module.css rankOverlay(다크 풀스크린).
 * 데이터 = train-dia game_scores (/api/games/rankings). 거리·프로필사진·팔로잉은 train-dia 데이터에
 * 없어 임베드 모드처럼 순위·이름·점수만 노출.
 */

import { useState, useEffect, useCallback } from 'react';
import overlay from './apex/styles/apex.module.css';
import styles from './apex/styles/leaderboard.module.css';

const PERIOD_LABELS = { all: '전체', month: '이번 달' } as const;
type Period = keyof typeof PERIOD_LABELS;

interface Entry {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
}
interface MyRank {
  rank: number;
  score: number;
  total: number;
}

function rankClass(rank: number): string {
  if (rank === 1) return styles.rankGold;
  if (rank === 2) return styles.rankSilver;
  if (rank === 3) return styles.rankBronze;
  return '';
}

export default function ApexLeaderboard({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('all');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRanking = useCallback((p: Period) => {
    setLoading(true);
    setError(false);
    fetch(`/api/games/rankings?game=apex&period=${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('rank fetch failed'))))
      .then((json) => {
        setEntries(json.top5 ?? []);
        setMyRank(json.myRank ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRanking(period); }, [period, fetchRanking]);

  return (
    <div className={overlay.rankOverlay}>
      <div className={styles.container}>
        <div className={styles.overlayHeader}>
          <button type="button" onClick={onClose} className={styles.overlayCloseBtn} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className={styles.overlayHeaderTitle}>APEX RUSH 랭킹</span>
        </div>

        {/* 기간 탭 — zinosb periodTabs 스타일 그대로 (train-dia 는 전체/이번 달) */}
        <div className={styles.periodTabs}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.periodTab} ${period === p ? styles.periodTabActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {loading && <div className={styles.loading}>불러오는 중...</div>}

        {error && !loading && (
          <div className={styles.error}>
            <span className={styles.errorText}>데이터를 불러오지 못했습니다</span>
            <button type="button" className={styles.retryBtn} onClick={() => fetchRanking(period)}>
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{'🏆'}</span>
            <span className={styles.emptyText}>아직 기록이 없습니다</span>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className={styles.list}>
            {entries.map((e) => (
              <div key={`${e.rank}-${e.name}`} className={`${styles.entry} ${e.isMe ? styles.entryMe : ''}`}>
                <span className={`${styles.rank} ${rankClass(e.rank)}`}>{e.rank}</span>
                <span className={styles.avatarPlaceholder}>{'🚴'}</span>
                <div className={styles.userInfo}>
                  <span className={styles.nickname}>{e.name}</span>
                </div>
                <div className={styles.scoreCol}>
                  <div className={styles.scoreValue}>{e.score.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 내 순위 — zinosb Near Me 패널 스타일 (train-dia 는 단일 행) */}
        {myRank && !loading && !error && (
          <div className={styles.nearMePanel}>
            <div className={styles.nearMeHeader}>
              <span className={styles.nearMeLabel}>내 순위</span>
              <span className={styles.nearMeRank}>#{myRank.rank}</span>
              <span className={styles.nearMeScore}>{myRank.score.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
