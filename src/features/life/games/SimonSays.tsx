'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, VolumeX, Vibrate, VibrateOff } from 'lucide-react';
import GameRanking from './GameRanking';
import { useGameFeedback } from './useGameFeedback';
import styles from './SimonSays.module.css';

/* ── 타입 ── */
interface SimonSaysProps {
  onBack: () => void;
}

type Phase = 'idle' | 'showing' | 'input' | 'gameover';

/* ── 상수 ── */
const MAX_ROUND = 30;
const STORAGE_KEY = 'traindia-simon-best';
const PAD_COUNT = 4;

/* ── 시퀀스 표시 속도 ── */
function getTiming(round: number): { lit: number; gap: number } {
  if (round <= 5) return { lit: 600, gap: 200 };
  if (round <= 10) return { lit: 500, gap: 150 };
  return { lit: 400, gap: 100 };
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

function saveBest(round: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(round)));
  } catch {
    /* ignore */
  }
}

/* ── 패드 컬러 클래스 매핑 ── */
const PAD_CLASSES = [
  styles.padRed,
  styles.padBlue,
  styles.padGreen,
  styles.padAmber,
];

const PAD_LABELS = ['빨강', '파랑', '초록', '노랑'];

/* ── 컴포넌트 ── */
export default function SimonSays({ onBack }: SimonSaysProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(0);
  const [userStep, setUserStep] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const seqRef = useRef<number[]>([]);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const isUnmountedRef = useRef(false);

  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  /* ── 초기 로드 + 언마운트 cleanup ── */
  useEffect(() => {
    setBest(loadBest());
    return () => {
      isUnmountedRef.current = true;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  /* ── 타이머 헬퍼 ── */
  const waitMs = useCallback((ms: number): Promise<void> => {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        timersRef.current = timersRef.current.filter((x) => x !== t);
        resolve();
      }, ms);
      timersRef.current.push(t);
    });
  }, []);

  /* ── 컴퓨터 시퀀스 표시 ── */
  const playSequence = useCallback(
    async (seq: number[], roundNum: number) => {
      const { lit, gap } = getTiming(roundNum);
      // 시퀀스 시작 전 짧은 준비 시간
      await waitMs(500);
      if (isUnmountedRef.current) return;

      for (let i = 0; i < seq.length; i++) {
        if (isUnmountedRef.current) return;
        setActivePad(seq[i]);
        feedbackRef.current('tick');
        await waitMs(lit);
        if (isUnmountedRef.current) return;
        setActivePad(null);
        await waitMs(gap);
      }

      if (isUnmountedRef.current) return;
      setPhase('input');
      setUserStep(0);
    },
    [waitMs]
  );

  /* ── 다음 라운드 시작 ── */
  const startNextRound = useCallback(
    (nextRound: number) => {
      const newColor = Math.floor(Math.random() * PAD_COUNT);
      seqRef.current = [...seqRef.current, newColor];
      setRound(nextRound);
      setPhase('showing');
      setUserStep(0);
      setActivePad(null);
      void playSequence(seqRef.current, nextRound);
    },
    [playSequence]
  );

  /* ── 게임 시작 ── */
  const handleStart = useCallback(() => {
    feedbackRef.current('button');
    seqRef.current = [];
    setIsNewRecord(false);
    setRound(0);
    setUserStep(0);
    setActivePad(null);
    setFinalScore(0);
    // 첫 라운드
    startNextRound(1);
  }, [startNextRound]);

  /* ── 게임오버 처리 ── */
  const endGame = useCallback(
    (finalRound: number) => {
      feedbackRef.current('gameover');
      setFinalScore(finalRound);
      setPhase('gameover');
      setActivePad(null);

      // 로컬 최고 기록 갱신
      const currentBest = loadBest();
      const isRecord = currentBest === null || finalRound > currentBest;
      if (isRecord && finalRound > 0) {
        saveBest(finalRound);
        setBest(finalRound);
        setIsNewRecord(true);
        feedbackRef.current('record');
      }

      // 서버 제출 (점수 > 0)
      if (finalRound > 0) {
        fetch('/api/games/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: 'simon', score: finalRound }),
        }).catch(() => {});
      }
    },
    []
  );

  /* ── 유저 패드 입력 ── */
  const handlePadPress = useCallback(
    (color: number) => {
      if (phase !== 'input') return;

      const expected = seqRef.current[userStep];
      const nextStep = userStep + 1;

      // 짧은 빛남 피드백
      setActivePad(color);
      const litTimer = setTimeout(() => {
        if (isUnmountedRef.current) return;
        setActivePad(null);
        timersRef.current = timersRef.current.filter((x) => x !== litTimer);
      }, 300);
      timersRef.current.push(litTimer);

      if (color !== expected) {
        // 오답 → 게임오버 (이전 라운드까지 클리어한 것으로 기록: round - 1)
        endGame(Math.max(0, round - 1));
        return;
      }

      // 정답
      feedbackRef.current('tick');

      if (nextStep >= seqRef.current.length) {
        // 라운드 클리어
        feedbackRef.current('success');

        if (round >= MAX_ROUND) {
          // 최대 라운드 달성 → 승리 처리
          endGame(round);
          return;
        }

        // 다음 라운드 준비 — 0.8초 대기 후 진행
        const waitTimer = setTimeout(() => {
          if (isUnmountedRef.current) return;
          timersRef.current = timersRef.current.filter((x) => x !== waitTimer);
          startNextRound(round + 1);
        }, 800);
        timersRef.current.push(waitTimer);
      } else {
        setUserStep(nextStep);
      }
    },
    [phase, userStep, round, endGame, startNextRound]
  );

  /* ── 키보드 지원 (1/2/3/4) ── */
  useEffect(() => {
    if (phase !== 'input') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        const idx = Number(e.key) - 1;
        handlePadPress(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [phase, handlePadPress]);

  /* ── 렌더링 ── */
  const showingOrInput = phase === 'showing' || phase === 'input';
  const padsDisabled = phase !== 'input';
  const currentSeqLength = seqRef.current.length;

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="뒤로가기"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>색깔 따라하기</h1>
        {showingOrInput && (
          <span className={styles.roundBadge}>라운드 {round}</span>
        )}
        <button
          type="button"
          className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleSound}
          aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
          aria-pressed={soundOn}
        >
          {soundOn ? (
            <Volume2 size={18} strokeWidth={2} />
          ) : (
            <VolumeX size={18} strokeWidth={2} />
          )}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleVibrate}
          aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
          aria-pressed={vibrateOn}
        >
          {vibrateOn ? (
            <Vibrate size={18} strokeWidth={2} />
          ) : (
            <VibrateOff size={18} strokeWidth={2} />
          )}
        </button>
      </header>

      <main className={styles.main}>
        {/* ── 시작 화면 ── */}
        {phase === 'idle' && (
          <div className={styles.introCard}>
            <p className={styles.emoji}>🎨</p>
            <h2 className={styles.introTitle}>색깔 따라하기</h2>
            <p className={styles.introDesc}>
              컴퓨터가 보여주는 색깔 순서를 똑같이 눌러주세요!
              <br />
              라운드가 올라갈수록 순서가 길어집니다.
            </p>
            <div className={styles.rules}>
              <span>🔴 🔵 🟢 🟡 4가지 색</span>
              <span>✅ 맞히면 라운드 +1</span>
              <span>❌ 틀리면 게임오버</span>
            </div>
            {best !== null && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best} 라운드</span>
              </div>
            )}
            <button type="button" className={`z-cta ${styles.startBtn}`} onClick={handleStart}>
              시작하기
            </button>
            <GameRanking game="simon" scoreLabel="라운드" scoreUnit="라운드" />
          </div>
        )}

        {/* ── 게임 진행 ── */}
        {showingOrInput && (
          <div className={styles.gameArea}>
            <p className={styles.statusText}>
              {phase === 'showing' ? '잘 보세요...' : '따라하세요!'}
            </p>
            <div className={styles.padsGrid}>
              {[0, 1, 2, 3].map((color) => {
                const isLit = activePad === color;
                const classes = [styles.pad, PAD_CLASSES[color]];
                if (isLit) classes.push(styles.padLit);
                return (
                  <button
                    key={color}
                    type="button"
                    className={classes.join(' ')}
                    onClick={() => handlePadPress(color)}
                    disabled={padsDisabled}
                    aria-label={PAD_LABELS[color]}
                  />
                );
              })}
            </div>
            <p className={styles.progress}>
              {phase === 'input'
                ? `순서 중 ${userStep}/${currentSeqLength}`
                : `\u00A0`}
            </p>
          </div>
        )}

        {/* ── 게임오버 ── */}
        {phase === 'gameover' && (
          <div className={styles.resultCard}>
            <h2 className={styles.resultTitle}>게임 오버</h2>
            <p className={styles.bigScore}>
              {finalScore}
              <span className={styles.unit}>라운드</span>
            </p>
            <p className={styles.resultSubtext}>클리어한 라운드</p>
            {isNewRecord && (
              <span className={styles.newRecord}>🏆 새로운 기록!</span>
            )}
            {!isNewRecord && best !== null && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best} 라운드</span>
              </div>
            )}
            <button type="button" className={`z-cta ${styles.retryBtn}`} onClick={handleStart}>
              다시 하기
            </button>
            <GameRanking game="simon" scoreLabel="라운드" scoreUnit="라운드" />
          </div>
        )}
      </main>
    </div>
  );
}
