'use client';

/**
 * APEX RUSH — train-dia 호스트 래퍼 (진호 2026-07-08 이식)
 *
 * 게임 코어(games/apex/**)는 zinosb-marketplace 가 SSOT 이고 `npm run sync:apex` 로 복사된다
 * (여기서 직접 고치지 말 것 — 다음 sync 에 덮어씀). 이 래퍼가 train-dia 전용 결합만 주입한다:
 *   - 랭킹 제출 = /api/games/scores (game='apex') · 조회 = GameRanking (game_scores 재사용)
 *   - 햅틱 = useGameFeedback · 로깅 = console
 * 랭킹 DB 는 zinosb 와 완전 별개(train-dia game_scores).
 */

import { useMemo } from 'react';
import ApexGame from './apex/ApexGame';
import type { ApexHost } from './apex/host';
import GameRanking from './GameRanking';
import { useGameFeedback } from './useGameFeedback';
import styles from './ApexRush.module.css';

export default function ApexRush({ onBack }: { onBack: () => void }) {
  const { feedback } = useGameFeedback();

  const host = useMemo<ApexHost>(() => ({
    // train-dia 는 로그인 앱 — 게임 진입 = 로그인 상태(서버가 401 재검증)
    isAuthenticated: true,
    submitScore: async (p) => {
      const res = await fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: 'apex', score: p.score }),
      });
      if (!res.ok) throw new Error(`apex score submit failed: ${res.status}`);
      // 순위는 GameRanking 오버레이가 /api/games/rankings 로 별도 조회하므로 rank 는 null
      return { rank: null };
    },
    haptic: () => feedback('tick'),
    logError: (err) => { console.error('[apex]', err); },
    // 랭킹 UI = train-dia 공용 GameRanking (game_scores) 를 바텀시트로
    renderLeaderboard: ({ onClose }) => (
      <div className={styles.rankOverlay} role="dialog" aria-modal="true">
        <button type="button" className={styles.rankBackdrop} onClick={onClose} aria-label="닫기" />
        <div className={styles.rankSheet}>
          <div className={styles.rankHeader}>
            <span className={styles.rankTitle}>APEX RUSH 랭킹</span>
            <button type="button" className={styles.rankClose} onClick={onClose} aria-label="닫기">✕</button>
          </div>
          <GameRanking game="apex" scoreUnit="점" />
        </div>
      </div>
    ),
  }), [feedback]);

  return <ApexGame host={host} onExit={onBack} />;
}
