'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, RotateCcw, Copy, CheckCircle2 } from 'lucide-react';
import { useMultiGame } from '../useMultiGame';
import { useGameFeedback } from '../../useGameFeedback';
import styles from './OmokGame.module.css';

const SIZE = 15;
type Stone = 0 | 1 | 2; // 0=empty, 1=black, 2=white

interface OmokMove {
  type: 'place';
  x: number;
  y: number;
  stone: 1 | 2;
}

function emptyBoard(): Stone[][] {
  return Array.from({ length: SIZE }, () => Array<Stone>(SIZE).fill(0));
}

/** (x,y)에서 5목 검사 */
function checkWin(board: Stone[][], x: number, y: number, stone: Stone): boolean {
  if (stone === 0) return false;
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (let s = 1; s < 5; s++) {
      const nx = x + dx * s; const ny = y + dy * s;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== stone) break;
      count++;
    }
    for (let s = 1; s < 5; s++) {
      const nx = x - dx * s; const ny = y - dy * s;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== stone) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

interface Props {
  roomCode: string;
  role: 'host' | 'guest';
  onLeave: () => void;
}

export default function OmokGame({ roomCode, role, onLeave }: Props) {
  const myStone: Stone = role === 'host' ? 1 : 2; // host = 흑, guest = 백
  const [board, setBoard] = useState<Stone[][]>(emptyBoard);
  const [turn, setTurn] = useState<Stone>(1); // 흑 선
  const [winner, setWinner] = useState<Stone>(0);
  const [lastMove, setLastMove] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { feedback } = useGameFeedback();

  const handleRemoteMove = useCallback((move: OmokMove) => {
    if (move.type !== 'place') return;
    setBoard((prev) => {
      if (prev[move.y][move.x] !== 0) return prev;
      const next = prev.map((r) => r.slice()) as Stone[][];
      next[move.y][move.x] = move.stone;
      if (checkWin(next, move.x, move.y, move.stone)) {
        setWinner(move.stone);
      }
      return next;
    });
    setLastMove({ x: move.x, y: move.y });
    setTurn((prev) => (prev === 1 ? 2 : 1));
    feedback('tick');
  }, [feedback]);

  const handleRemoteRestart = useCallback(() => {
    setBoard(emptyBoard());
    setTurn(1);
    setWinner(0);
    setLastMove(null);
  }, []);

  const { connected, opponent, sendMove, sendRestart } = useMultiGame<OmokMove>({
    roomCode,
    gameKind: 'omok',
    role,
    onRemoteMove: handleRemoteMove,
    onRemoteRestart: handleRemoteRestart,
  });

  // 게임 종료 시 결과 저장 (host만 — 중복 방지)
  const postedWinnerRef = useRef<Stone>(0);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  useEffect(() => {
    if (winner === 0) {
      postedWinnerRef.current = 0;
      setRatingDelta(null);
      return;
    }
    if (postedWinnerRef.current === winner) return;
    if (role !== 'host' || !opponent) return;
    postedWinnerRef.current = winner;
    fetch('/api/games/multi-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game: 'omok',
        opponentSabun: opponent.sabun,
        opponentName: opponent.name,
        isWinner: winner === myStone,
      }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((res) => {
        if (res && typeof res.myDelta === 'number') setRatingDelta(res.myDelta);
      })
      .catch(() => {});
  }, [winner, role, opponent, myStone]);

  const myTurn = turn === myStone && winner === 0 && !!opponent;

  const placeStone = useCallback((x: number, y: number) => {
    if (!myTurn) return;
    if (board[y][x] !== 0) return;
    const stone = myStone;
    const next = board.map((r) => r.slice()) as Stone[][];
    next[y][x] = stone;
    setBoard(next);
    setLastMove({ x, y });
    feedback('tick');
    if (checkWin(next, x, y, stone)) {
      setWinner(stone);
      feedback('record');
    } else {
      setTurn(stone === 1 ? 2 : 1);
    }
    sendMove({ type: 'place', x, y, stone });
  }, [myTurn, board, myStone, feedback, sendMove]);

  const handleRestart = useCallback(() => {
    handleRemoteRestart();
    sendRestart();
    feedback('button');
  }, [handleRemoteRestart, sendRestart, feedback]);

  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [roomCode]);

  const cells = useMemo(() => {
    const arr: { x: number; y: number; stone: Stone; isLast: boolean }[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        arr.push({
          x, y,
          stone: board[y][x],
          isLast: lastMove?.x === x && lastMove?.y === y,
        });
      }
    }
    return arr;
  }, [board, lastMove]);

  const statusText = (() => {
    if (winner !== 0) {
      const base = winner === myStone ? '🎉 승리!' : '😢 패배';
      if (role === 'host' && ratingDelta !== null && ratingDelta !== 0) {
        const sign = ratingDelta > 0 ? '+' : '';
        return `${base} (${sign}${ratingDelta})`;
      }
      return base;
    }
    if (!connected) return '연결 중...';
    if (!opponent) return '상대방을 기다리는 중...';
    return myTurn ? '내 차례' : `${opponent.name}님 차례`;
  })();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onLeave} aria-label="나가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.roomLabel}>방 코드</span>
          <button type="button" className={styles.roomCode} onClick={handleCopy} aria-label="코드 복사">
            <span>{roomCode}</span>
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <button type="button" className={styles.iconBtn} onClick={handleRestart} aria-label="다시 시작">
          <RotateCcw size={18} />
        </button>
      </div>

      <div className={styles.statusRow}>
        <div className={`${styles.playerChip} ${turn === 1 ? styles.playerChipActive : ''}`}>
          <span className={`${styles.stoneIcon} ${styles.stoneBlack}`} />
          <span className={styles.playerName}>
            {role === 'host' ? '나' : opponent?.name ?? '상대'}
          </span>
        </div>
        <span className={styles.statusText}>{statusText}</span>
        <div className={`${styles.playerChip} ${turn === 2 ? styles.playerChipActive : ''}`}>
          <span className={`${styles.stoneIcon} ${styles.stoneWhite}`} />
          <span className={styles.playerName}>
            {role === 'guest' ? '나' : opponent?.name ?? '상대'}
          </span>
        </div>
      </div>

      <div className={styles.boardOuter}>
        <div className={styles.board} role="grid" aria-label="오목판">
          {/* 격자선 */}
          <svg className={styles.gridSvg} viewBox={`0 0 ${SIZE - 1} ${SIZE - 1}`} preserveAspectRatio="none" aria-hidden>
            {Array.from({ length: SIZE }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i} x2={SIZE - 1} y2={i} stroke="currentColor" strokeWidth="0.04" />
            ))}
            {Array.from({ length: SIZE }).map((_, i) => (
              <line key={`v${i}`} x1={i} y1="0" x2={i} y2={SIZE - 1} stroke="currentColor" strokeWidth="0.04" />
            ))}
            {/* 화점 */}
            {[3, 7, 11].flatMap((cy) => [3, 7, 11].map((cx) => (
              <circle key={`hs-${cx}-${cy}`} cx={cx} cy={cy} r="0.15" fill="currentColor" />
            )))}
          </svg>
          {/* 셀 (탭 영역 + 돌) */}
          {cells.map(({ x, y, stone, isLast }) => (
            <button
              key={`${x}-${y}`}
              type="button"
              className={styles.cell}
              onClick={() => placeStone(x, y)}
              disabled={stone !== 0 || !myTurn}
              aria-label={`${x + 1}열 ${y + 1}행`}
              data-x={x}
              data-y={y}
            >
              {stone !== 0 && (
                <span className={`${styles.stone} ${stone === 1 ? styles.stoneBlack : styles.stoneWhite} ${isLast ? styles.stoneLast : ''}`} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
