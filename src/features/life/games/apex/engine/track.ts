/**
 * APEX RUSH — 절차 트랙 생성기 (V15 대개편)
 *
 * 시드 하나로 전체 코스가 결정된다. 판마다 새 시드 = 매 판 새로운 코스 (진호 V15).
 * 청크(60m) 단위로 스트리밍 생성/폐기 — Slow Roads corridor 전략.
 * 콘텐츠(장애물/소품)는 청크 index 기반 서브시드라 결정적이고,
 * 중심선(heading/고도)은 순차 적분이므로 builder 가 index 0 부터 순서대로 만든다.
 *
 * V15 다양성 3축 (진호 "코스·장애물 5배 다양하게, 억까 금지"):
 *  1) 테마 4종 셔플 — 산길/자연/도심/사이버, 시드별 순서 랜덤
 *  2) 무드 세그먼트 — cruise/rollers(언덕 연타)/speedway(직선 질주)/winding(와인딩)/serene(숨돌리기)
 *  3) 배치 패턴 — 슬라럼/공사구간/록필드/통나무/주차 행렬/더블 램프/링 라인 + 기믹(웅덩이/스피드 링)
 * 공정성 불변식은 유지: 차선 경계 1.9m + 정적 중앙선 0.3m 침범 금지 + 램프 착지존 예약
 * → 어떤 배치도 통과 틈 ≥ 1.2m (apex-impossible-geometry.test.ts 가 회귀 게이트).
 */

import {
  CHUNK_LEN, SAMPLE_STEP, SAMPLES_PER_CHUNK, ROAD_HALF_W,
  STAGE_LENGTH, STAGE_THEMES, STAGE_DIFF_CAP, CHUNKS_AHEAD, CHUNKS_BEHIND,
  START_SPEED, MAX_SPEED, SPEED_GAIN_PER_M, GRAVITY,
  RAMP_VZ_BASE, RAMP_VZ_SPEED_FACTOR,
  RAMP_TIER_VZ_MULT, RAMP_TIER_VZ_MAX, RAMP_TIER_SCALE,
  DIRT_TRAIL_HALF,
} from '../constants'
import { createRng, rngRange, type Rng } from './rng'
import type { BiomeId, Obstacle, SceneryProp, TrackChunk, TrackSample } from './types'

/** s 위치의 스테이지 번호 (1부터, 무제한) */
export function stageAt(s: number): number {
  return Math.floor(Math.max(0, s) / STAGE_LENGTH) + 1
}

// ── 테마 순서 — 시드별 셔플 ("코스가 계속 랜덤", 진호 V15) ──
// 게임 인스턴스는 동시 1개 전제(모듈 상태). ApexSim 생성자가 setThemeOrder(seed) 호출.
let themeOrder: readonly BiomeId[] = STAGE_THEMES

export function setThemeOrder(seed: number): void {
  const arr = [...STAGE_THEMES]
  const r = createRng((seed ^ 0x5bd1e995) >>> 0)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  themeOrder = arr
}

/** s 위치의 스테이지 테마 (셔플된 순서 순환) */
export function biomeAt(s: number): BiomeId {
  return themeOrder[(stageAt(s) - 1) % themeOrder.length]
}

/** s 가 속한 스테이지의 시작으로부터 거리 / 스테이지 길이 */
export function biomeProgress(s: number): { id: BiomeId; into: number; length: number } {
  const c = Math.max(0, s)
  return { id: biomeAt(c), into: c % STAGE_LENGTH, length: STAGE_LENGTH }
}

/**
 * 난이도 0~1 — 스테이지 따라 부드럽게 상승, STAGE_DIFF_CAP 도달 시 만렙 후 고정
 * (진호: "난이도 무제한 상승 금지" + "레전드로 어렵게 금지" — 0.7 플래토 유지).
 */
function difficultyAt(s: number): number {
  const progress = Math.max(0, s) / STAGE_LENGTH
  return Math.min(0.7, 0.10 + Math.min(progress, STAGE_DIFF_CAP - 1) * 0.12)
}

/** 무드 세그먼트 — 3청크(180m) 블록 단위로 코스 성격이 바뀐다.
 *  rush = 파티 부스트 구간 (유저 피드백 ⑬): 장애물 0 + 스피드 링 연속 + 코인 비 + 네온 라인 */
type Mood = 'cruise' | 'rollers' | 'speedway' | 'winding' | 'serene' | 'rush'

interface BuilderCursor {
  px: number
  py: number
  pz: number
  heading: number
  curvature: number
  grade: number
  /** 직전 청크가 오르막이었나 (다음 청크 강제 급다운힐 = 크레스트 점프 유도) */
  wasClimb: boolean
}

export class TrackBuilder {
  private seed: number
  private chunks = new Map<number, TrackChunk>()
  private cursor: BuilderCursor
  private nextIndex = 0
  /** 매크로 스윕 위상 (시드별) — 수백 m 파장 큰 곡선 */
  private sweepPhase: number
  private sweepPhase2: number
  /** 램프 착지 예약 존 — 청크 경계 넘어 유지 */
  private landingZones: Array<{ lo: number; hi: number }> = []
  private addedListeners = new Set<(chunk: TrackChunk) => void>()
  private removedListeners = new Set<(chunk: TrackChunk) => void>()

  constructor(seed: number) {
    this.seed = seed >>> 0
    this.cursor = { px: 0, py: 0, pz: 0, heading: 0, curvature: 0, grade: -0.07, wasClimb: false }
    this.sweepPhase = ((this.seed % 1000) / 1000) * Math.PI * 2
    this.sweepPhase2 = (((this.seed >>> 10) % 1000) / 1000) * Math.PI * 2
  }

  subscribeChunks(
    onAdded: ((chunk: TrackChunk) => void) | null,
    onRemoved: ((chunk: TrackChunk) => void) | null,
  ): () => void {
    if (onAdded) this.addedListeners.add(onAdded)
    if (onRemoved) this.removedListeners.add(onRemoved)
    return () => {
      if (onAdded) this.addedListeners.delete(onAdded)
      if (onRemoved) this.removedListeners.delete(onRemoved)
    }
  }

  /** 청크 index 전용 결정적 RNG */
  private chunkRng(index: number): Rng {
    const sub = (this.seed ^ Math.imul(index + 1, 2654435761)) >>> 0
    return createRng(sub)
  }

  /** 무드 — 3청크 블록 해시 (시드 결정적). 초반 3청크는 cruise 로 워밍업 */
  private moodFor(index: number): Mood {
    if (index < 3) return 'cruise'
    const block = Math.floor(index / 3)
    const r = createRng((this.seed ^ Math.imul(block + 7, 0x9e3779b1)) >>> 0)()
    // rush 는 6청크(360m) 이후부터 — 워밍업 구간엔 파티 없음
    if (index >= 6 && r >= 0.92) return 'rush'
    return r < 0.28 ? 'cruise'
      : r < 0.47 ? 'rollers'
        : r < 0.64 ? 'speedway'
          : r < 0.82 ? 'winding' : 'serene'
  }

  update(riderS: number): void {
    const currentIndex = Math.floor(riderS / CHUNK_LEN)
    const needUntil = currentIndex + CHUNKS_AHEAD
    while (this.nextIndex <= needUntil) {
      this.buildChunk(this.nextIndex++)
    }
    const removeBefore = currentIndex - CHUNKS_BEHIND
    for (const [idx, chunk] of this.chunks) {
      if (idx < removeBefore) {
        // 동방향 차량은 홈 청크보다 앞으로 진행했을 수 있다 — 삭제 전 현재 위치 청크로 이관
        for (const ob of chunk.obstacles) {
          if (ob.gone || ob.vs === 0) continue
          const destIdx = Math.floor(ob.s / CHUNK_LEN)
          if (destIdx >= removeBefore) {
            const dest = this.chunks.get(destIdx)
            if (dest && dest !== chunk) dest.obstacles.push(ob)
          }
        }
        this.chunks.delete(idx)
        for (const fn of this.removedListeners) fn(chunk)
      }
    }
  }

  getChunk(index: number): TrackChunk | undefined {
    return this.chunks.get(index)
  }

  allChunks(): IterableIterator<TrackChunk> {
    return this.chunks.values()
  }

  /** s 위치의 중심선 샘플 (선형 보간) */
  sampleAt(s: number): TrackSample {
    const idx = Math.floor(s / CHUNK_LEN)
    const chunk = this.chunks.get(idx)
    if (!chunk) {
      const nearest = this.chunks.get(Math.max(0, this.nextIndex - 1))
      const smp = nearest?.samples[nearest.samples.length - 1]
      if (smp) return smp
      return { px: 0, py: 0, pz: 0, dirX: 0, dirZ: -1, rightX: 1, rightZ: 0, grade: -0.07 }
    }
    const local = (s - chunk.s0) / SAMPLE_STEP
    const i0 = Math.max(0, Math.min(SAMPLES_PER_CHUNK - 1, Math.floor(local)))
    const t = Math.max(0, Math.min(1, local - i0))
    const a = chunk.samples[i0]
    const b = chunk.samples[i0 + 1]
    return {
      px: a.px + (b.px - a.px) * t,
      py: a.py + (b.py - a.py) * t,
      pz: a.pz + (b.pz - a.pz) * t,
      dirX: a.dirX + (b.dirX - a.dirX) * t,
      dirZ: a.dirZ + (b.dirZ - a.dirZ) * t,
      rightX: a.rightX + (b.rightX - a.rightX) * t,
      rightZ: a.rightZ + (b.rightZ - a.rightZ) * t,
      grade: a.grade + (b.grade - a.grade) * t,
    }
  }

  /** (s, x, z높이) → 월드 좌표 */
  worldOf(s: number, x: number, z: number): { px: number; py: number; pz: number } {
    const smp = this.sampleAt(s)
    return {
      px: smp.px + smp.rightX * x,
      py: smp.py + z,
      pz: smp.pz + smp.rightZ * x,
    }
  }

  // ── 청크 생성 ──

  private buildChunk(index: number): void {
    const rng = this.chunkRng(index)
    const s0 = index * CHUNK_LEN
    const biome = biomeAt(s0 + CHUNK_LEN / 2)
    const diff = difficultyAt(s0)
    const mood = this.moodFor(index)

    // 목표 곡률 = 매크로 스윕 + 마이크로 잔변화, 무드/테마가 스케일
    const macro = (
      Math.sin(s0 / 240 + this.sweepPhase) * 0.62
      + Math.sin(s0 / 88 + this.sweepPhase2) * 0.38
    ) * 0.0105
    const micro = rng() < 0.22 ? 0 : rngRange(rng, -0.006, 0.006)
    const biomeCurv = biome === 'city' ? 0.6
      : biome === 'cyber' ? 0.5 // 네온 하이웨이 — 직선적
        : biome === 'dirt' ? 1.6 // 흙길 싱글트랙 — 강한 와인딩 (진호 "꾸불꾸불")
          : biome === 'mountain' ? 1.05 : 0.9
    const moodCurv = mood === 'speedway' ? 0.35 : mood === 'winding' ? 1.45 : 1
    const targetCurv = (macro + micro) * biomeCurv * moodCurv

    // ── 언덕 상태머신 — 오르막 뒤엔 반드시 급다운힐 (크레스트 자연 점프 유도) ──
    let targetGrade: number
    let isClimb = false
    if (this.cursor.wasClimb) {
      targetGrade = rngRange(rng, -0.16, -0.11)
    } else if (index >= 3) {
      // rollers 무드 = 언덕 연타 (크레스트 점프 리듬), speedway = 질주 다운힐만.
      // 유저 피드백 "업힐은 느려져서 재미없다" → 빈도 절반 이하 + 경사 완만화 (크레스트 점프
      // 리듬은 rollers 에 남김 — 오르막 자체가 0이면 정점 점프도 죽는다)
      const upChance = mood === 'rush' ? 0
        : mood === 'rollers' ? 0.3
          : mood === 'speedway' ? 0
            : biome === 'nature' ? 0.12
              : biome === 'mountain' || biome === 'dirt' ? 0.1 : 0.04
      if (rng() < upChance) {
        isClimb = true
        targetGrade = biome === 'nature'
          ? rngRange(rng, 0.04, 0.08)
          : rngRange(rng, 0.05, 0.09)
      } else if (mood === 'speedway') {
        targetGrade = rngRange(rng, -0.15, -0.09)
      } else if (biome === 'dirt') {
        // 흙길 = 진짜 다운힐 파크 — 급경사 (진호 "경사도 낮고" → -12~-26%)
        targetGrade = rngRange(rng, -0.26, -0.12)
      } else if (biome === 'city' || biome === 'cyber') {
        targetGrade = rngRange(rng, -0.08, -0.02)
      } else {
        const g = rng()
        targetGrade = g < 0.22 ? rngRange(rng, -0.04, 0.0)
          : g > 0.86 ? rngRange(rng, -0.16, -0.11)
            : rngRange(rng, -0.12, -0.05)
      }
    } else {
      targetGrade = rngRange(rng, -0.1, -0.06)
    }

    // 🏞 흙길 = 리얼 MTB 파크 코스 스크립트 (진호 2026-07-07 "직선과 완전 S자 곡선 섞인").
    //   완만한 매크로 스윕 대신 청크 단위 세그먼트: 직선 질주 / 급 S자(청크 안에서 좌↔우 전환) /
    //   타이트 원호 코너. 곡률 0.03~0.045 rad/m = 회전반경 22~33m — 도로 스윕(최대 ~60m)의 2배+.
    let dirtSeg: { type: 'straight' | 's' | 'arc'; c: number } | null = null
    if (biome === 'dirt') {
      const segRoll = rng()
      const sign = rng() < 0.5 ? -1 : 1
      dirtSeg = segRoll < 0.25
        ? { type: 'straight', c: 0 }
        : segRoll < 0.68
          ? { type: 's', c: rngRange(rng, 0.03, 0.045) * sign }
          : { type: 'arc', c: rngRange(rng, 0.022, 0.038) * sign }
    }

    const samples: TrackSample[] = []
    let { px, py, pz, heading, curvature, grade } = this.cursor

    for (let i = 0; i <= SAMPLES_PER_CHUNK; i++) {
      const dirX = Math.sin(heading)
      const dirZ = -Math.cos(heading)
      samples.push({
        px, py, pz,
        dirX, dirZ,
        rightX: -dirZ,
        rightZ: dirX,
        grade,
      })
      if (i < SAMPLES_PER_CHUNK) {
        const t = i / SAMPLES_PER_CHUNK
        // 흙길 세그먼트 곡률 (S자는 청크 중간에 부호 반전) — 빠른 수렴으로 코너가 명확하게 선다
        const tc = dirtSeg
          ? (dirtSeg.type === 's' ? (t < 0.5 ? dirtSeg.c : -dirtSeg.c) : dirtSeg.c)
          : targetCurv
        curvature = curvature + (tc - curvature) * (dirtSeg ? 0.22 : 0.06 + 0.1 * t)
        grade = grade + (targetGrade - grade) * (this.cursor.wasClimb ? 0.16 : 0.08)
        heading += curvature * SAMPLE_STEP
        px += Math.sin(heading) * SAMPLE_STEP
        pz += -Math.cos(heading) * SAMPLE_STEP
        py += grade * SAMPLE_STEP
      }
    }

    this.cursor = { px, py, pz, heading, curvature, grade, wasClimb: isClimb }

    // 스테이지 경계 연출 — 다음 테마가 사이버(밤)면 터널 통과, 그 외엔 게이트 아치.
    const boundaryS = Math.ceil((s0 + 1) / STAGE_LENGTH) * STAGE_LENGTH
    const gateS = boundaryS > s0 && boundaryS <= s0 + CHUNK_LEN ? boundaryS : null
    const prog = biomeProgress(s0 + CHUNK_LEN / 2)
    const remain = prog.length - prog.into
    const nextTheme = biomeAt(s0 + CHUNK_LEN / 2 + remain + 1)
    // half-open 한 청크 폭 윈도우 [60, 120).
    // ★직선 청크에만 (|curv|<0.0045) — 터널 실린더는 직선이라 커브 위에 얹히면 벽이
    //   도로를 침범해 "뚫고 지나가는 2D 그림"이 됨 (진호 V16 실폰 제보)
    const tunnelS = nextTheme === 'cyber' && remain >= 60 && remain < 120 && Math.abs(targetCurv) < 0.0045
      ? s0 + CHUNK_LEN / 2 : null

    const obstacles = index < 2 ? [] : this.buildObstacles(rng, s0, biome, diff, tunnelS, mood)
    const props = this.buildProps(rng, s0, biome, targetCurv, tunnelS, gateS, mood)

    const chunk: TrackChunk = { index, s0, samples, biome, obstacles, props }
    this.chunks.set(index, chunk)
    for (const fn of this.addedListeners) fn(chunk)
  }

  /**
   * 장애물/차량/아이템/기믹/패턴 배치 — 행(row) 단위, 항상 통과 갭 보장.
   * 불변식: 차량 차선 안경계 ±1.9 / 정적 안쪽엣지 중앙선 -0.3 이상 침범 금지 / 착지존 예약.
   */
  private buildObstacles(
    rng: Rng, s0: number, biome: BiomeId, diff: number, tunnelS: number | null, mood: Mood,
  ): Obstacle[] {
    const out: Obstacle[] = []
    // 행 간격 — 무드가 밀도를 가른다 (speedway/serene = 트인 길)
    const moodGap = mood === 'serene' ? 1.7 : mood === 'speedway' ? 1.35 : mood === 'winding' ? 1.25 : mood === 'rollers' ? 1.15 : 1
    const rowGap = (24 - diff * 10) * moodGap
    let s = s0 + rngRange(rng, 4, rowGap * 0.6)
    const sEnd = s0 + CHUNK_LEN - 4
    const nearGate = (pos: number) => {
      const b = Math.round(pos / STAGE_LENGTH) * STAGE_LENGTH
      return b > 0 && Math.abs(pos - b) < 10
    }
    const inTunnelZone = (pos: number) =>
      (tunnelS !== null && Math.abs(pos - tunnelS) < 28) || nearGate(pos)
    this.landingZones = this.landingZones.filter((z) => z.hi > s0)
    const inLandingZone = (pos: number) => this.landingZones.some((z) => pos > z.lo && pos < z.hi)

    // 테마별 정적 장애물 풀 (충돌 halfW ≈ 시각의 90% — 관대 판정).
    // barrel/crate = 장애물 다양화 (유저 피드백 ⑧ "맨날 똑같은 장애물")
    const staticKinds: Array<{ kind: Obstacle['kind']; halfW: number; halfD: number; w: number }> =
      biome === 'mountain'
        ? [
            { kind: 'rock', halfW: 0.68, halfD: 0.65, w: 4 },
            { kind: 'log', halfW: 1.7, halfD: 0.4, w: 2 },
            { kind: 'crate', halfW: 0.42, halfD: 0.42, w: 1 },
            { kind: 'cone', halfW: 0.32, halfD: 0.35, w: 1 },
          ]
        : biome === 'nature'
          ? [
              { kind: 'log', halfW: 1.7, halfD: 0.4, w: 3 },
              { kind: 'rock', halfW: 0.68, halfD: 0.65, w: 2 },
              { kind: 'cone', halfW: 0.32, halfD: 0.35, w: 2 },
              { kind: 'crate', halfW: 0.42, halfD: 0.42, w: 1 },
              { kind: 'barrier', halfW: 1.35, halfD: 0.35, w: 1 },
            ]
          : biome === 'dirt'
            ? [
                // 흙길 MTB — 자연물만: 바위/통나무/서있는 나무 (진호 "돌덩어리 타고, 나무도 피하고")
                { kind: 'rock', halfW: 0.68, halfD: 0.65, w: 4 },
                { kind: 'trunk', halfW: 0.4, halfD: 0.4, w: 3 },
                { kind: 'log', halfW: 1.7, halfD: 0.4, w: 2 },
              ]
            : [
                // 도심/사이버 — 공사 바리케이드/콘/드럼통/상자
                { kind: 'barrier', halfW: 1.35, halfD: 0.35, w: 3 },
                { kind: 'cone', halfW: 0.32, halfD: 0.35, w: 2 },
                { kind: 'barrel', halfW: 0.42, halfD: 0.42, w: 2 },
                { kind: 'crate', halfW: 0.42, halfD: 0.42, w: 1 },
              ]

    const pickStatic = () => {
      const total = staticKinds.reduce((a, b) => a + b.w, 0)
      let r = rng() * total
      for (const k of staticKinds) {
        if (r < k.w) return k
        r -= k.w
      }
      return staticKinds[0]
    }

    // 바위는 렌더 스케일이 variant 가변 — 충돌도 같은 스케일 (V7 억울사 수정 유지)
    const rockScale = (v: number) => 0.7 + v * 0.7
    const sizedStatic = (k: { kind: Obstacle['kind']; halfW: number; halfD: number }, v: number) =>
      k.kind === 'rock'
        ? { halfW: 0.675 * rockScale(v), halfD: 0.6525 * rockScale(v) }
        : { halfW: k.halfW, halfD: k.halfD }

    /** 정적 1개 스폰 — 중앙선 침범 금지 규칙 내장 */
    const pushStatic = (pos: number, side: -1 | 1) => {
      if (inTunnelZone(pos) || inLandingZone(pos)) return
      const k = pickStatic()
      const v = rng()
      const sz = sizedStatic(k, v)
      const x = side * rngRange(rng, sz.halfW + 0.3, ROAD_HALF_W - sz.halfW - 0.3)
      out.push({
        kind: k.kind, s: pos, x, halfW: sz.halfW, halfD: sz.halfD,
        vs: 0, passed: false, gone: false, variant: v,
      })
    }

    /** ◎ 스피드 링 (variant <0.5 지상 / ≥0.5 공중) */
    const pushRing = (pos: number, x: number, high: boolean) => {
      if (inTunnelZone(pos)) return
      out.push({
        kind: 'ring', s: pos, x, halfW: 1.15, halfD: 0.9,
        vs: 0, passed: false, gone: false, variant: high ? 0.75 : 0.25,
      })
    }

    /** 💧 물웅덩이(자연/산) / 오일(도심/사이버) — 죽지 않는 미끄럼 기믹 */
    const pushPuddle = (pos: number) => {
      if (inTunnelZone(pos) || inLandingZone(pos)) return
      out.push({
        kind: 'puddle', s: pos, x: rngRange(rng, -2.8, 2.8), halfW: 1.15, halfD: 1.5,
        vs: 0, passed: false, gone: false, variant: rng(),
      })
    }

    /** 차종 선택 — 테마/난이도별 */
    const spawnVehicle = (pos: number, forcedLane?: 'left' | 'right', parked = false) => {
      const roll = rng()
      let kind: Obstacle['kind'] = 'car'
      let halfW = 0.88
      let halfD = 2.05
      const urban = biome === 'city' || biome === 'cyber'
      if (urban) {
        if (roll < 0.22) { kind = 'bus'; halfW = 1.0; halfD = 4.3 }
        else if (roll < 0.45) { kind = 'truck'; halfW = 0.95; halfD = 3.2 }
      } else if (roll < 0.3) {
        kind = 'truck'; halfW = 0.95; halfD = 3.2
      }
      if (parked) {
        // 갓길 주차 (도심/사이버 풍경 기믹) — 안쪽 차선은 항상 비어 통과 보장
        const side = rng() < 0.5 ? -1 : 1
        out.push({
          kind: 'car', s: pos, x: side * 3.35, halfW: 0.88, halfD: 2.05,
          vs: 0, passed: false, gone: false, variant: rng(),
        })
        return
      }
      const oncoming = forcedLane ? forcedLane === 'left' : rng() < 0.55
      const speedBase = kind === 'car' ? 8 : kind === 'truck' ? 6.5 : 5.5
      // 차선 안쪽 경계 1.9 — 억까 불변식 (V6)
      out.push({
        kind,
        s: pos,
        x: oncoming ? rngRange(rng, -3.4, -1.9) : rngRange(rng, 1.9, 3.4),
        halfW, halfD,
        vs: oncoming ? -rngRange(rng, speedBase - 1.5, speedBase + 2) : rngRange(rng, speedBase - 2, speedBase + 1),
        passed: false, gone: false, variant: rng(),
      })
    }

    /** 램프 스폰 + 착지존 예약 + 보상. 티어(일반/빅/초빅 — 유저 피드백 ⑤) + 빅 이상은 공중 코인 라인.
     *  히트박스 = 렌더 스케일 연동 (불일치 금지). 다음 안전 s 반환 */
    const spawnRamp = (pos: number, x?: number): number => {
      const rx = x ?? rngRange(rng, -2.6, 2.6)
      // 티어: 일반 60/빅 28/초빅 12% — 흙길(MTB 파크)은 초빅 40% (진호 "초 빅점프대도 있고")
      const tRoll = rng()
      const tier = biome === 'dirt'
        ? (tRoll < 0.3 ? 0 : tRoll < 0.6 ? 1 : 2)
        : (tRoll < 0.6 ? 0 : tRoll < 0.88 ? 1 : 2)
      const variant = tier === 0 ? rngRange(rng, 0.05, 0.45) : tier === 1 ? rngRange(rng, 0.55, 0.75) : rngRange(rng, 0.82, 0.98)
      const sc = RAMP_TIER_SCALE[tier]
      out.push({
        kind: 'ramp', s: pos, x: rx,
        halfW: 1.15 * sc, halfD: 1.4 * sc,
        vs: 0, passed: false, gone: false, variant,
      })
      // 최악(최고속) 비행 거리 — sim 의 vz 공식과 동일해야 착지존이 정확
      const vWorst = Math.min(MAX_SPEED, START_SPEED + pos * SPEED_GAIN_PER_M) * 1.4
      const vzWorst = Math.min(
        (RAMP_VZ_BASE + vWorst * RAMP_VZ_SPEED_FACTOR) * RAMP_TIER_VZ_MULT[tier],
        RAMP_TIER_VZ_MAX[tier],
      )
      const flight = (vWorst * 2 * vzWorst) / GRAVITY
      this.landingZones.push({ lo: pos + flight - 6, hi: pos + flight + 6 })
      // 빅/초빅 = 체공 코인 라인 (포물선 위 3개, 초빅 정점은 💰골드 — "하늘에서 코인")
      if (tier >= 1) {
        const tTotal = (2 * vzWorst) / GRAVITY
        for (const r of [0.35, 0.5, 0.7]) {
          const t = tTotal * r
          const yAir = vzWorst * t - 0.5 * GRAVITY * t * t + 0.9
          const gold = tier === 2 && r === 0.5
          out.push({
            kind: gold ? 'goldchip' : 'chip',
            s: pos + flight * r, x: rx, y: yAir,
            halfW: 0.55, halfD: 0.9,
            vs: 0, passed: false, gone: false, variant: rng(),
          })
        }
      }
      // 보상 — 공중 링(비행 중간) 또는 착지 뒤 아이템
      const rewardRoll = rng()
      if (rewardRoll < 0.35 && tier === 0) {
        pushRing(pos + flight * 0.5, rx, true)
      } else if (rewardRoll < 0.65) {
        const itemS = pos + flight + rngRange(rng, 2, 8)
        if (!inTunnelZone(itemS)) this.pushItem(rng, out, itemS, biome === 'dirt' ? 1.2 : 3.2)
      }
      return pos + Math.max(22, Math.ceil(flight) + 6)
    }

    // ── 배치 패턴 — 종류보다 "패턴"이 다양성 체감의 핵심 ──
    const spawnPattern = (start: number): number => {
      const urban = biome === 'city' || biome === 'cyber'
      const pick = rng()
      if (pick < 0.2) {
        // 슬라럼 — 콘 4개 지그재그 (전 테마)
        let side: -1 | 1 = rng() < 0.5 ? -1 : 1
        for (let i = 0; i < 4; i++) {
          const ps = start + i * 13
          if (!inTunnelZone(ps) && !inLandingZone(ps)) {
            out.push({
              kind: 'cone', s: ps, x: side * rngRange(rng, 1.3, 1.8), halfW: 0.32, halfD: 0.35,
              vs: 0, passed: false, gone: false, variant: rng(),
            })
          }
          side = (side * -1) as -1 | 1
        }
        return start + 4 * 13
      }
      if (pick < 0.38) {
        if (urban) {
          // 공사 구간 — 바리케이드 3개 사선 테이퍼 (같은 쪽, 반대편 항상 개방)
          const side: -1 | 1 = rng() < 0.5 ? -1 : 1
          const xs = [3.05, 2.25, 1.45]
          for (let i = 0; i < 3; i++) {
            const ps = start + i * 12
            if (!inTunnelZone(ps) && !inLandingZone(ps)) {
              out.push({
                kind: 'barrier', s: ps, x: side * xs[i], halfW: 1.35, halfD: 0.35,
                vs: 0, passed: false, gone: false, variant: rng(),
              })
            }
          }
          return start + 3 * 12 + 6
        }
        // 록 필드 — 바위 3개 좌/우/좌 산개 (산길/자연)
        let side: -1 | 1 = rng() < 0.5 ? -1 : 1
        for (let i = 0; i < 3; i++) {
          const ps = start + i * 14
          if (!inTunnelZone(ps) && !inLandingZone(ps)) {
            const v = rng()
            const sz = sizedStatic({ kind: 'rock', halfW: 0.68, halfD: 0.65 }, v)
            const x = side * rngRange(rng, Math.max(1.0, sz.halfW + 0.3), ROAD_HALF_W - sz.halfW - 0.3)
            out.push({
              kind: 'rock', s: ps, x, halfW: sz.halfW, halfD: sz.halfD,
              vs: 0, passed: false, gone: false, variant: v,
            })
          }
          side = (side * -1) as -1 | 1
        }
        return start + 3 * 14
      }
      if (pick < 0.54) {
        if (urban) {
          // 주차 행렬 — 갓길 정지 차량 2대 (안쪽 차선 개방)
          for (let i = 0; i < 2; i++) {
            const ps = start + i * 13
            if (!inTunnelZone(ps) && !inLandingZone(ps)) spawnVehicle(ps, undefined, true)
          }
          return start + 26
        }
        // 통나무 스텝 — 좌/우 교대 2개 (자연/산길)
        let side: -1 | 1 = rng() < 0.5 ? -1 : 1
        for (let i = 0; i < 2; i++) {
          const ps = start + i * 16
          if (!inTunnelZone(ps) && !inLandingZone(ps)) {
            out.push({
              kind: 'log', s: ps, x: side * rngRange(rng, 1.55, 2.45), halfW: 1.7, halfD: 0.4,
              vs: 0, passed: false, gone: false, variant: rng(),
            })
          }
          side = (side * -1) as -1 | 1
        }
        return start + 32
      }
      if (pick < 0.74) {
        // 링 라인 — 지상 스피드 링 2~3개 직렬 (라인 유지 보상)
        const n = rng() < 0.4 ? 3 : 2
        const x = rngRange(rng, -2.4, 2.4)
        for (let i = 0; i < n; i++) {
          const ps = start + i * 15
          if (!inLandingZone(ps)) pushRing(ps, x, false)
        }
        return start + n * 15
      }
      // 더블 램프 — 점프 → 착지 → 곧바로 다음 점프 (콤보 리듬)
      let cur = start
      if (!inTunnelZone(cur) && !inLandingZone(cur)) {
        const x = rngRange(rng, -2.2, 2.2)
        cur = spawnRamp(cur, x)
        const second = cur + 4
        if (!inTunnelZone(second)) cur = spawnRamp(second, Math.max(-2.6, Math.min(2.6, x + rngRange(rng, -0.8, 0.8))))
      }
      return cur
    }

    // 흙길 좁은 트레일 배율 — 스폰 x 를 싱글트랙 폭에 맞춤
    const dirtLane = biome === 'dirt' ? 0.55 : 1
    const itemHalfX = biome === 'dirt' ? 1.2 : 3.2

    // ── 🎉 러시 존 (유저 피드백 ⑬ "부스트/파티 구간") — 장애물 0, 링 직렬 + 코인 비 ──
    if (mood === 'rush') {
      const rx = rngRange(rng, -1.2, 1.2) * dirtLane
      for (let i = 0; i < 4; i++) {
        const ps = s0 + 8 + i * 13
        if (!inTunnelZone(ps) && !inLandingZone(ps)) pushRing(ps, rx, false)
      }
      // 코인 비 — 좌우 2줄 웨이브 (마지막 알은 💰골드)
      for (let lane = 0; lane < 2; lane++) {
        const cx = (lane === 0 ? -2.0 : 2.0) * dirtLane
        for (let i = 0; i < 8; i++) {
          const cs = s0 + 6 + i * 6.5
          if (inTunnelZone(cs) || inLandingZone(cs)) continue
          out.push({
            kind: i === 7 ? 'goldchip' : 'chip',
            s: cs, x: Math.max(-3.8, Math.min(3.8, cx + Math.sin(i * 0.9 + lane * 2) * 0.9 * dirtLane)),
            halfW: 0.55, halfD: 0.55,
            vs: 0, passed: false, gone: false, variant: rng(),
          })
        }
      }
      if (rng() < 0.5) this.pushItem(rng, out, s0 + rngRange(rng, 20, 46), itemHalfX)
      return out
    }

    // ── 🏞 흙길 전용 스포너 — 좁은 싱글트랙(±1.8) 기준. 풀폭 킥커 / 바위·나무 슬라럼 / 코인 웨이브 ──
    if (biome === 'dirt') {
      while (s < sEnd) {
        if (inTunnelZone(s) || inLandingZone(s)) { s += 14; continue }
        const roll = rng()
        if (roll < 0.3) {
          // 킥커 — 트레일 풀폭 (레퍼런스: 트레일 자체가 점프대)
          s = spawnRamp(s, 0)
          s += rngRange(rng, 4, 12)
          continue
        } else if (roll < 0.6) {
          // 작은 바위 / 나무 기둥 — 좌우 한쪽만 (통과 틈 ≥1.5m 보장)
          const side = rng() < 0.5 ? -1 : 1
          const isRock = rng() < 0.55
          const v = rng() * 0.3 // 작은 바위만 (큰 바위는 좁은 트레일 봉쇄)
          const hw = isRock ? 0.675 * (0.7 + v * 0.7) : 0.4
          const hd = isRock ? 0.6525 * (0.7 + v * 0.7) : 0.4
          out.push({
            kind: isRock ? 'rock' : 'trunk',
            // 하한 0.85 — 중앙 직진 라인(±0.4)은 항상 열어둠 (좁은 트레일 억까 방지)
            s, x: side * rngRange(rng, 0.85, Math.max(0.9, DIRT_TRAIL_HALF - hw - 0.15)),
            halfW: hw, halfD: hd,
            vs: 0, passed: false, gone: false, variant: v,
          })
        } else if (roll < 0.7) {
          this.pushItem(rng, out, s, itemHalfX)
        } else if (roll < 0.78) {
          pushRing(s, 0, false)
        } else if (roll < 0.86) {
          // 물웅덩이 — 좁게
          out.push({
            kind: 'puddle', s, x: rngRange(rng, -1.1, 1.1), halfW: 1.0, halfD: 1.4,
            vs: 0, passed: false, gone: false, variant: rng(),
          })
        } else {
          // 나무 슬라럼 — 기둥 3개 지그재그 (MTB "나무 피하기" 리듬)
          let side: -1 | 1 = rng() < 0.5 ? -1 : 1
          for (let i = 0; i < 3; i++) {
            const ps = s + i * 16
            if (!inTunnelZone(ps) && !inLandingZone(ps)) {
              out.push({
                kind: 'trunk', s: ps, x: side * 1.0, halfW: 0.4, halfD: 0.4,
                vs: 0, passed: false, gone: false, variant: rng(),
              })
            }
            side = (side * -1) as -1 | 1
          }
          s += 32
        }
        s += rngRange(rng, 18, 30)
      }
      // 칩 라인 — 좁은 웨이브 (마지막 30% 골드)
      if (rng() < 0.75 && !inTunnelZone(s0 + 30)) {
        const cs = s0 + rngRange(rng, 6, CHUNK_LEN - 30)
        const cx = rngRange(rng, -0.9, 0.9)
        const phase = rng() * Math.PI * 2
        const goldTail = rng() < 0.3
        for (let i = 0; i < 6; i++) {
          out.push({
            kind: goldTail && i === 5 ? 'goldchip' : 'chip',
            s: cs + i * 4,
            x: Math.max(-1.5, Math.min(1.5, cx + Math.sin(phase + i * 0.7) * 0.55)),
            halfW: 0.55, halfD: 0.55,
            vs: 0, passed: false, gone: false, variant: rng(),
          })
        }
      }
      return out
    }

    // 첫 차량 보장 — 240~300m 트럭 1대 (~13초). 흙길은 위 전용 브랜치에서 이미 반환(차 원천 차단)
    if (s0 === 4 * CHUNK_LEN) {
      spawnVehicle(s0 + rngRange(rng, 6, 50))
    }
    // 첫 터보 보장 — 청크 6(360~420m)
    if (s0 === 6 * CHUNK_LEN) {
      const ts = s0 + rngRange(rng, 10, 44)
      if (!inTunnelZone(ts)) out.push({
        kind: 'turbo', s: ts, x: rngRange(rng, -3, 3) * dirtLane,
        halfW: 0.7, halfD: 0.7, vs: 0, passed: false, gone: false, variant: rng(),
      })
    }
    // 🌈 슈퍼부스트 — 아주 드물게 (진호 2026-07-07 "슈퍼부스트니까 빈도 많지 않게"). 720m 이후 청크당 3.5%
    //   (~1700m당 1개). 무적 관통템이라 흔하면 재미 반감 → 만나면 "잭팟" 느낌. 도로 브랜치 전용
    //   (흙길/러시존은 위에서 이미 return). 착지존/터널만 회피.
    if (s0 >= 12 * CHUNK_LEN && rng() < 0.035) {
      const ss = s0 + rngRange(rng, 8, CHUNK_LEN - 12)
      if (!inTunnelZone(ss) && !inLandingZone(ss)) {
        out.push({
          kind: 'superboost', s: ss, x: rngRange(rng, -2.6, 2.6),
          halfW: 0.8, halfD: 0.8, vs: 0, passed: false, gone: false, variant: rng(),
        })
      }
    }

    while (s < sEnd) {
      if (inTunnelZone(s)) { s += rowGap; continue }
      if (inLandingZone(s)) { s += Math.max(8, rowGap * 0.5); continue }
      const roll = rng()
      const urban = biome === 'city' || biome === 'cyber'
      const vehicleChance = (biome === 'mountain' ? 0.15 : biome === 'nature' ? 0.2 : 0.3 + diff * 0.18)
        * (mood === 'serene' ? 0.6 : 1)
      const rampChance = biome === 'mountain' ? 0.15 : biome === 'nature' ? 0.12 : 0.08
      const itemChance = s0 < 150 ? 0 : s0 < 900 ? 0.12 : 0.07
      const ringChance = mood === 'speedway' ? 0.1 : biome === 'cyber' ? 0.08 : 0.04
      const puddleChance = s0 < 300 ? 0 : 0.06
      const patternChance = mood === 'serene' ? 0.07 : 0.15
      let acc = vehicleChance
      if (roll < acc) {
        spawnVehicle(s)
        // 러시아워 더블 (도심/사이버)
        if (urban && diff > 0.28 && rng() < 0.45) {
          const vs2 = s + rngRange(rng, 13, 22)
          const lane2 = rng() < 0.5 ? 'left' as const : 'right' as const
          if (!inTunnelZone(vs2)) spawnVehicle(vs2, lane2)
        }
      } else if (roll < (acc += rampChance)) {
        s = spawnRamp(s)
        s += Math.max(13, rngRange(rng, rowGap * 0.75, rowGap * 1.3)) - Math.max(13, rowGap)
        continue
      } else if (roll < (acc += itemChance)) {
        this.pushItem(rng, out, s)
      } else if (roll < (acc += ringChance)) {
        pushRing(s, rngRange(rng, -2.4, 2.4), false)
      } else if (roll < (acc += puddleChance)) {
        pushPuddle(s)
      } else if (roll < (acc += patternChance)) {
        s = spawnPattern(s)
        s += rngRange(rng, 4, rowGap * 0.5)
        continue
      } else {
        // 정적 장애물 1~2개 — 한 행에서 도로 절반 이상은 항상 비움
        const a = pickStatic()
        const av = rng()
        const aSz = sizedStatic(a, av)
        const aSide = rng() < 0.5 ? -1 : 1
        const ax = aSide * rngRange(rng, aSz.halfW + 0.3, ROAD_HALF_W - aSz.halfW - 0.3)
        out.push({
          kind: a.kind, s, x: ax, halfW: aSz.halfW, halfD: aSz.halfD,
          vs: 0, passed: false, gone: false, variant: av,
        })
        if (diff > 0.12 && rng() < 0.5) {
          const b = pickStatic()
          const bv = rng()
          const bSz = sizedStatic(b, bv)
          const side = ax >= 0 ? -1 : 1
          const bx = side * rngRange(rng, bSz.halfW + 0.6, ROAD_HALF_W - bSz.halfW - 0.3)
          const bs = s + rngRange(rng, 0, 4)
          if (Math.abs(bx - ax) > aSz.halfW + bSz.halfW + 2.5 && !inTunnelZone(bs)) {
            out.push({
              kind: b.kind, s: bs, x: bx, halfW: bSz.halfW, halfD: bSz.halfD,
              vs: 0, passed: false, gone: false, variant: bv,
            })
          }
        }
      }
      // 행 간격 절대 하한 13m — 최고속(50m/s)에서도 반응 시간 0.26s+ 보장
      s += Math.max(13, rngRange(rng, rowGap * 0.75, rowGap * 1.3))
    }

    // 칩 라인 — 초반 프론트로드
    if (rng() < (s0 < 600 ? 0.85 : 0.5) && !inTunnelZone(s0 + 30)) {
      const count = 6
      const cs = s0 + rngRange(rng, 6, CHUNK_LEN - 30)
      const cx = rngRange(rng, -2.4, 2.4)
      const amp = rngRange(rng, 0.6, 1.8)
      const phase = rng() * Math.PI * 2
      // 라인 마지막 알 30% = 💰골드 (라인 끝까지 따라갈 이유 — 유저 피드백 ②)
      const goldTail = rng() < 0.3
      for (let i = 0; i < count; i++) {
        out.push({
          kind: goldTail && i === count - 1 ? 'goldchip' : 'chip',
          s: cs + i * 4,
          x: Math.max(-3.8, Math.min(3.8, cx + Math.sin(phase + i * 0.7) * amp)),
          halfW: 0.55, halfD: 0.55,
          vs: 0, passed: false, gone: false, variant: rng(),
        })
      }
    }

    return out
  }

  /** 아이템 스폰 (⚡터보 40% / 🧲마그넷 35% / 🛡실드 25%). halfX = 스폰 측면 폭 (흙길은 좁게) */
  private pushItem(rng: Rng, out: Obstacle[], s: number, halfX = 3.2): void {
    const roll = rng()
    const kind: Obstacle['kind'] = roll < 0.4 ? 'turbo' : roll < 0.75 ? 'magnet' : 'shield'
    out.push({
      kind,
      s,
      x: rngRange(rng, -halfX, halfX),
      halfW: 0.7, halfD: 0.7,
      vs: 0, passed: false, gone: false, variant: rng(),
    })
  }

  /** 소품 배치 — 테마별 밀도/종류 + 게이트/터널/가드레일/네온 (충돌 없음) */
  private buildProps(
    rng: Rng, s0: number, biome: BiomeId, curvature: number, tunnelS: number | null, gateS: number | null,
    mood: Mood = 'cruise',
  ): SceneryProp[] {
    const out: SceneryProp[] = []
    const push = (kind: SceneryProp['kind'], s: number, x: number, scale: number) => {
      out.push({ kind, s, x, scale, rotY: rng() * Math.PI * 2, variant: rng() })
    }

    if (gateS !== null) push('gate', gateS, 0, 1)
    if (tunnelS !== null) push('tunnel', tunnelS, 0, 1)

    // 🎉 러시 존 — 도로 양측 네온+램프 파티 라인 (유저 피드백 ⑬)
    if (mood === 'rush') {
      for (let s = s0 + 4; s < s0 + CHUNK_LEN; s += 8) {
        push('neon', s, ROAD_HALF_W + 1.4, 0.9)
        push('neon', s + 4, -(ROAD_HALF_W + 1.4), 0.9)
        push('lamp', s + 2, ROAD_HALF_W + 1.1, 1)
        push('lamp', s + 6, -(ROAD_HALF_W + 1.1), 1)
      }
    }

    // 커브 바깥 가드레일 기둥 (교외 테마, 곡률 충분할 때 — 흙길 MTB 파크엔 인공물 없음)
    if (biome !== 'city' && biome !== 'cyber' && biome !== 'dirt' && Math.abs(curvature) > 0.006) {
      const side = curvature > 0 ? -1 : 1
      for (let s = s0 + 3; s < s0 + CHUNK_LEN; s += 6) {
        push('guardrail', s, side * (ROAD_HALF_W + 0.7), 1)
      }
    }

    if (biome === 'mountain') {
      // 산길 — 소나무 숲 + 바위
      for (let s = s0; s < s0 + CHUNK_LEN; s += rngRange(rng, 5, 10)) {
        const side = rng() < 0.5 ? -1 : 1
        push('pine', s, side * rngRange(rng, ROAD_HALF_W + 2, ROAD_HALF_W + 16), rngRange(rng, 0.8, 1.7))
        if (rng() < 0.5) push('pine', s + 2, -side * rngRange(rng, ROAD_HALF_W + 3, ROAD_HALF_W + 18), rngRange(rng, 0.8, 1.6))
        if (rng() < 0.25) push('rock', s + 1, side * rngRange(rng, ROAD_HALF_W + 1.5, ROAD_HALF_W + 8), rngRange(rng, 0.5, 1.4))
      }
    } else if (biome === 'dirt') {
      // 숲속 흙길 — 능선(±3.6~6) 위 빽빽한 숲 + 버름 자갈. 절벽(|x|>6) 밖엔 소품 금지(공중부양)
      for (let s = s0; s < s0 + CHUNK_LEN; s += rngRange(rng, 3.5, 7)) {
        const side = rng() < 0.5 ? -1 : 1
        push('pine', s, side * rngRange(rng, 4.2, 5.9), rngRange(rng, 1.1, 1.9))
        push('tree', s + 2, -side * rngRange(rng, 4.2, 5.9), rngRange(rng, 0.9, 1.5))
        if (rng() < 0.5) push('bush', s + 1, side * rngRange(rng, 3.8, 5.2), rngRange(rng, 0.6, 1.2))
        // 자갈 — 버름 경사~꼭대기에 작은 돌 산개 (진호 "자갈 없는 너무 고운 흙")
        if (rng() < 0.85) push('rock', s + rngRange(rng, 0, 3), side * rngRange(rng, 2.0, 3.3), rngRange(rng, 0.07, 0.2))
        if (rng() < 0.65) push('rock', s + rngRange(rng, 1, 4), -side * rngRange(rng, 2.0, 3.3), rngRange(rng, 0.07, 0.18))
      }
    } else if (biome === 'nature') {
      // 자연 — 활엽수/덤불 풍성 + 간간이 소나무 (한낮 초원)
      for (let s = s0; s < s0 + CHUNK_LEN; s += rngRange(rng, 5, 11)) {
        const side = rng() < 0.5 ? -1 : 1
        push('tree', s, side * rngRange(rng, ROAD_HALF_W + 2, ROAD_HALF_W + 14), rngRange(rng, 0.9, 1.6))
        if (rng() < 0.6) push('bush', s + 2, -side * rngRange(rng, ROAD_HALF_W + 1.2, ROAD_HALF_W + 7), rngRange(rng, 0.6, 1.3))
        if (rng() < 0.35) push('bush', s + 4, side * rngRange(rng, ROAD_HALF_W + 1.2, ROAD_HALF_W + 6), rngRange(rng, 0.5, 1.0))
        if (rng() < 0.2) push('pine', s + 3, -side * rngRange(rng, ROAD_HALF_W + 4, ROAD_HALF_W + 16), rngRange(rng, 0.9, 1.5))
      }
    } else if (biome === 'city') {
      // 도심(저녁) — 빌딩 + 가로등, 네온은 드물게 (이격 5m+/스케일 ≤1.8 — 도로 걸침 방지)
      for (let s = s0; s < s0 + CHUNK_LEN; s += rngRange(rng, 9, 14)) {
        const rx = ROAD_HALF_W + rngRange(rng, 5, 9)
        const lx = -(ROAD_HALF_W + rngRange(rng, 5, 9))
        push('building', s, rx, rngRange(rng, 0.8, 1.8))
        push('building', s + rngRange(rng, 0, 5), lx, rngRange(rng, 0.8, 1.8))
        if (rng() < 0.2) push('neon', s + rngRange(rng, -2, 2), rx - 3.2, rngRange(rng, 0.7, 1.2))
      }
      for (let s = s0 + 8; s < s0 + CHUNK_LEN; s += 24) {
        const side = (Math.floor(s / 24) % 2 === 0) ? 1 : -1
        push('lamp', s, side * (ROAD_HALF_W + 1.1), 1)
      }
    } else {
      // 사이버(심야) — 빌딩 밀집 + 네온 잔뜩
      // ★빌딩 이격 5m+ / 스케일 ≤1.8 — 대형 빌딩이 커브 안쪽에서 도로를 걸치는 그림 방지 (진호 V16)
      for (let s = s0; s < s0 + CHUNK_LEN; s += rngRange(rng, 7, 11)) {
        const rx = ROAD_HALF_W + rngRange(rng, 5, 9)
        const lx = -(ROAD_HALF_W + rngRange(rng, 5, 9))
        push('building', s, rx, rngRange(rng, 1.0, 1.8))
        push('building', s + rngRange(rng, 0, 4), lx, rngRange(rng, 1.0, 1.8))
        if (rng() < 0.85) push('neon', s + rngRange(rng, -2, 2), rx - 3.2, rngRange(rng, 0.8, 1.5))
        if (rng() < 0.85) push('neon', s + rngRange(rng, 0, 5), lx + 3.2, rngRange(rng, 0.8, 1.5))
      }
      for (let s = s0 + 8; s < s0 + CHUNK_LEN; s += 20) {
        const side = (Math.floor(s / 20) % 2 === 0) ? 1 : -1
        push('lamp', s, side * (ROAD_HALF_W + 1.1), 1)
      }
    }
    return out
  }
}
