'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, Vibrate, VibrateOff, Check, X as XIcon, Heart } from 'lucide-react';
import GameRanking from './GameRanking';
import { useGameFeedback } from './useGameFeedback';
import styles from './HalliGalli.module.css';

/* ── 타입 ── */
interface HalliGalliProps {
  onBack: () => void;
}

type Phase = 'idle' | 'playing' | 'gameover';
type FruitId = 0 | 1 | 2 | 3;

interface Card {
  id: number;            // 각 카드 유니크 키
  fruit: FruitId;
  count: number;         // 1~5
}

/* ── 상수 ── */
const FRUITS: { emoji: string; label: string }[] = [
  { emoji: '🍎', label: '사과' },
  { emoji: '🍌', label: '바나나' },
  { emoji: '🍇', label: '포도' },
  { emoji: '🍓', label: '딸기' },
];

const TARGET_TOTAL = 5;
const INITIAL_HP = 3;
const INITIAL_CARDS = 3;
const MAX_CARDS = 4;
const MAX_PER_CARD = 4; // 각 카드 과일 개수 상한 (합 5 확률↑, 화면 여유)

const SCORE_CORRECT = 10;
const SCORE_WRONG = -10;
const SCORE_MISSED = -5;

const INITIAL_INTERVAL = 3500; // ms — 3장이라 인지 시간 필요
const MIN_INTERVAL = 1800;
const INTERVAL_PER_SCORE = 10; // 1점당 10ms씩 빨라짐

const RESPONSE_WINDOW = 2500; // 3장 스캔 시간 고려
const NEXT_DEAL_DELAY = 250; // 판정 후 다음 덱까지 짧은 간격

const STORAGE_KEY = 'traindia-halli-best';

/* ── 유틸 ── */
function randInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function nextInterval(score: number): number {
  return Math.max(MIN_INTERVAL, INITIAL_INTERVAL - score * INTERVAL_PER_SCORE);
}

function nextCardCount(score: number): number {
  // 60점 이상: 4장 / 나머지: 3장
  if (score >= 60) return MAX_CARDS;
  return INITIAL_CARDS;
}

function loadBest(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const val = Number(raw);
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.round(score))));
  } catch {
    /* ignore */
  }
}

function sumFruit(cards: Card[], fruit: FruitId): number {
  return cards.reduce((acc, c) => (c.fruit === fruit ? acc + c.count : acc), 0);
}

function isWinningState(cards: Card[]): boolean {
  for (let i = 0; i < FRUITS.length; i++) {
    if (sumFruit(cards, i as FruitId) === TARGET_TOTAL) return true;
  }
  return false;
}

/* ── 컴포넌트 ── */
export default function HalliGalli({ onBack }: HalliGalliProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(INITIAL_HP);
  const [cards, setCards] = useState<Card[]>([]);
  const [best, setBest] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [flash, setFlash] = useState<'none' | 'good' | 'bad'>('none');

  const cardIdRef = useRef(0);
  const cardsRef = useRef<Card[]>([]);
  const scoreRef = useRef(0);
  const hpRef = useRef(INITIAL_HP);
  const phaseRef = useRef<Phase>('idle');
  const lastWinStateRef = useRef<boolean>(false);
  const winResolvedRef = useRef<boolean>(false); // 이미 판정한 덱인지
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const feedbackRef = useRef(feedback);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);

  useEffect(() => {
    setBest(loadBest());
    return () => {
      isUnmountedRef.current = true;
      if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const genCard = useCallback((): Card => {
    cardIdRef.current += 1;
    return {
      id: cardIdRef.current,
      fruit: randInt(FRUITS.length) as FruitId,
      count: 1 + randInt(MAX_PER_CARD),
    };
  }, []);

  const clearMissTimer = useCallback(() => {
    if (missTimerRef.current) {
      clearTimeout(missTimerRef.current);
      missTimerRef.current = null;
    }
  }, []);

  const triggerFlash = useCallback((kind: 'good' | 'bad') => {
    setFlash(kind);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) setFlash('none');
    }, 400);
  }, []);

  /* 게임오버 처리 */
  const endGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    phaseRef.current = 'gameover';
    setPhase('gameover');
    clearMissTimer();
    if (dealTimerRef.current) { clearTimeout(dealTimerRef.current); dealTimerRef.current = null; }

    const finalScore = scoreRef.current;
    feedbackRef.current('gameover');

    const prevBest = loadBest();
    if (finalScore > prevBest && finalScore > 0) {
      saveBest(finalScore);
      setBest(finalScore);
      setIsNewRecord(true);
      feedbackRef.current('record');
    }

    if (finalScore > 0) {
      fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'halli', score: finalScore }),
      }).catch(() => {});
    }
  }, [clearMissTimer]);

  const applyScoreDelta = useCallback((delta: number) => {
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
  }, []);

  const applyHpDelta = useCallback((delta: number) => {
    hpRef.current = Math.max(0, Math.min(INITIAL_HP, hpRef.current + delta));
    setHp(hpRef.current);
    if (hpRef.current <= 0) endGame();
  }, [endGame]);

  /* 새 카드 덱 생성 — 모든 덱에 판정 필요 */
  const dealNewHand = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    clearMissTimer();
    winResolvedRef.current = false;

    const n = nextCardCount(scoreRef.current);
    const hand: Card[] = [];
    for (let i = 0; i < n; i++) hand.push(genCard());
    cardsRef.current = hand;
    setCards(hand);

    const winning = isWinningState(hand);
    lastWinStateRef.current = winning;

    // 매 덱마다 놓침 타이머 (응답 윈도우 내 판정 필요)
    const responseBudget = Math.max(1000, Math.min(RESPONSE_WINDOW, nextInterval(scoreRef.current) - 200));
    missTimerRef.current = setTimeout(() => {
      if (isUnmountedRef.current || phaseRef.current !== 'playing') return;
      if (!winResolvedRef.current) {
        winResolvedRef.current = true;
        feedbackRef.current('fail');
        applyScoreDelta(SCORE_MISSED);
        applyHpDelta(-1);
        triggerFlash('bad');
        // 놓침 직후 바로 다음 덱
        if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
        dealTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) dealNewHand();
        }, NEXT_DEAL_DELAY);
      }
    }, responseBudget);
  }, [clearMissTimer, genCard, applyScoreDelta, applyHpDelta, triggerFlash]);

  /* 시작 */
  const handleStart = useCallback(() => {
    feedbackRef.current('button');
    scoreRef.current = 0;
    hpRef.current = INITIAL_HP;
    phaseRef.current = 'playing';
    cardIdRef.current = 0;
    lastWinStateRef.current = false;
    winResolvedRef.current = false;

    setScore(0);
    setHp(INITIAL_HP);
    setIsNewRecord(false);
    setFlash('none');
    setPhase('playing');

    // 첫 덱은 약간 딜레이 후 펼쳐짐
    dealTimerRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) dealNewHand();
    }, 400);
  }, [dealNewHand]);

  /* 판정: 맞음(true) / 아님(false) */
  const handleJudge = useCallback((userSaysYes: boolean) => {
    if (phaseRef.current !== 'playing') return;
    if (winResolvedRef.current) return;

    winResolvedRef.current = true;
    clearMissTimer();

    const winning = isWinningState(cardsRef.current);
    const correct = userSaysYes === winning;

    if (correct) {
      feedbackRef.current('success');
      applyScoreDelta(SCORE_CORRECT);
      triggerFlash('good');
    } else {
      feedbackRef.current('fail');
      applyScoreDelta(SCORE_WRONG);
      applyHpDelta(-1);
      triggerFlash('bad');
    }

    // 판정 후 즉시 다음 덱 (빠른 리듬)
    if (dealTimerRef.current) clearTimeout(dealTimerRef.current);
    dealTimerRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) dealNewHand();
    }, NEXT_DEAL_DELAY);
  }, [clearMissTimer, applyScoreDelta, applyHpDelta, triggerFlash, dealNewHand]);

  /* 키보드: ← / A = 맞음, → / D = 아님 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleJudge(true);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleJudge(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleJudge]);

  /* 렌더용 보조값 */
  const cardsToRender = useMemo(() => {
    // 슬롯 개수 고정 — 카드 나오기 전 빈 슬롯 표시
    const n = nextCardCount(score);
    const out: (Card | null)[] = [];
    for (let i = 0; i < n; i++) out.push(cards[i] ?? null);
    return out;
  }, [cards, score]);

  /* ── 렌더 ── */
  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>할리갈리</h1>

        {phase === 'playing' && (
          <div className={styles.statusBar}>
            <span className={styles.scoreLabel}>{score}점</span>
            <span className={styles.hpBar} aria-label={`생명 ${hp}개 남음`}>
              {Array.from({ length: INITIAL_HP }, (_, i) => (
                <Heart
                  key={i}
                  size={14}
                  className={i < hp ? styles.hpOn : styles.hpOff}
                  fill={i < hp ? 'currentColor' : 'none'}
                />
              ))}
            </span>
          </div>
        )}

        <button
          type="button"
          className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleSound}
          aria-pressed={!soundOn}
          aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleVibrate}
          aria-pressed={!vibrateOn}
          aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
        >
          {vibrateOn ? <Vibrate size={18} /> : <VibrateOff size={18} />}
        </button>
      </header>

      {/* 본문 */}
      <main className={`${styles.main} ${flash === 'good' ? styles.flashGood : ''} ${flash === 'bad' ? styles.flashBad : ''}`}>
        {/* 인트로 */}
        {phase === 'idle' && (
          <div className={styles.introCard}>
            <p className={styles.emoji}>🍎🍌🍇</p>
            <h2 className={styles.introTitle}>할리갈리</h2>
            <p className={styles.introDesc}>
              카드마다 같은 과일이 <strong>정확히 5개</strong>인지
              <br />매번 <strong>맞음</strong> / <strong>아님</strong>으로 판정!
            </p>
            <div className={styles.rules}>
              <p>✅ 정답: +{SCORE_CORRECT}점</p>
              <p>❌ 오답: {SCORE_WRONG}점 + 생명 −1</p>
              <p>⏰ 놓침: {SCORE_MISSED}점 + 생명 −1</p>
              <p>❤️ 생명 {INITIAL_HP}개 소진 시 게임오버</p>
            </div>
            {best > 0 && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best}점</span>
              </div>
            )}
            <button type="button" className={styles.startBtn} onClick={handleStart}>
              시작하기
            </button>
            <GameRanking game="halli" />
          </div>
        )}

        {/* 플레이 */}
        {phase === 'playing' && (
          <div className={styles.playArea}>
            <div
              className={styles.cardGrid}
              data-count={cardsToRender.length}
            >
              {cardsToRender.map((card, idx) => (
                <div
                  key={card ? card.id : `slot-${idx}`}
                  className={`${styles.card} ${card ? styles.cardFlipped : styles.cardEmpty}`}
                >
                  {card && (
                    <div className={styles.cardFruits}>
                      {Array.from({ length: card.count }, (_, i) => (
                        <span key={i} className={styles.fruit} aria-hidden="true">
                          {FRUITS[card.fruit].emoji}
                        </span>
                      ))}
                    </div>
                  )}
                  {card && (
                    <span className={styles.cardMeta}>
                      {FRUITS[card.fruit].label} {card.count}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.judgeRow}>
              <button
                type="button"
                className={`${styles.judgeBtn} ${styles.judgeYes}`}
                onClick={() => handleJudge(true)}
                aria-label="같은 과일 5개 맞음"
              >
                <Check size={32} strokeWidth={2.4} />
                <span className={styles.judgeLabel}>맞음</span>
              </button>
              <button
                type="button"
                className={`${styles.judgeBtn} ${styles.judgeNo}`}
                onClick={() => handleJudge(false)}
                aria-label="같은 과일 5개 아님"
              >
                <XIcon size={32} strokeWidth={2.4} />
                <span className={styles.judgeLabel}>아님</span>
              </button>
            </div>

            <p className={styles.tapHint}>
              같은 과일이 <strong>5개</strong>면 <strong>맞음</strong>, 아니면 <strong>아님</strong>
            </p>
          </div>
        )}

        {/* 게임오버 */}
        {phase === 'gameover' && (
          <div className={styles.resultCard}>
            <h2 className={styles.resultTitle}>게임 오버</h2>
            <p className={styles.bigScore}>
              {score}
              <span className={styles.unit}>점</span>
            </p>
            {isNewRecord && (
              <span className={styles.newRecord}>🏆 새로운 기록!</span>
            )}
            {!isNewRecord && best > 0 && (
              <div className={styles.bestRecord}>
                <span>🏆</span>
                <span>최고 기록: {best}점</span>
              </div>
            )}
            <button type="button" className={styles.retryBtn} onClick={handleStart}>
              다시 하기
            </button>
            <GameRanking game="halli" />
          </div>
        )}
      </main>
    </div>
  );
}
