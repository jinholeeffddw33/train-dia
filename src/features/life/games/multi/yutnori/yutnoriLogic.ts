/**
 * 윷놀이 핵심 로직 (간소화 버전 — 단축로 없음)
 *
 * 보드: 0번(시작) → 1 → ... → 19 → 골인(20)
 * 4개의 말, 잡기·업기 지원, 윷/모/잡기 시 한 번 더 던짐
 */

export type YutResult = '도' | '개' | '걸' | '윷' | '모' | '뒤도';

export const YUT_VALUE: Record<YutResult, number> = {
  '뒤도': -1,
  '도': 1,
  '개': 2,
  '걸': 3,
  '윷': 4,
  '모': 5,
};

export const YUT_EXTRA: Record<YutResult, boolean> = {
  '뒤도': false,
  '도': false,
  '개': false,
  '걸': false,
  '윷': true,
  '모': true,
};

/** 4개의 윷가락 던지기 — 표준 확률 (16분의 1 단위) */
export function throwYut(): YutResult {
  // 0~15 중 하나
  const r = Math.floor(Math.random() * 16);
  if (r === 0) return '모';                         // 1/16
  if (r >= 1 && r <= 3) return '도';                // 3/16
  if (r === 4) return '뒤도';                       // 1/16
  if (r >= 5 && r <= 10) return '개';               // 6/16
  if (r >= 11 && r <= 14) return '걸';              // 4/16
  return '윷';                                      // 1/16
}

export const TRACK_SIZE = 20;
export const PIECES_PER_PLAYER = 4;
export const HOME_POS = -1;       // 아직 출발 안한 말
export const GOAL_POS = TRACK_SIZE;

export type Player = 0 | 1;

export interface Piece {
  /** 말 ID (플레이어별 0~3) */
  id: number;
  /** 소유자 */
  player: Player;
  /** 현재 위치 (-1 = 집, 0~19 = 트랙, 20 = 골인) */
  pos: number;
  /** 같은 칸에 업힌 다른 말들 (자신은 제외) */
  stack: number[];
}

export interface YutnoriState {
  pieces: Piece[];                   // 8개 (각 플레이어 4개)
  turn: Player;                      // 현재 차례
  pendingThrows: YutResult[];        // 던졌으나 아직 사용 안한 결과
  log: string[];
  winner: Player | null;
}

export function initialState(): YutnoriState {
  const pieces: Piece[] = [];
  for (const p of [0, 1] as Player[]) {
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      pieces.push({ id: p * PIECES_PER_PLAYER + i, player: p, pos: HOME_POS, stack: [] });
    }
  }
  return {
    pieces,
    turn: 0,
    pendingThrows: [],
    log: [],
    winner: null,
  };
}

/**
 * 특정 말을 윷 결과만큼 이동시켰을 때 새 위치 계산.
 * - HOME에서 뒤도 → 이동 불가 (null)
 * - 정확히 GOAL_POS 이상이 되면 골인
 */
export function calcNextPos(piece: Piece, value: number): number | null {
  if (piece.pos === HOME_POS) {
    if (value <= 0) return null;
    return value - 1; // 0번에 두기 위해 도(1) 던지면 0번 (실제로는 1칸 진행)
    // 즉 도(1) → 출발(0번), 개(2) → 1번 ...
    // 시뮬: HOME → +1 = 0, +2 = 1, +n = n-1
  }
  const next = piece.pos + value;
  if (next < 0) return null; // 트랙 음수 진입 불가 (집에서 뒤도 등)
  if (next >= GOAL_POS) return GOAL_POS;
  return next;
}

/** 말 이동 + 잡기/업기 처리 → 새 상태 반환 */
export function applyMove(state: YutnoriState, pieceIdx: number, value: number): {
  state: YutnoriState;
  captured: boolean;
  finished: boolean;
} | null {
  const piece = state.pieces[pieceIdx];
  if (piece.pos === GOAL_POS) return null;
  const newPos = calcNextPos(piece, value);
  if (newPos === null) return null;

  // 같이 움직이는 말들 (자신 + stack)
  const movingIds = [piece.id, ...piece.stack];
  let captured = false;
  let finished = false;
  let log = state.log.slice();

  // 새 위치 처리
  let newPieces = state.pieces.map((p) => ({ ...p, stack: [...p.stack] }));

  if (newPos === GOAL_POS) {
    // 골인 — movingIds 모두 GOAL로
    for (const id of movingIds) {
      newPieces[id] = { ...newPieces[id], pos: GOAL_POS, stack: [] };
    }
    finished = true;
    log.push(`P${piece.player + 1} 골인! (${movingIds.length}개)`);
  } else {
    // 도착 칸의 다른 말 확인
    const occupants = newPieces.filter((p) => p.pos === newPos && p.player !== piece.player);
    const ownOnSpot = newPieces.filter((p) => p.pos === newPos && p.player === piece.player && !movingIds.includes(p.id));

    if (occupants.length > 0) {
      // 잡기 — 상대 말 모두 (해당 stack 포함) HOME으로
      const capturedIds = occupants.flatMap((o) => [o.id, ...o.stack]);
      for (const id of capturedIds) {
        newPieces[id] = { ...newPieces[id], pos: HOME_POS, stack: [] };
      }
      // movingIds를 새 위치로
      const leader = movingIds[0];
      newPieces[leader] = { ...newPieces[leader], pos: newPos, stack: movingIds.slice(1) };
      for (const id of movingIds.slice(1)) {
        newPieces[id] = { ...newPieces[id], pos: newPos, stack: [] };
      }
      captured = true;
      log.push(`P${piece.player + 1} 잡기! (P${1 - piece.player + 1} 말 ${capturedIds.length}개)`);
    } else if (ownOnSpot.length > 0) {
      // 업기 — 도착 칸의 자신 말과 합치기
      const leader = ownOnSpot[0];
      const allStack = [
        ...leader.stack,
        ...movingIds,
      ];
      newPieces[leader.id] = { ...newPieces[leader.id], stack: allStack };
      for (const id of movingIds) {
        newPieces[id] = { ...newPieces[id], pos: newPos, stack: [] };
      }
      log.push(`P${piece.player + 1} 업기 (총 ${allStack.length + 1}개)`);
    } else {
      // 빈 칸 또는 본인 말 없음
      const leader = movingIds[0];
      newPieces[leader] = { ...newPieces[leader], pos: newPos, stack: movingIds.slice(1) };
      for (const id of movingIds.slice(1)) {
        newPieces[id] = { ...newPieces[id], pos: newPos, stack: [] };
      }
    }
  }

  // 승리 체크
  let winner: Player | null = state.winner;
  if (winner === null) {
    const goalCount = newPieces.filter((p) => p.player === piece.player && p.pos === GOAL_POS).length;
    if (goalCount >= PIECES_PER_PLAYER) winner = piece.player;
  }

  return {
    state: { ...state, pieces: newPieces, log, winner },
    captured,
    finished,
  };
}
