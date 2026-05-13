'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, RotateCcw, Copy, CheckCircle2 } from 'lucide-react';
import { useMultiGame } from '../useMultiGame';
import { useGameFeedback } from '../../useGameFeedback';
import {
  emptyBoard, applyMove, flipsFromMove, validMovesMap, hasValidMove, countStones,
  SIZE, type Stone,
} from './reversiLogic';
import styles from './ReversiGame.module.css';

interface ReversiMove {
  type: 'place' | 'pass';
  x?: number;
  y?: number;
  stone: 1 | 2;
}

interface Props {
  roomCode: string;
  role: 'host' | 'guest';
  onLeave: () => void;
}

export default function ReversiGame({ roomCode, role, onLeave }: Props) {
  const myStone: Stone = role === 'host' ? 1 : 2; // host = 흑(선), guest = 백
  const [board, setBoard] = useState<Stone[][]>(emptyBoard);
  const [turn, setTurn] = useState<Stone>(1);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Stone>(0); // 0 = 무승부, 1/2 = 승자
  const [lastMove, setLastMove] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { feedback } = useGameFeedback();

  const { black, white } = useMemo(() => countStones(board), [board]);

  const checkGameEnd = useCallback((b: Stone[][], nextTurn: Stone): { over: boolean; winner: Stone; turn: Stone } => {
    if (hasValidMove(b, nextTurn)) return { over: false, winner: 0, turn: nextTurn };
    const other: Stone = nextTurn === 1 ? 2 : 1;
    if (hasValidMove(b, other)) return { over: false, winner: 0, turn: other };
    // 양쪽 다 둘 곳 없음 → 종료
    const c = countStones(b);
    const w: Stone = c.black > c.white ? 1 : c.white > c.black ? 2 : 0;
    return { over: true, winner: w, turn: nextTurn };
  }, []);

  const handleRemoteMove = useCallback((move: ReversiMove) => {
    setBoard((prev) => {
      let next = prev;
      if (move.type === 'place' && typeof move.x === 'number' && typeof move.y === 'number') {
        next = applyMove(prev, move.x, move.y, move.stone);
        setLastMove({ x: move.x, y: move.y });
      } else {
        // pass — 보드 변경 없음
        setLastMove(null);
      }
      const otherTurn: Stone = move.stone === 1 ? 2 : 1;
      const result = checkGameEnd(next, otherTurn);
      if (result.over) {
        setGameOver(true);
        setWinner(result.winner);
      } else {
        setTurn(result.turn);
      }
      return next;
    });
    feedback('tick');
  }, [feedback, checkGameEnd]);

  const handleRemoteRestart = useCallback(() => {
    setBoard(emptyBoard());
    setTurn(1);
    setGameOver(false);
    setWinner(0);
    setLastMove(null);
  }, []);

  const { connected, opponent, sendMove, sendRestart } = useMultiGame<ReversiMove>({
    roomCode,
    gameKind: 'reversi',
    role,
    onRemoteMove: handleRemoteMove,
    onRemoteRestart: handleRemoteRestart,
  });

  // 게임 종료 시 결과 저장 (host만)
  const postedRef = useRef(false);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  useEffect(() => {
    if (!gameOver) {
      postedRef.current = false;
      setRatingDelta(null);
      return;
    }
    if (postedRef.current) return;
    if (role !== 'host' || !opponent) return;
    if (winner === 0) return; // 무승부는 기록 X
    postedRef.current = true;
    fetch('/api/games/multi-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game: 'reversi',
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
  }, [gameOver, winner, role, opponent, myStone]);

  const myTurn = !gameOver && turn === myStone && !!opponent;
  const validMap = useMemo(() => validMovesMap(board, myStone), [board, myStone]);

  const placeStone = useCallback((x: number, y: number) => {
    if (!myTurn) return;
    if (flipsFromMove(board, x, y, myStone).length === 0) return;
    const next = applyMove(board, x, y, myStone);
    setBoard(next);
    setLastMove({ x, y });
    feedback('tick');
    sendMove({ type: 'place', x, y, stone: myStone });
    const otherTurn: Stone = myStone === 1 ? 2 : 1;
    const result = checkGameEnd(next, otherTurn);
    if (result.over) {
      setGameOver(true);
      setWinner(result.winner);
      feedback('record');
    } else {
      setTurn(result.turn);
    }
  }, [myTurn, board, myStone, feedback, sendMove, checkGameEnd]);

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
    const arr: { x: number; y: number; stone: Stone; isLast: boolean; isHint: boolean }[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        arr.push({
          x, y,
          stone: board[y][x],
          isLast: lastMove?.x === x && lastMove?.y === y,
          isHint: myTurn && validMap[y][x],
        });
      }
    }
    return arr;
  }, [board, lastMove, myTurn, validMap]);

  const statusText = (() => {
    if (gameOver) {
      const me = myStone === 1 ? black : white;
      const opp = myStone === 1 ? white : black;
      let label = `🤝 무승부 (${me}:${opp})`;
      if (winner === myStone) label = `🎉 승리! (${me}:${opp})`;
      else if (winner !== 0) label = `😢 패배 (${me}:${opp})`;
      if (role === 'host' && ratingDelta !== null && ratingDelta !== 0) {
        const sign = ratingDelta > 0 ? '+' : '';
        return `${label} (${sign}${ratingDelta})`;
      }
      return label;
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
        <div className={`${styles.playerChip} ${turn === 1 && !gameOver ? styles.playerChipActive : ''}`}>
          <span className={`${styles.stoneIcon} ${styles.stoneBlack}`} />
          <span className={styles.playerName}>
            {role === 'host' ? '나' : opponent?.name ?? '상대'}
          </span>
          <span className={styles.scoreNum}>{black}</span>
        </div>
        <span className={styles.statusText}>{statusText}</span>
        <div className={`${styles.playerChip} ${turn === 2 && !gameOver ? styles.playerChipActive : ''}`}>
          <span className={`${styles.stoneIcon} ${styles.stoneWhite}`} />
          <span className={styles.playerName}>
            {role === 'guest' ? '나' : opponent?.name ?? '상대'}
          </span>
          <span className={styles.scoreNum}>{white}</span>
        </div>
      </div>

      <div className={styles.boardOuter}>
        <div className={styles.board} role="grid" aria-label="오델로판">
          {cells.map(({ x, y, stone, isLast, isHint }) => (
            <button
              key={`${x}-${y}`}
              type="button"
              className={`${styles.cell} ${isHint ? styles.cellHint : ''}`}
              onClick={() => placeStone(x, y)}
              disabled={stone !== 0 || !myTurn || !isHint}
              aria-label={`${x + 1}열 ${y + 1}행`}
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
