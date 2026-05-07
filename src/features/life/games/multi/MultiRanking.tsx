'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Target, Dice5, Trophy } from 'lucide-react';
import styles from './MultiRanking.module.css';

type GameKind = 'omok' | 'yutnori';

interface RankRow {
  rank: number;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  isMe: boolean;
}

interface MyRank {
  rank: number;
  rating: number;
  wins: number;
  losses: number;
  total: number;
}

interface RankingData {
  top15: RankRow[];
  myRank: MyRank | null;
  totalPlayers: number;
}

interface Props {
  onBack: () => void;
}

const medals = ['🥇', '🥈', '🥉'];

export default function MultiRanking({ onBack }: Props) {
  const [game, setGame] = useState<GameKind>('omok');
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRanking = useCallback(() => {
    setLoading(true);
    fetch(`/api/games/multi-rankings?game=${game}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [game]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.headerTitle}>
          <Trophy size={18} /> 온라인 대전 랭킹
        </h2>
      </div>

      {/* 게임 선택 탭 */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${game === 'omok' ? styles.tabActive : ''}`}
          onClick={() => setGame('omok')}
          aria-pressed={game === 'omok'}
        >
          <Target size={16} /> 오목
        </button>
        <button
          type="button"
          className={`${styles.tab} ${game === 'yutnori' ? styles.tabActive : ''}`}
          onClick={() => setGame('yutnori')}
          aria-pressed={game === 'yutnori'}
        >
          <Dice5 size={16} /> 윷놀이
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.intro}>
          기본 레이팅 1200점 · 강한 상대 이기면 점수가 더 많이 올라요
        </p>

        {loading ? (
          <p className={styles.loading}>불러오는 중...</p>
        ) : !data || data.top15.length === 0 ? (
          <p className={styles.empty}>
            아직 기록이 없어요.<br />
            첫 대국의 주인공이 되어보세요!
          </p>
        ) : (
          <>
            <div className={styles.list}>
              {data.top15.map((row) => (
                <div
                  key={`${row.rank}-${row.name}`}
                  className={`${styles.row} ${row.isMe ? styles.rowMe : ''} ${row.rank <= 3 ? styles.rowTop3 : ''}`}
                >
                  <span className={styles.rank}>
                    {row.rank <= 3 ? medals[row.rank - 1] : `${row.rank}`}
                  </span>
                  <span className={styles.name}>
                    {row.name}
                    {row.isMe && <span className={styles.meTag}>나</span>}
                  </span>
                  <span className={styles.stats}>
                    <span className={styles.wl}>{row.wins}승 {row.losses}패</span>
                    <span className={styles.rating}>{row.rating}</span>
                  </span>
                </div>
              ))}
            </div>

            {data.myRank && (
              <div className={styles.myRank}>
                <span className={styles.myRankLabel}>내 순위</span>
                <span className={styles.myRankValue}>
                  {data.myRank.rank}위 / {data.myRank.total}명
                </span>
                <span className={styles.myRankScore}>
                  {data.myRank.wins}승 {data.myRank.losses}패 · {data.myRank.rating}점
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
