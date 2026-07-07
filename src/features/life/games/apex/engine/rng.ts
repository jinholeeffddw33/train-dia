/**
 * APEX RUSH — 시드 기반 결정적 RNG (mulberry32)
 * 데일리 시드: 같은 날 모든 유저가 같은 코스를 받는다 (데일리 리더보드 공정성).
 */

export type Rng = () => number

/** mulberry32 — 빠르고 결정적인 32bit PRNG */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** min~max 균등 난수 */
export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** 정수 난수 [min, max] */
export function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1))
}

/** 배열에서 하나 뽑기 */
export function rngPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * 판마다 새 랜덤 시드 — "매 판 새로운 코스" (진호 V15: "코스가 계속 랜덤으로 바뀌었으면")
 * 보안 무관 게임 시드 — Math.random 충분.
 */
export function getRunSeed(): number {
  return (Math.random() * 0x7fffffff) >>> 0
}

/**
 * KST 기준 오늘의 데일리 시드 — "오늘의 코스"
 * (UTC+9 고정. 라이딩 통계 KST 주경계와 같은 원칙)
 */
export function getDailySeed(now: Date = new Date()): number {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth() + 1
  const d = kst.getUTCDate()
  // 날짜를 해시 → 31bit 양수
  let h = y * 10000 + m * 100 + d
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = (h ^ (h >>> 16)) >>> 0
  return h % 0x7fffffff
}

/** 데일리 코스 표기용 KST 날짜 문자열 (예: 7월 2일) */
export function getDailyLabel(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}
