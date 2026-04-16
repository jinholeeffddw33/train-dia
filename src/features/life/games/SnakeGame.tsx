'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, Vibrate, VibrateOff } from 'lucide-react';
import GameRanking from './GameRanking';
import { useGameFeedback } from './useGameFeedback';
import styles from './SnakeGame.module.css';

/* ──────────────────────────────────────────────
   Types & Constants
   ────────────────────────────────────────────── */

interface SnakeGameProps {
  onBack: () => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
interface Pos { x: number; y: number }

const GRID = 15;
const INITIAL_SPEED = 220;
const MIN_SPEED = 160;
const SPEED_DECREASE = 6; // 사과 하나당 6ms 빨라짐
const SPEED_CAP_SCORE = 50; // 이 점수 이후 속도 증가 멈춤
const SWIPE_THRESHOLD = 30;
const LS_KEY = 'traindia-apple-best';

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};
const DIR_DELTA: Record<Direction, Pos> = {
  UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 },
};

const OBSTACLE_INTERVAL = 3; // 사과 3개마다 장애물 1개 추가
const MAX_OBSTACLES = 8;

/* ── Helpers ── */
function randomPos(occupied: Set<string>): Pos {
  let pos: Pos;
  do {
    pos = { x: 1 + Math.floor(Math.random() * (GRID - 2)), y: 1 + Math.floor(Math.random() * (GRID - 2)) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

function randomApple(snake: Pos[], obstacles: Pos[] = []): Pos {
  const occupied = new Set([...snake, ...obstacles].map((p) => `${p.x},${p.y}`));
  return randomPos(occupied);
}

function addObstacle(snake: Pos[], apple: Pos, obstacles: Pos[]): Pos {
  const occupied = new Set([...snake, ...obstacles, apple].map((p) => `${p.x},${p.y}`));
  return randomPos(occupied);
}

/** roundRect 폴백 — 구형 브라우저 호환 */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function loadBest(): number {
  try { return parseInt(localStorage.getItem(LS_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(score: number): void {
  try { localStorage.setItem(LS_KEY, String(score)); } catch { /* */ }
}

/* ──────────────────────────────────────────────
   Canvas 색상 (다크/라이트 대응)
   ────────────────────────────────────────────── */
function getColors() {
  const root = document.documentElement;
  const isLight = root.classList.contains('light');
  return {
    bg: isLight ? '#FFFFFF' : '#1E293B',
    gridLine: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    snakeHead: '#22C55E',
    snakeBody: (alpha: number) => `rgba(34, 197, 94, ${alpha})`,
    apple: '#EF4444',
    appleGlow: isLight ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.3)',
    obstacle: isLight ? '#94A3B8' : '#475569',
    obstacleBorder: isLight ? '#64748B' : '#64748B',
  };
}

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

type GameState = 'idle' | 'playing' | 'over';

export default function SnakeGame({ onBack }: SnakeGameProps) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef(300); // CSS pixel size

  // Game state refs (mutable, no re-render)
  const snakeRef = useRef<Pos[]>([{ x: 7, y: 7 }]);
  const appleRef = useRef<Pos>({ x: 11, y: 7 });
  const dirRef = useRef<Direction>('RIGHT');
  const dirQueueRef = useRef<Direction[]>([]);
  const scoreRef = useRef(0);
  const appleCountRef = useRef(0); // 먹은 사과 개수
  const obstaclesRef = useRef<Pos[]>([]);
  const speedRef = useRef(INITIAL_SPEED);
  const gameStateRef = useRef<GameState>('idle');
  const lastTickRef = useRef(0);
  const rafRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const feedbackRef = useRef(feedback);
  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);

  useEffect(() => { setBest(loadBest()); }, []);

  /* ── Canvas draw ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvasSizeRef.current;
    const cellSize = size / GRID;
    const colors = getColors();
    const snake = snakeRef.current;
    const apple = appleRef.current;

    // Background
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      const p = i * cellSize;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
    }

    // Obstacles
    const obstacles = obstaclesRef.current;
    for (const ob of obstacles) {
      ctx.fillStyle = colors.obstacle;
      ctx.strokeStyle = colors.obstacleBorder;
      ctx.lineWidth = 1;
      roundedRect(ctx, ob.x * cellSize + 1, ob.y * cellSize + 1, cellSize - 2, cellSize - 2, 3);
      ctx.strokeRect(ob.x * cellSize + 1, ob.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }

    // Apple glow
    ctx.fillStyle = colors.appleGlow;
    ctx.beginPath();
    ctx.arc(
      (apple.x + 0.5) * cellSize,
      (apple.y + 0.5) * cellSize,
      cellSize * 0.8, 0, Math.PI * 2,
    );
    ctx.fill();

    // Apple
    ctx.fillStyle = colors.apple;
    ctx.beginPath();
    ctx.arc(
      (apple.x + 0.5) * cellSize,
      (apple.y + 0.5) * cellSize,
      cellSize * 0.4, 0, Math.PI * 2,
    );
    ctx.fill();

    // 플레이어 블록 (1칸)
    const gap = 1;
    const r = Math.max(2, cellSize * 0.15);
    ctx.fillStyle = colors.snakeHead;
    ctx.shadowColor = colors.snakeHead;
    ctx.shadowBlur = 6;
    roundedRect(ctx,
      snake[0].x * cellSize + gap,
      snake[0].y * cellSize + gap,
      cellSize - gap * 2,
      cellSize - gap * 2,
      r + 1,
    );
    ctx.shadowBlur = 0;
  }, []);

  /* ── Game loop (requestAnimationFrame) ── */
  const gameLoop = useCallback((timestamp: number) => {
    if (gameStateRef.current !== 'playing') return;

    const elapsed = timestamp - lastTickRef.current;
    if (elapsed >= speedRef.current) {
      lastTickRef.current = timestamp;

      // Process direction queue
      if (dirQueueRef.current.length > 0) {
        const next = dirQueueRef.current.shift()!;
        if (OPPOSITE[next] !== dirRef.current) {
          dirRef.current = next;
        }
      }

      const snake = snakeRef.current;
      const apple = appleRef.current;
      const delta = DIR_DELTA[dirRef.current];
      const newHead: Pos = { x: snake[0].x + delta.x, y: snake[0].y + delta.y };

      // Wall collision
      if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
        endGame(); return;
      }

      // Obstacle collision
      if (obstaclesRef.current.some((p) => p.x === newHead.x && p.y === newHead.y)) {
        endGame(); return;
      }

      // 사과 체크
      const ateApple = newHead.x === apple.x && newHead.y === apple.y;

      // 블록 1개 고정 — 항상 위치만 이동
      const newSnake = [newHead];
      if (ateApple) {
        const newScore = scoreRef.current + 10;
        scoreRef.current = newScore;
        appleCountRef.current += 1;
        feedbackRef.current('tick');
        setScore(newScore);
        appleRef.current = randomApple(newSnake, obstaclesRef.current);
        // 50점까지만 속도 증가, 이후 고정
        const speedScore = Math.min(newScore, SPEED_CAP_SCORE);
        speedRef.current = Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(speedScore / 10) * SPEED_DECREASE);

        // 사과 3개마다 장애물 추가
        if (appleCountRef.current % OBSTACLE_INTERVAL === 0 && obstaclesRef.current.length < MAX_OBSTACLES) {
          const newOb = addObstacle(newSnake, appleRef.current, obstaclesRef.current);
          obstaclesRef.current = [...obstaclesRef.current, newOb];
        }
      }
      snakeRef.current = newSnake;
      draw(); // tick 때만 그리기 (매 프레임 X → 렉 방지)
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  const endGame = useCallback(() => {
    gameStateRef.current = 'over';
    setGameState('over');
    cancelAnimationFrame(rafRef.current);

    const s = scoreRef.current;
    const b = loadBest();
    if (s > b) {
      saveBest(s); setBest(s); setIsNewRecord(true);
      feedbackRef.current('record');
    } else {
      setIsNewRecord(false);
      feedbackRef.current('gameover');
    }

    // 서버에 점수 저장
    if (s > 0) {
      fetch('/api/games/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'snake', score: s }),
      }).catch(() => {});
    }
  }, []);

  const startGame = useCallback(() => {
    feedbackRef.current('button');
    const init = [{ x: 7, y: 7 }];
    snakeRef.current = init;
    obstaclesRef.current = [];
    appleCountRef.current = 0;
    appleRef.current = randomApple(init);
    dirRef.current = 'RIGHT';
    dirQueueRef.current = [];
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    lastTickRef.current = 0;
    gameStateRef.current = 'playing';

    setScore(0);
    setIsNewRecord(false);
    setGameState('playing');

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // Cleanup
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Draw idle/over state
  useEffect(() => {
    if (gameState !== 'playing') draw();
  }, [gameState, draw]);

  /* ── Direction change (queue-based) ── */
  const changeDirection = useCallback((newDir: Direction) => {
    // 큐에 최대 2개만 쌓기 (빠른 L자 회전 지원)
    const queue = dirQueueRef.current;
    const lastDir = queue.length > 0 ? queue[queue.length - 1] : dirRef.current;
    if (OPPOSITE[newDir] === lastDir) return;
    if (queue.length < 2) {
      queue.push(newDir);
    }
  }, []);

  /* ── Touch swipe ── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== 'playing') return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== 'playing' || !touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    changeDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'));
  }, [changeDirection]);

  /* ── Keyboard ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); startGame();
        }
        return;
      }
      const map: Record<string, Direction> = {
        ArrowUp: 'UP', w: 'UP', W: 'UP',
        ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
        ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
        ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); changeDirection(dir); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [changeDirection, startGame]);

  /* ── Canvas sizing ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssSize = Math.min(window.innerWidth - 32, 380);
      canvasSizeRef.current = cssSize;
      canvas.width = cssSize * dpr;
      canvas.height = cssSize * dpr;
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw, gameState]);

  /* ── Render: 시작 화면 (풀스크린) ── */
  if (gameState === 'idle') {
    return (
      <div className={styles.wrap} ref={wrapRef}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.headerTitle}>사과 먹기</h1>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
            onClick={toggleSound}
            aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
            onClick={toggleVibrate}
            aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
            aria-pressed={vibrateOn}
          >
            {vibrateOn ? <Vibrate size={18} strokeWidth={2} /> : <VibrateOff size={18} strokeWidth={2} />}
          </button>
        </header>
        <div className={styles.fullPage}>
          <span className={styles.bigEmoji}>🍎</span>
          <h2 className={styles.pageTitle}>사과 먹기</h2>
          <div className={styles.rules}>
            <p>🍎 사과를 먹으면 점수 +10</p>
            <p>💀 벽이나 장애물에 부딪히면 게임오버</p>
            <p>🧱 사과 3개마다 장애물이 하나씩 등장!</p>
            <p>🎮 방향 버튼이나 스와이프로 조종</p>
          </div>
          {best > 0 && <p className={styles.bestText}>최고 기록: <strong>{best}점</strong></p>}
          <button type="button" className={styles.startBtn} onClick={startGame}>시작하기</button>
          <GameRanking game="snake" />
        </div>
      </div>
    );
  }

  /* ── Render: 게임 오버 (풀스크린) ── */
  if (gameState === 'over') {
    return (
      <div className={styles.wrap} ref={wrapRef}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.headerTitle}>사과 먹기</h1>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
            onClick={toggleSound}
            aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
            onClick={toggleVibrate}
            aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
            aria-pressed={vibrateOn}
          >
            {vibrateOn ? <Vibrate size={18} strokeWidth={2} /> : <VibrateOff size={18} strokeWidth={2} />}
          </button>
        </header>
        <div className={styles.fullPage}>
          <h2 className={styles.pageTitle}>게임 오버</h2>
          <p className={styles.bigScore}>{score}<span className={styles.bigScoreUnit}>점</span></p>
          {isNewRecord && <p className={styles.newRecord}>🏆 새로운 기록!</p>}
          <p className={styles.bestText}>최고 기록: <strong>{best}점</strong></p>
          <button type="button" className={styles.startBtn} onClick={startGame}>다시 하기</button>
          <GameRanking game="snake" />
        </div>
      </div>
    );
  }

  /* ── Render: 플레이 중 ── */
  return (
    <div className={styles.wrap} ref={wrapRef}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>사과 먹기</h1>
        <div className={styles.scoreDisplay}>
          <span className={styles.scoreLabel}>점수</span>
          <span className={styles.scoreValue}>{score}</span>
        </div>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleSound}
          aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleVibrate}
          aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
          aria-pressed={vibrateOn}
        >
          {vibrateOn ? <Vibrate size={18} strokeWidth={2} /> : <VibrateOff size={18} strokeWidth={2} />}
        </button>
      </header>

      <div className={styles.gameArea} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>

        <div className={styles.dpad}>
          <div className={styles.dpadRow}>
            <button type="button" className={styles.dpadBtn} onPointerDown={() => changeDirection('UP')} aria-label="위">▲</button>
          </div>
          <div className={styles.dpadRow}>
            <button type="button" className={styles.dpadBtn} onPointerDown={() => changeDirection('LEFT')} aria-label="왼쪽">◀</button>
            <div className={styles.dpadCenter} />
            <button type="button" className={styles.dpadBtn} onPointerDown={() => changeDirection('RIGHT')} aria-label="오른쪽">▶</button>
          </div>
          <div className={styles.dpadRow}>
            <button type="button" className={styles.dpadBtn} onPointerDown={() => changeDirection('DOWN')} aria-label="아래">▼</button>
          </div>
        </div>
      </div>
    </div>
  );
}
