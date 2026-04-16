'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './GameRanking.module.css';

interface RankEntry {
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

interface RankingData {
  top5: RankEntry[];
  myRank: MyRank | null;
  totalPlayers: number;
}

interface GameRankingProps {
  game: 'snake' | 'reaction' | 'mental' | 'simon';
  /** reaction은 낮을수록 좋음 */
  scoreLabel?: string;
  scoreUnit?: string;
}

export default function GameRanking({ game, scoreLabel = '점수', scoreUnit = '점' }: GameRankingProps) {
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRanking = useCallback(() => {
    setLoading(true);
    fetch(`/api/games/rankings?game=${game}&period=${period}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [game, period]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className={styles.wrap}>
      {/* 탭 */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${period === 'all' ? styles.tabActive : ''}`}
          onClick={() => setPeriod('all')}
        >
          전체 랭킹
        </button>
        <button
          type="button"
          className={`${styles.tab} ${period === 'month' ? styles.tabActive : ''}`}
          onClick={() => setPeriod('month')}
        >
          이번 달
        </button>
      </div>

      {loading ? (
        <p className={styles.loading}>불러오는 중...</p>
      ) : !data || data.top5.length === 0 ? (
        <p className={styles.empty}>아직 기록이 없어요</p>
      ) : (
        <>
          {/* 탑 5 */}
          <div className={styles.list}>
            {data.top5.map((entry) => (
              <div
                key={`${entry.rank}-${entry.name}`}
                className={`${styles.row} ${entry.isMe ? styles.rowMe : ''} ${entry.rank <= 3 ? styles.rowTop3 : ''}`}
              >
                <span className={styles.rank}>
                  {entry.rank <= 3 ? medals[entry.rank - 1] : `${entry.rank}`}
                </span>
                <span className={styles.name}>
                  {entry.name}
                  {entry.isMe && <span className={styles.meTag}>나</span>}
                </span>
                <span className={styles.score}>
                  {entry.score}{scoreUnit}
                </span>
              </div>
            ))}
          </div>

          {/* 내 순위 */}
          {data.myRank && (
            <div className={styles.myRank}>
              <span className={styles.myRankLabel}>내 순위</span>
              <span className={styles.myRankValue}>
                {data.myRank.rank}위 / {data.myRank.total}명
              </span>
              <span className={styles.myRankScore}>
                {scoreLabel} {data.myRank.score}{scoreUnit}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
