'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, Volume2, VolumeX, Vibrate, VibrateOff } from 'lucide-react';
import GameRanking from './GameRanking';
import { useGameFeedback } from './useGameFeedback';
import styles from './MentalMath.module.css';

/* ── 타입 ── */
interface MentalMathProps {
  onBack: () => void;
}

type Phase = 'idle' | 'playing' | 'finished';

type Op = '+' | '-' | '×';

interface Question {
  a: number;
  b: number;
  op: Op;
  answer: number;
  choices: number[]; // length 3, shuffled
}

const STORAGE_KEY = 'traindia-mental-best';
const TOTAL_TIME = 60;
const CORRECT_SCORE = 10;
const WRONG_PENALTY = 5;

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

function saveBest(score: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(score)));
  } catch {
    /* ignore */
  }
}

/* ── 랜덤 정수 ── */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ── 배열 섞기 (Fisher-Yates) ── */
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── 문제 생성 ── */
function generateQuestion(prevAnswer: number | null): Question {
  let a = 0;
  let b = 0;
  let op: Op = '+';
  let answer = 0;
  let safety = 0;

  // 결과가 -50 ~ 200 범위가 될 때까지 재시도
  while (safety < 30) {
    safety++;
    const r = Math.random();
    if (r < 0.2) {
      // 곱셈 (한자리 × 두자리)
      op = '×';
      a = randInt(2, 9);
      b = randInt(10, 20);
      answer = a * b;
    } else if (r < 0.6) {
      op = '+';
      a = randInt(10, 99);
      b = randInt(10, 99);
      answer = a + b;
    } else {
      op = '-';
      a = randInt(10, 99);
      b = randInt(10, 99);
      answer = a - b;
    }

    if (answer >= -50 && answer <= 200 && answer !== prevAnswer) {
      break;
    }
  }

  // 오답 2개 생성 (정답 ±3~15, 중복 없이, 정답과도 다름)
  const distractors = new Set<number>();
  let tries = 0;
  while (distractors.size < 2 && tries < 40) {
    tries++;
    const delta = randInt(3, 15) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (candidate === answer) continue;
    if (distractors.has(candidate)) continue;
    distractors.add(candidate);
  }

  // 보장: 2개 채움
  let fallback = answer + 1;
  while (distractors.size < 2) {
    if (fallback !== answer && !distractors.has(fallback)) {
      distractors.add(fallback);
    }
    fallback++;
  }

  const choices = shuffle([answer, ...Array.from(distractors)]);

  return { a, b, op, answer, choices };
}

/* ── 서버 점수 제출 ── */
function submitScore(score: number): void {
  if (score <= 0) return;
  fetch('/api/games/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'mental', score }),
  }).catch(() => {
    /* 실패 무시 */
  });
}

/* ── 컴포넌트 ── */
export default function MentalMath({ onBack }: MentalMathProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [flash, setFlash] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const feedbackRef = useRef(feedback);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);

  // 최고 기록 초기 로드
  useEffect(() => {
    setBest(loadBest());
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  /* 게임 종료 */
  const finishGame = useCallback((finalScore: number, correct: number, wrong: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const currentBest = loadBest();
    const record = currentBest === null || finalScore > currentBest;
    if (record && finalScore > 0) {
      saveBest(finalScore);
      setBest(finalScore);
    }
    setIsNewRecord(record && finalScore > 0);
    feedbackRef.current(record && finalScore > 0 ? 'record' : 'success');
    setPhase('finished');
    submitScore(finalScore);
    // unused warning 방지: correct/wrong은 이미 state로 반영됨
    void correct; void wrong;
  }, []);

  /* 게임 시작 */
  const handleStart = useCallback(() => {
    feedbackRef.current('button');
    setScore(0);
    setTimeLeft(TOTAL_TIME);
    setCorrectCount(0);
    setWrongCount(0);
    setIsNewRecord(false);
    setQuestion(generateQuestion(null));
    setPhase('playing');

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // 타임아웃 — 함수형 업데이트 내에서 setState 금지이므로 다음 tick에 처리
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  /* 시간 0이 되면 종료 — state 기반 effect */
  useEffect(() => {
    if (phase === 'playing' && timeLeft <= 0) {
      finishGame(score, correctCount, wrongCount);
    }
  }, [phase, timeLeft, score, correctCount, wrongCount, finishGame]);

  /* 선택지 클릭 */
  const handleChoice = useCallback((choice: number) => {
    if (phase !== 'playing' || !question) return;

    if (choice === question.answer) {
      // 정답
      feedbackRef.current('success');
      setScore((s) => s + CORRECT_SCORE);
      setCorrectCount((c) => c + 1);
      setQuestion((prev) => generateQuestion(prev ? prev.answer : null));
    } else {
      // 오답
      feedbackRef.current('fail');
      setWrongCount((w) => w + 1);
      setTimeLeft((t) => Math.max(0, t - WRONG_PENALTY));
      setFlash(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlash(false);
      }, 400);
      setQuestion((prev) => generateQuestion(prev ? prev.answer : null));
    }
  }, [phase, question]);

  /* 키보드 1/2/3 */
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (!question) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = Number(e.key) - 1;
        const c = question.choices[idx];
        if (typeof c === 'number') {
          e.preventDefault();
          handleChoice(c);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, handleChoice]);

  const progressPct = Math.max(0, Math.min(100, (timeLeft / TOTAL_TIME) * 100));
  const timerDanger = timeLeft <= 10 && phase === 'playing';

  return (
    <div className={`${styles.wrap} ${flash ? styles.flashError : ''}`}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>암산 스프린트</h1>

        {phase === 'playing' && (
          <span className={styles.scoreDisplay}>
            <span className={styles.scoreNum}>{score}점</span>
            <span className={styles.scoreSep}>·</span>
            <span className={`${styles.scoreTime} ${timerDanger ? styles.scoreTimeDanger : ''}`}>
              {timeLeft}s
            </span>
          </span>
        )}

        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleSound}
          aria-label={soundOn ? '소리 끄기' : '소리 켜기'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleVibrate}
          aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
          aria-pressed={vibrateOn}
        >
          {vibrateOn ? <Vibrate size={18} strokeWidth={2} /> : <VibrateOff size={18} strokeWidth={2} />}
        </button>
      </header>

      <main className={styles.main}>
        {/* ── 시작 화면 ── */}
        {phase === 'idle' && (
          <div className={styles.introCard}>
            <p className={styles.emoji}>🧠</p>
            <h2 className={styles.introTitle}>암산 스프린트</h2>
            <p className={styles.introDesc}>
              60초 동안 최대한 많이 맞혀보세요!
            </p>
            <div className={styles.rules}>
              <div className={styles.ruleRow}>
                <span className={styles.ruleIcon}>✅</span>
                <span>정답: +{CORRECT_SCORE}점</span>
              </div>
              <div className={styles.ruleRow}>
                <span className={styles.ruleIcon}>❌</span>
                <span>오답: -{WRONG_PENALTY}초</span>
              </div>
            </div>
            {best !== null && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best}점</span>
              </div>
            )}
            <button type="button" className={`z-cta ${styles.startBtn}`} onClick={handleStart}>
              시작하기
            </button>
            <GameRanking game="mental" scoreLabel="점수" scoreUnit="점" />
          </div>
        )}

        {/* ── 플레이 중 ── */}
        {phase === 'playing' && question && (
          <div className={styles.quizArea}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                /* STYLE-EXCEPTION: dynamic progress width */
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className={`${styles.timer} ${timerDanger ? styles.timerDanger : ''}`}>
              {timeLeft}<span className={styles.timerUnit}>초</span>
            </div>

            <div className={styles.question} aria-live="polite">
              <span>{question.a}</span>
              <span className={styles.op}>{question.op}</span>
              <span>{question.b}</span>
              <span className={styles.op}>=</span>
              <span className={styles.qMark}>?</span>
            </div>

            <div className={styles.choices}>
              {question.choices.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  className={styles.choiceBtn}
                  onClick={() => handleChoice(c)}
                  aria-label={`${i + 1}번 보기 ${c}`}
                >
                  <span className={styles.choiceKey}>{i + 1}</span>
                  <span className={styles.choiceVal}>{c}</span>
                </button>
              ))}
            </div>

            <p className={styles.kbHint}>키보드 1 / 2 / 3 로도 선택</p>
          </div>
        )}

        {/* ── 결과 화면 ── */}
        {phase === 'finished' && (
          <div className={styles.resultCard}>
            <h2 className={styles.resultTitle}>완료!</h2>
            <p className={styles.resultScore}>
              {score}<span className={styles.resultScoreUnit}>점</span>
            </p>
            {isNewRecord && (
              <span className={styles.newRecord}>🏆 새로운 기록!</span>
            )}
            <div className={styles.resultStats}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>정답</span>
                <span className={styles.statValue}>{correctCount}개</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>오답</span>
                <span className={styles.statValue}>{wrongCount}개</span>
              </div>
            </div>
            {best !== null && !isNewRecord && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best}점</span>
              </div>
            )}
            <button type="button" className={`z-cta ${styles.retryBtn}`} onClick={handleStart}>
              다시 하기
            </button>
            <GameRanking game="mental" scoreLabel="점수" scoreUnit="점" />
          </div>
        )}
      </main>
    </div>
  );
}
