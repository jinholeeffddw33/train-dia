'use client';

import { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import styles from './HallOfFame.module.css';

interface HofEntry {
  game: string;
  year: number;
  month: number;
  rank: number;
  sabun: string;
  name: string;
  score: number | null;
  wins: number | null;
  losses: number | null;
}

interface HallOfFameProps {
  onBack: () => void;
}

const GAME_LABEL: Record<string, string> = {
  apex: 'APEX RUSH',
  snake: '사과 먹기',
  reaction: '반응속도',
  mental: '암산 스프린트',
  simon: '색깔 따라하기',
  halli: '할리갈리',
  omok: '오목',
  reversi: '오델로',
};

const GAME_ORDER = ['apex', 'snake', 'reaction', 'mental', 'simon', 'halli', 'omok', 'reversi'];

const MEDAL = ['🥇', '🥈', '🥉'];

function formatStat(entry: HofEntry): string {
  if (entry.score !== null) {
    if (entry.game === 'reaction') return `${entry.score}ms`;
    return `${entry.score}점`;
  }
  if (entry.wins !== null) {
    return `${entry.wins}승 ${entry.losses ?? 0}패`;
  }
  return '';
}

export default function HallOfFame({ onBack }: HallOfFameProps) {
  const [entries, setEntries] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/games/hall-of-fame')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((json) => {
        if (!active) return;
        setEntries(json.entries ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError('명예의 전당을 불러올 수 없어요. 다시 시도해주세요');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, HofEntry[]>();
    for (const e of entries) {
      const key = `${e.year}-${e.month}`;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([key, list]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, list };
      })
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [entries]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.title}>
          <Trophy size={20} strokeWidth={2} aria-hidden /> 명예의 전당
        </h2>
      </div>

      <p className={styles.subtitle}>매월 1·2·3등의 기록이 영원히 남아요</p>

      {loading && <p className={styles.empty}>불러오는 중...</p>}

      {!loading && error && (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button type="button" className={`z-cta ${styles.retryBtn}`} onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className={styles.emptyBox}>
          <span className={styles.emptyIcon}>🏆</span>
          <p className={styles.emptyText}>아직 기록이 없어요</p>
          <p className={styles.emptyHint}>이번 달이 끝나면 1·2·3등이 여기 박힙니다</p>
        </div>
      )}

      {!loading && !error && grouped.length > 0 && (
        <div className={styles.monthList}>
          {grouped.map(({ year, month, list }) => {
            const byGame = new Map<string, HofEntry[]>();
            for (const e of list) {
              const arr = byGame.get(e.game) ?? [];
              arr.push(e);
              byGame.set(e.game, arr);
            }
            const sortedGames = GAME_ORDER.filter((g) => byGame.has(g));

            return (
              <section key={`${year}-${month}`} className={styles.monthBlock}>
                <h3 className={styles.monthTitle}>{year}년 {month}월</h3>
                <div className={styles.gameList}>
                  {sortedGames.map((game) => {
                    const top3 = (byGame.get(game) ?? []).slice().sort((a, b) => a.rank - b.rank);
                    return (
                      <div key={game} className={styles.gameCard}>
                        <h4 className={styles.gameLabel}>{GAME_LABEL[game] ?? game}</h4>
                        <ol className={styles.podium}>
                          {top3.map((entry) => (
                            <li key={entry.rank} className={styles.podiumItem} data-rank={entry.rank}>
                              <span className={styles.medal}>{MEDAL[entry.rank - 1]}</span>
                              <span className={styles.name}>{entry.name}</span>
                              <span className={styles.stat}>{formatStat(entry)}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
