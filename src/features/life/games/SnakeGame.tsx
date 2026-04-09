'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import styles from './SnakeGame.module.css';

/* ──────────────────────────────────────────────
   Types & Constants
   ────────────────────────────────────────────── */

interface SnakeGameProps {
  onBack: () => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Pos {
  x: number;
  y: number;
}

const GRID = 20;
const INITIAL_SPEED = 200;
const MIN_SPEED = 100;
const SPEED_STEP = 10; // 10점마다 SPEED_STEP만큼 빨라짐
const SWIPE_THRESHOLD = 30;
const LS_KEY = 'traindia-snake-best';

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const DIR_DELTA: Record<Direction, Pos> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function randomApple(snake: Pos[]): Pos {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  let pos: Pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

function loadBest(): number {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(LS_KEY, String(score));
  } catch {
    /* ignore */
  }
}

/** 뱀 몸통 opacity class — 머리 가까울수록 진하게 */
function bodyOpacityClass(index: number, total: number): string {
  if (total <= 1) return styles.bodyOpacity100;
  const ratio = index / (total - 1);
  if (ratio < 0.15) return styles.bodyOpacity100;
  if (ratio < 0.3) return styles.bodyOpacity90;
  if (ratio < 0.45) return styles.bodyOpacity80;
  if (ratio < 0.6) return styles.bodyOpacity70;
  if (ratio < 0.75) return styles.bodyOpacity60;
  if (ratio < 0.9) return styles.bodyOpacity50;
  return styles.bodyOpacity40;
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

type GameState = 'idle' | 'playing' | 'over';

export default function SnakeGame({ onBack }: SnakeGameProps) {
  /* ── State ── */
  const [gameState, setGameState] = useState<GameState>('idle');
  const [snake, setSnake] = useState<Pos[]>([{ x: 10, y: 10 }]);
  const [apple, setApple] = useState<Pos>({ x: 15, y: 10 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  /* ── Refs (mutable game state for interval) ── */
  const dirRef = useRef<Direction>('RIGHT');
  const nextDirRef = useRef<Direction>('RIGHT');
  const snakeRef = useRef<Pos[]>(snake);
  const appleRef = useRef<Pos>(apple);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  snakeRef.current = snake;
  appleRef.current = apple;
  scoreRef.current = score;
  gameStateRef.current = gameState;

  // Load best score once
  useEffect(() => {
    setBest(loadBest());
  }, []);

  /* ── Game Tick ── */
  const tick = useCallback(() => {
    const currentSnake = snakeRef.current;
    const currentApple = appleRef.current;

    // Apply queued direction
    dirRef.current = nextDirRef.current;

    const head = currentSnake[0];
    const delta = DIR_DELTA[dirRef.current];
    const newHead: Pos = {
      x: head.x + delta.x,
      y: head.y + delta.y,
    };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
      endGame();
      return;
    }

    // Self collision (skip tail since it will move)
    const ateApple = newHead.x === currentApple.x && newHead.y === currentApple.y;
    const bodyToCheck = ateApple ? currentSnake : currentSnake.slice(0, -1);
    if (bodyToCheck.some((p) => p.x === newHead.x && p.y === newHead.y)) {
      endGame();
      return;
    }

    // Move
    const newSnake = [newHead, ...currentSnake];
    if (ateApple) {
      const newScore = scoreRef.current + 10;
      const newApple = randomApple(newSnake);
      setScore(newScore);
      setApple(newApple);
      appleRef.current = newApple;
      scoreRef.current = newScore;

      // Speed up every 10 points
      const newSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(newScore / 10) * SPEED_STEP);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(tick, newSpeed);
    } else {
      newSnake.pop();
    }
    setSnake(newSnake);
    snakeRef.current = newSnake;
  }, []);

  const endGame = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGameState('over');
    gameStateRef.current = 'over';

    const currentScore = scoreRef.current;
    const currentBest = loadBest();
    if (currentScore > currentBest) {
      saveBest(currentScore);
      setBest(currentScore);
      setIsNewRecord(true);
    } else {
      setIsNewRecord(false);
    }
  }, []);

  const startGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    const initialApple = randomApple(initialSnake);

    setSnake(initialSnake);
    setApple(initialApple);
    setScore(0);
    setIsNewRecord(false);
    setGameState('playing');

    snakeRef.current = initialSnake;
    appleRef.current = initialApple;
    scoreRef.current = 0;
    dirRef.current = 'RIGHT';
    nextDirRef.current = 'RIGHT';
    gameStateRef.current = 'playing';

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(tick, INITIAL_SPEED);
  }, [tick]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  /* ── Direction change with opposite guard ── */
  const changeDirection = useCallback((newDir: Direction) => {
    if (OPPOSITE[newDir] === dirRef.current) return;
    nextDirRef.current = newDir;
  }, []);

  /* ── Touch handlers ── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== 'playing' || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) return;

    if (absDx > absDy) {
      changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDirection(dy > 0 ? 'DOWN' : 'UP');
    }
  }, [changeDirection]);

  /* ── Keyboard support ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (gameStateRef.current === 'idle' || gameStateRef.current === 'over') {
            startGame();
          }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, startGame]);

  /* ── Build cell map for O(1) lookup ── */
  const snakeSet = new Map<string, number>();
  snake.forEach((p, i) => {
    snakeSet.set(`${p.x},${p.y}`, i);
  });
  const appleKey = `${apple.x},${apple.y}`;

  /* ── Render ── */
  const cells: ReactNode[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = `${x},${y}`;
      const snakeIdx = snakeSet.get(key);
      const isApple = key === appleKey;

      let className = styles.cell;
      if (snakeIdx === 0) {
        className = `${styles.cell} ${styles.cellSnakeHead}`;
      } else if (snakeIdx !== undefined) {
        className = `${styles.cell} ${styles.cellSnakeBody} ${bodyOpacityClass(snakeIdx, snake.length)}`;
      } else if (isApple) {
        className = `${styles.cell} ${styles.cellApple}`;
      }

      cells.push(
        <div key={key} className={className}>
          {isApple ? '🍎' : null}
        </div>
      );
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>스네이크</h1>
        {gameState === 'playing' && (
          <div className={styles.scoreDisplay}>
            <span className={styles.scoreLabel}>점수</span>
            <span className={styles.scoreValue}>{score}</span>
          </div>
        )}
      </header>

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className={styles.gameArea}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.grid}>
          {cells}

          {/* Start Screen Overlay */}
          {gameState === 'idle' && (
            <div className={styles.startOverlay}>
              <span className={styles.startEmoji}>🐍</span>
              <h2 className={styles.startTitle}>스네이크</h2>
              <p className={styles.startHint}>
                스와이프로 방향 전환<br />
                사과를 먹어 점수를 올리세요
              </p>
              {best > 0 && (
                <p className={styles.startBest}>
                  최고 기록: <span className={styles.startBestValue}>{best}점</span>
                </p>
              )}
              <button type="button" className={styles.tapHint} onClick={startGame}>
                탭하여 시작
              </button>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === 'over' && (
            <div className={styles.gameOverOverlay}>
              <h2 className={styles.gameOverTitle}>게임 오버</h2>
              <p className={styles.gameOverScore}>
                점수: <span className={styles.gameOverScoreNum}>{score}</span>
              </p>
              {isNewRecord && (
                <p className={styles.newRecord}>🏆 새로운 기록!</p>
              )}
              <p className={styles.gameOverBest}>
                최고 기록: <span className={styles.gameOverBestValue}>{best}점</span>
              </p>
              <button type="button" className={styles.retryBtn} onClick={startGame}>
                다시 하기
              </button>
            </div>
          )}
        </div>

        {/* D-Pad — 모바일 방향 버튼 */}
        {gameState === 'playing' && (
          <div className={styles.dpad}>
            <div className={styles.dpadRow}>
              <button type="button" className={styles.dpadBtn} onClick={() => changeDirection('UP')} aria-label="위">▲</button>
            </div>
            <div className={styles.dpadRow}>
              <button type="button" className={styles.dpadBtn} onClick={() => changeDirection('LEFT')} aria-label="왼쪽">◀</button>
              <div className={styles.dpadCenter} />
              <button type="button" className={styles.dpadBtn} onClick={() => changeDirection('RIGHT')} aria-label="오른쪽">▶</button>
            </div>
            <div className={styles.dpadRow}>
              <button type="button" className={styles.dpadBtn} onClick={() => changeDirection('DOWN')} aria-label="아래">▼</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
