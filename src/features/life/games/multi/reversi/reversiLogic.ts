export type Stone = 0 | 1 | 2; // 0=빈칸, 1=흑, 2=백
export const SIZE = 8;

const DIRS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],            [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function emptyBoard(): Stone[][] {
  const b: Stone[][] = Array.from({ length: SIZE }, () => Array<Stone>(SIZE).fill(0));
  b[3][3] = 2; b[3][4] = 1;
  b[4][3] = 1; b[4][4] = 2;
  return b;
}

/** (x,y)에 stone을 두었을 때 뒤집힐 상대 돌 좌표 목록. 둘 수 없으면 빈 배열 */
export function flipsFromMove(board: Stone[][], x: number, y: number, stone: Stone): [number, number][] {
  if (stone === 0) return [];
  if (board[y][x] !== 0) return [];
  const opp: Stone = stone === 1 ? 2 : 1;
  const flips: [number, number][] = [];
  for (const [dx, dy] of DIRS) {
    let nx = x + dx, ny = y + dy;
    const line: [number, number][] = [];
    while (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === opp) {
      line.push([nx, ny]);
      nx += dx; ny += dy;
    }
    if (line.length > 0 && nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && board[ny][nx] === stone) {
      flips.push(...line);
    }
  }
  return flips;
}

/** 새 보드 반환 (불변). 잘못된 수면 board 그대로 반환 */
export function applyMove(board: Stone[][], x: number, y: number, stone: Stone): Stone[][] {
  const flips = flipsFromMove(board, x, y, stone);
  if (flips.length === 0) return board;
  const next = board.map((r) => r.slice()) as Stone[][];
  next[y][x] = stone;
  for (const [fx, fy] of flips) next[fy][fx] = stone;
  return next;
}

/** stone 측이 둘 수 있는 자리가 하나라도 있나 */
export function hasValidMove(board: Stone[][], stone: Stone): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 0 && flipsFromMove(board, x, y, stone).length > 0) return true;
    }
  }
  return false;
}

export function validMovesMap(board: Stone[][], stone: Stone): boolean[][] {
  const map: boolean[][] = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 0 && flipsFromMove(board, x, y, stone).length > 0) map[y][x] = true;
    }
  }
  return map;
}

export function countStones(board: Stone[][]): { black: number; white: number; empty: number } {
  let black = 0, white = 0, empty = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = board[y][x];
      if (v === 1) black++;
      else if (v === 2) white++;
      else empty++;
    }
  }
  return { black, white, empty };
}
