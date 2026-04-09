'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import GameRanking from './GameRanking';
import styles from './ReactionTest.module.css';

/* ── 타입 ── */
interface ReactionTestProps {
  onBack: () => void;
}

type GameState =
  | { phase: 'idle' }
  | { phase: 'waiting' }
  | { phase: 'ready'; startedAt: number }
  | { phase: 'tooEarly' }
  | { phase: 'result'; time: number }
  | { phase: 'finished'; times: number[] };

const TOTAL_ROUNDS = 5;
const DELAY_MIN = 2000;
const DELAY_MAX = 5000;
const STORAGE_KEY = 'traindia-reaction-best';

/* ── 등급 판정 ── */
function getGrade(avgMs: number): { emoji: string; label: string } {
  if (avgMs <= 200) return { emoji: '⚡', label: '번개' };
  if (avgMs <= 300) return { emoji: '🔥', label: '빠름' };
  if (avgMs <= 400) return { emoji: '👍', label: '보통' };
  return { emoji: '🐢', label: '느림' };
}

/* ── 최고 기록 ── */
function loadBest(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const val = Number(raw);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

function saveBest(ms: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(ms)));
  } catch {
    /* ignore */
  }
}

/* ── 컴포넌트 ── */
export default function ReactionTest({ onBack }: ReactionTestProps) {
  const [state, setState] = useState<GameState>({ phase: 'idle' });
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 최고 기록 로드
  useEffect(() => {
    setBest(loadBest());
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* 다음 라운드 시작 — 대기 상태 */
  const startWaiting = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ phase: 'waiting' });
    const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
    timerRef.current = setTimeout(() => {
      setState({ phase: 'ready', startedAt: performance.now() });
    }, delay);
  }, []);

  /* 게임 시작 */
  const handleStart = useCallback(() => {
    setRound(1);
    setTimes([]);
    startWaiting();
  }, [startWaiting]);

  /* 게임 영역 터치/클릭 */
  const handleTap = useCallback(() => {
    const currentState = state;

    if (currentState.phase === 'idle') {
      // idle 상태에서는 아무것도 안함 (시작 버튼 사용)
      return;
    }

    if (currentState.phase === 'waiting') {
      // 너무 빨리 누름
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ phase: 'tooEarly' });
      return;
    }

    if (currentState.phase === 'tooEarly') {
      // 다시 대기 (같은 라운드)
      startWaiting();
      return;
    }

    if (currentState.phase === 'ready') {
      const elapsed = Math.round(performance.now() - currentState.startedAt);
      setState({ phase: 'result', time: elapsed });

      const newTimes = [...times, elapsed];
      setTimes(newTimes);

      // 잠시 결과 보여주고 다음 라운드 or 종료
      setTimeout(() => {
        if (newTimes.length >= TOTAL_ROUNDS) {
          // 게임 종료
          const avg = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length);
          const currentBest = loadBest();
          if (currentBest === null || avg < currentBest) {
            saveBest(avg);
            setBest(avg);
          }
          setState({ phase: 'finished', times: newTimes });
        } else {
          setRound(newTimes.length + 1);
          startWaiting();
        }
      }, 1500);
      return;
    }

    if (currentState.phase === 'result') {
      // 결과 표시 중 터치 무시
      return;
    }

    if (currentState.phase === 'finished') {
      // 종료 화면에서는 버튼으로만 다시 시작
      return;
    }
  }, [state, times, startWaiting]);

  /* ── 상태별 CSS 클래스 ── */
  const areaClass = (() => {
    switch (state.phase) {
      case 'idle': return styles.stateIdle;
      case 'waiting': return styles.stateWaiting;
      case 'ready': return styles.stateReady;
      case 'tooEarly': return styles.stateTooEarly;
      case 'result': return styles.stateResult;
      case 'finished': return styles.stateResult;
      default: return styles.stateIdle;
    }
  })();

  /* ── 렌더링 ── */
  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>반응속도 테스트</h1>
        {state.phase !== 'idle' && state.phase !== 'finished' && (
          <span className={styles.roundBadge}>{round} / {TOTAL_ROUNDS}</span>
        )}
      </header>

      {/* 게임 영역 */}
      <div
        className={`${styles.gameArea} ${areaClass}`}
        onClick={handleTap}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleTap(); }}
      >
        {/* 시작 대기 화면 */}
        {state.phase === 'idle' && (
          <div className={styles.introCard}>
            <p className={styles.emoji}>🎯</p>
            <h2 className={styles.introTitle}>반응속도 테스트</h2>
            <p className={styles.introDesc}>
              초록색으로 바뀌는 순간 최대한 빨리 터치하세요!<br />
              총 {TOTAL_ROUNDS}회 측정 후 평균 기록을 보여줍니다.
            </p>
            <div className={styles.introSteps}>
              <div className={styles.introStep}>
                <span className={styles.stepNum}>1</span>
                <span>시작하면 빨간 화면이 나타납니다</span>
              </div>
              <div className={styles.introStep}>
                <span className={styles.stepNum}>2</span>
                <span>초록색으로 바뀌면 즉시 터치!</span>
              </div>
              <div className={styles.introStep}>
                <span className={styles.stepNum}>3</span>
                <span>너무 빨리 누르면 다시 시도합니다</span>
              </div>
            </div>
            {best !== null && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best}ms</span>
              </div>
            )}
            <button type="button" className={styles.startBtn} onClick={handleStart}>
              시작하기
            </button>
            <GameRanking game="reaction" scoreLabel="평균" scoreUnit="ms" />
          </div>
        )}

        {/* 대기 중 (빨간 배경) */}
        {state.phase === 'waiting' && (
          <>
            <p className={styles.emoji}>🔴</p>
            <p className={styles.mainText}>초록색으로 바뀌면 터치!</p>
            <p className={styles.subText}>기다리세요...</p>
            <p className={styles.tapHint}>화면 아무 곳이나 터치</p>
          </>
        )}

        {/* 초록 — 지금 터치! */}
        {state.phase === 'ready' && (
          <>
            <p className={styles.emoji}>🟢</p>
            <p className={styles.mainText}>지금 터치!</p>
            <p className={styles.tapHint}>최대한 빨리!</p>
          </>
        )}

        {/* 너무 일찍 */}
        {state.phase === 'tooEarly' && (
          <>
            <p className={styles.emoji}>⚠️</p>
            <p className={styles.mainText}>너무 빨랐어요!</p>
            <p className={styles.subText}>초록색이 될 때까지 기다리세요</p>
            <p className={styles.tapHint}>터치하면 다시 시도</p>
          </>
        )}

        {/* 라운드 결과 */}
        {state.phase === 'result' && (
          <>
            <p className={styles.emoji}>{getGrade(state.time).emoji}</p>
            <p className={styles.reactionTime}>
              {state.time}<span className={styles.reactionUnit}>ms</span>
            </p>
            <p className={styles.subText}>다음 라운드 준비 중...</p>
          </>
        )}

        {/* 최종 결과 */}
        {state.phase === 'finished' && (
          <FinalResult
            times={state.times}
            best={best}
            onRetry={handleStart}
          />
        )}
      </div>

      {/* 진행 바 */}
      {state.phase !== 'idle' && state.phase !== 'finished' && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            /* round가 완료된 수 기준 */
            style={{ width: `${(times.length / TOTAL_ROUNDS) * 100}%` }}
            /* STYLE-EXCEPTION: dynamic progress width */
          />
        </div>
      )}
    </div>
  );
}

/* ── 최종 결과 서브 컴포넌트 ── */
function FinalResult({
  times,
  best,
  onRetry,
}: {
  times: number[];
  best: number | null;
  onRetry: () => void;
}) {
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const grade = getGrade(avg);
  const isNewRecord = best !== null && avg <= best;

  // 서버에 점수 저장 (반응속도는 낮을수록 좋지만, 랭킹은 점수가 높을수록 상위이므로 역수 변환)
  // → 간단히 avg 값을 그대로 저장하고 랭킹에서 오름차순으로 표시
  useEffect(() => {
    fetch('/api/games/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'reaction', score: avg }),
    }).catch(() => {});
  }, [avg]);

  return (
    <div className={styles.resultCard} onClick={(e) => e.stopPropagation()}>
      <h2 className={styles.resultTitle}>측정 완료!</h2>

      <div className={styles.resultAvg}>
        <span className={styles.resultAvgLabel}>평균 반응시간</span>
        <span className={styles.resultAvgValue}>{avg}ms</span>
      </div>

      <div>
        <p className={styles.resultGrade}>{grade.emoji}</p>
        <p className={styles.resultGradeLabel}>{grade.label}</p>
      </div>

      {isNewRecord && (
        <span className={styles.newRecord}>🏆 새로운 최고 기록!</span>
      )}

      {best !== null && !isNewRecord && (
        <div className={styles.bestRecord}>
          <span>🏆</span>
          <span>최고 기록: {best}ms</span>
        </div>
      )}

      <div className={styles.roundList}>
        {times.map((t, i) => (
          <div key={i} className={styles.roundItem}>
            <span className={styles.roundLabel}>{i + 1}회</span>
            <span className={styles.roundValue}>{t}ms</span>
          </div>
        ))}
      </div>

      <button type="button" className={styles.retryBtn} onClick={onRetry}>
        다시 하기
      </button>

      <GameRanking game="reaction" scoreLabel="평균" scoreUnit="ms" />
    </div>
  );
}
