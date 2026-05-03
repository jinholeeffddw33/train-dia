'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, RotateCcw, Copy, CheckCircle2, Dice5, Home } from 'lucide-react';
import { useMultiGame } from '../useMultiGame';
import { useGameFeedback } from '../../useGameFeedback';
import {
  initialState,
  applyMove,
  throwYut,
  YUT_VALUE,
  YUT_EXTRA,
  TRACK_SIZE,
  HOME_POS,
  GOAL_POS,
  PIECES_PER_PLAYER,
  type YutnoriState,
  type YutResult,
  type Player,
} from './yutnoriLogic';
import styles from './YutnoriGame.module.css';

type YutnoriMove =
  | { type: 'throw'; result: YutResult }
  | { type: 'use'; pieceIdx: number; result: YutResult }
  | { type: 'pass' };

interface Props {
  roomCode: string;
  role: 'host' | 'guest';
  onLeave: () => void;
}

export default function YutnoriGame({ roomCode, role, onLeave }: Props) {
  const myPlayer: Player = role === 'host' ? 0 : 1;
  const [state, setState] = useState<YutnoriState>(initialState);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [selectedThrow, setSelectedThrow] = useState<number | null>(null);
  const [lastThrow, setLastThrow] = useState<YutResult | null>(null);
  const [copied, setCopied] = useState(false);
  const { feedback } = useGameFeedback();

  const handleRemoteMove = useCallback((move: YutnoriMove) => {
    setState((prev) => {
      if (move.type === 'throw') {
        return { ...prev, pendingThrows: [...prev.pendingThrows, move.result] };
      }
      if (move.type === 'use') {
        const value = YUT_VALUE[move.result];
        const res = applyMove(prev, move.pieceIdx, value);
        if (!res) return prev;
        // 사용한 결과 제거 (첫 번째 매칭)
        const idx = prev.pendingThrows.indexOf(move.result);
        const newPending = idx >= 0
          ? [...prev.pendingThrows.slice(0, idx), ...prev.pendingThrows.slice(idx + 1)]
          : prev.pendingThrows;
        let newTurn = res.state.turn;
        const extra = YUT_EXTRA[move.result];
        // 다음 차례 결정: 보류 결과가 더 있으면 같은 차례, 없고 잡기/extra 없으면 turn 교체
        if (newPending.length === 0 && !extra && !res.captured) {
          newTurn = (res.state.turn === 0 ? 1 : 0) as Player;
        }
        return { ...res.state, pendingThrows: newPending, turn: newTurn };
      }
      if (move.type === 'pass') {
        return { ...prev, pendingThrows: [], turn: (prev.turn === 0 ? 1 : 0) as Player };
      }
      return prev;
    });
    setSelectedPiece(null);
    setSelectedThrow(null);
    if (move.type === 'throw') setLastThrow(move.result);
  }, []);

  const handleRemoteRestart = useCallback(() => {
    setState(initialState());
    setSelectedPiece(null);
    setSelectedThrow(null);
    setLastThrow(null);
  }, []);

  const { connected, opponent, sendMove, sendRestart } = useMultiGame<YutnoriMove>({
    roomCode,
    gameKind: 'yutnori',
    role,
    onRemoteMove: handleRemoteMove,
    onRemoteRestart: handleRemoteRestart,
  });

  const myTurn = state.turn === myPlayer && state.winner === null && !!opponent;

  const handleThrow = useCallback(() => {
    if (!myTurn) return;
    const result = throwYut();
    setLastThrow(result);
    feedback('button');
    setState((prev) => ({ ...prev, pendingThrows: [...prev.pendingThrows, result] }));
    sendMove({ type: 'throw', result });
  }, [myTurn, feedback, sendMove]);

  const handleUseThrow = useCallback((pieceIdx: number, throwIdx: number) => {
    const result = state.pendingThrows[throwIdx];
    if (!result) return;
    const value = YUT_VALUE[result];
    const res = applyMove(state, pieceIdx, value);
    if (!res) {
      feedback('fail');
      return;
    }
    feedback(res.captured ? 'success' : 'tick');
    const newPending = [
      ...state.pendingThrows.slice(0, throwIdx),
      ...state.pendingThrows.slice(throwIdx + 1),
    ];
    const extra = YUT_EXTRA[result];
    let newTurn = res.state.turn;
    if (newPending.length === 0 && !extra && !res.captured) {
      newTurn = (res.state.turn === 0 ? 1 : 0) as Player;
    }
    setState({ ...res.state, pendingThrows: newPending, turn: newTurn });
    setSelectedPiece(null);
    setSelectedThrow(null);
    sendMove({ type: 'use', pieceIdx, result });
    if (res.state.winner !== null) {
      feedback('record');
    }
  }, [state, feedback, sendMove]);

  const handleRestart = useCallback(() => {
    handleRemoteRestart();
    sendRestart();
    feedback('button');
  }, [handleRemoteRestart, sendRestart, feedback]);

  const handlePass = useCallback(() => {
    if (!myTurn || state.pendingThrows.length === 0) return;
    setState((prev) => ({ ...prev, pendingThrows: [], turn: (prev.turn === 0 ? 1 : 0) as Player }));
    setSelectedPiece(null);
    setSelectedThrow(null);
    sendMove({ type: 'pass' });
    feedback('fail');
  }, [myTurn, state.pendingThrows.length, sendMove, feedback]);

  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [roomCode]);

  // ── 트랙 위 말 그룹화 (위치별) ──
  const piecesByPos = new Map<number, typeof state.pieces[number][]>();
  for (const p of state.pieces) {
    if (p.stack.length > 0 || (state.pieces.find((q) => q.stack.includes(p.id)) === undefined)) {
      // leader이거나 단독 말만 표시 (stack에 포함된 말은 leader 위치에서 함께 표시)
      const arr = piecesByPos.get(p.pos) ?? [];
      arr.push(p);
      piecesByPos.set(p.pos, arr);
    }
  }

  const trackSpots = Array.from({ length: TRACK_SIZE }, (_, i) => i);

  const myPieces = state.pieces.filter((p) => p.player === myPlayer);
  const homePieces = myPieces.filter((p) => p.pos === HOME_POS);
  const goalPiecesMine = myPieces.filter((p) => p.pos === GOAL_POS).length;
  const goalPiecesOpp = state.pieces.filter((p) => p.player !== myPlayer && p.pos === GOAL_POS).length;

  const statusText = (() => {
    if (state.winner !== null) {
      return state.winner === myPlayer ? '🎉 승리!' : '😢 패배';
    }
    if (!connected) return '연결 중...';
    if (!opponent) return '상대방을 기다리는 중...';
    if (myTurn) {
      if (state.pendingThrows.length === 0) return '윷을 던지세요';
      return '말을 골라 이동하세요';
    }
    return `${opponent.name}님 차례`;
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

      <div className={styles.scoreRow}>
        <div className={`${styles.scoreChip} ${myTurn ? styles.scoreChipActive : ''}`}>
          <span className={`${styles.pieceDot} ${styles.player0}`} />
          <span>{role === 'host' ? '나' : opponent?.name ?? '상대'}</span>
          <span className={styles.scoreNum}>{role === 'host' ? goalPiecesMine : goalPiecesOpp}/{PIECES_PER_PLAYER}</span>
        </div>
        <span className={styles.statusText}>{statusText}</span>
        <div className={`${styles.scoreChip} ${state.turn === 1 && state.winner === null ? styles.scoreChipActive : ''}`}>
          <span className={`${styles.pieceDot} ${styles.player1}`} />
          <span>{role === 'guest' ? '나' : opponent?.name ?? '상대'}</span>
          <span className={styles.scoreNum}>{role === 'guest' ? goalPiecesMine : goalPiecesOpp}/{PIECES_PER_PLAYER}</span>
        </div>
      </div>

      {/* 트랙 — 2행 스네이크 레이아웃 (0~9 위, 10~19 아래 역방향) */}
      <div className={styles.trackOuter}>
        <div className={styles.track}>
          <div className={styles.trackRow}>
            <div className={`${styles.spot} ${styles.startSpot}`} aria-label="출발">
              <Home size={18} />
              <span className={styles.spotLabel}>출발</span>
              {homePieces.length > 0 && (
                <div className={styles.pieceCluster}>
                  {homePieces.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.piece} ${p.player === 0 ? styles.player0 : styles.player1} ${selectedPiece === p.id ? styles.pieceSelected : ''}`}
                      onClick={() => myTurn && p.player === myPlayer && setSelectedPiece(p.id)}
                      disabled={!myTurn || p.player !== myPlayer}
                      aria-label={`내 말 ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
            {trackSpots.slice(0, 10).map((i) => (
              <Spot
                key={i}
                idx={i}
                pieces={piecesByPos.get(i) ?? []}
                selectedPiece={selectedPiece}
                myPlayer={myPlayer}
                myTurn={myTurn}
                onSelectPiece={setSelectedPiece}
              />
            ))}
          </div>
          <div className={styles.trackRow}>
            {trackSpots.slice(10).reverse().map((i) => (
              <Spot
                key={i}
                idx={i}
                pieces={piecesByPos.get(i) ?? []}
                selectedPiece={selectedPiece}
                myPlayer={myPlayer}
                myTurn={myTurn}
                onSelectPiece={setSelectedPiece}
              />
            ))}
            <div className={`${styles.spot} ${styles.goalSpot}`} aria-label="골인">
              <span className={styles.spotLabel}>골인</span>
              {(piecesByPos.get(GOAL_POS) ?? []).length > 0 && (
                <div className={styles.pieceCluster}>
                  {(piecesByPos.get(GOAL_POS) ?? []).map((p) => (
                    <span key={p.id} className={`${styles.piece} ${p.player === 0 ? styles.player0 : styles.player1}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 던지기 + 결과 */}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.throwBtn}
          onClick={handleThrow}
          disabled={!myTurn || state.pendingThrows.length > 0}
          aria-label="윷 던지기"
        >
          <Dice5 size={22} />
          <span>윷 던지기</span>
        </button>

        <div className={styles.throwsRow}>
          {state.pendingThrows.length === 0 && lastThrow && (
            <span className={styles.lastThrow}>마지막: <strong>{lastThrow}</strong></span>
          )}
          {state.pendingThrows.map((t, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.throwChip} ${selectedThrow === i ? styles.throwChipSelected : ''}`}
              onClick={() => {
                if (selectedPiece !== null) {
                  handleUseThrow(selectedPiece, i);
                } else {
                  setSelectedThrow(selectedThrow === i ? null : i);
                }
              }}
              disabled={!myTurn}
            >
              <strong>{t}</strong>
              <span className={styles.throwValue}>{YUT_VALUE[t] > 0 ? `+${YUT_VALUE[t]}` : YUT_VALUE[t]}</span>
            </button>
          ))}
        </div>

        {selectedPiece !== null && state.pendingThrows.length > 0 && (
          <p className={styles.helpText}>윷 결과를 탭해 말을 이동하세요</p>
        )}
        {selectedThrow !== null && (
          <p className={styles.helpText}>이동할 말을 선택하세요</p>
        )}

        {myTurn && state.pendingThrows.length > 0 && (
          <button type="button" className={styles.passBtn} onClick={handlePass}>
            이동 불가 — 차례 넘기기
          </button>
        )}
      </div>
    </div>
  );
}

interface SpotProps {
  idx: number;
  pieces: { id: number; player: Player; stack: number[] }[];
  selectedPiece: number | null;
  myPlayer: Player;
  myTurn: boolean;
  onSelectPiece: (id: number | null) => void;
}

function Spot({ idx, pieces, selectedPiece, myPlayer, myTurn, onSelectPiece }: SpotProps) {
  return (
    <div className={styles.spot} aria-label={`${idx + 1}번 칸`}>
      <span className={styles.spotIdx}>{idx + 1}</span>
      {pieces.length > 0 && (
        <div className={styles.pieceCluster}>
          {pieces.map((p) => {
            const stackSize = 1 + p.stack.length;
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.piece} ${p.player === 0 ? styles.player0 : styles.player1} ${selectedPiece === p.id ? styles.pieceSelected : ''}`}
                onClick={() => myTurn && p.player === myPlayer && onSelectPiece(p.id === selectedPiece ? null : p.id)}
                disabled={!myTurn || p.player !== myPlayer}
                aria-label={`${p.player === 0 ? '청' : '홍'} 말${stackSize > 1 ? ` (${stackSize}개 업힘)` : ''}`}
              >
                {stackSize > 1 && <span className={styles.stackBadge}>{stackSize}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
