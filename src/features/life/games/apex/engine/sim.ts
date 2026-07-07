/**
 * APEX RUSH — 시뮬레이션 코어
 * React 밖에서 고정 타임스텝(60Hz)으로 돈다. 렌더러(useFrame)가 tick 을 호출하고
 * 결과를 메시에 직접 반영한다 (리렌더 0).
 */

import {
  START_SPEED, MAX_SPEED, SPEED_GAIN_PER_M,
  BOOST_SPEED_BONUS, BOOST_DURATION,
  GRADE_SPEED_FACTOR, GRADE_SPEED_LERP, HARD_SPEED_CAP,
  RAMP_TIER_VZ_MULT, RAMP_TIER_VZ_MAX,
  CREST_GRADE_DROP, CREST_MIN_SPEED, CREST_VZ_FACTOR,
  GOLD_CHIP_SCORE, WHIP_THRESHOLD, WHIP_SCORE, TRICK_SCORE,
  TURBO_DURATION, TURBO_SPEED_MULT, SHIELD_DURATION, MAGNET_DURATION, MAGNET_RADIUS,
  SUPERBOOST_DURATION, SUPERBOOST_SPEED_MULT, SUPERBOOST_SPEED_CAP, SMASH_SCORE,
  BIG_VEHICLE_NEAR_MULT, MILESTONE_STEP,
  INSANE_NEAR_GAP, NEAR_MISS_MIN_SPEED,
  FEVER_COMBO, FEVER_DURATION, FEVER_SCORE_MULT, FEVER_SPEED_BONUS,
  PERFECT_LAND_GRADE, PERFECT_LAND_SCORE, STAGE_CLEAR_BONUS,
  STEER_STIFFNESS, STEER_DAMPING, STEER_SENSITIVITY, AIR_STEER_FACTOR,
  GRAVITY, RAMP_VZ_BASE, RAMP_VZ_SPEED_FACTOR,
  RIDER_HALF_W, RIDER_HALF_D, NEAR_MISS_MARGIN, CLEAR_HEIGHT, RIDER_MAX_X,
  SCORE_PER_METER, NEAR_MISS_SCORE, CHIP_SCORE, COMBO_WINDOW, COMBO_MULT_MAX,
  AIR_SCORE_PER_SEC, CRASH_SLOWMO_DURATION, CRASH_TIMESCALE,
  CHUNK_LEN,
  SLICK_DURATION, SLICK_STEER_FACTOR, SLICK_DAMPING_FACTOR,
  DIRT_CENTRIFUGAL, DIRT_BERM_IN_X, DIRT_BERM_PUSH, DIRT_CLIFF_X, DIRT_MAX_X,
  DIRT_BANK_K, DIRT_CURVE_SLOW,
  RING_SCORE, RING_BOOST, RING_Y_LOW, RING_Y_HIGH, RING_PASS_DZ, RING_PASS_DX,
} from '../constants'
import { TrackBuilder, biomeAt, setThemeOrder, stageAt } from './track'
import type { InputState, ItemKind, Obstacle, SimEvents, SimState, TrickKind } from './types'

const FIXED_DT = 1 / 60
const MAX_FRAME_DT = 0.1 // 탭 전환 복귀 스파이크 방지

function freshEvents(): SimEvents {
  return {
    nearMiss: false, nearMissCombo: 0, nearMissInsane: false,
    perfectLand: false, fever: false, chip: false, chipScore: 0, goldScore: 0,
    jump: false, crest: false, land: false, landAirScore: 0,
    crash: false, item: null, ring: false, puddle: false,
    shieldBreak: false, whip: false, milestone: 0,
    biomeChanged: false, stageUp: 0,
    trick: null, trickLanded: null,
    superboost: false, smash: false,
  }
}

export function createSimState(): SimState {
  return {
    phase: 'ready',
    time: 0,
    s: 0, x: 0, z: 0, vz: 0,
    airborne: false, airTime: 0, crestCooldown: 0,
    speed: START_SPEED, boostTimer: 0,
    turboTimer: 0, shield: false, shieldTimer: 0, magnetTimer: 0, slickTimer: 0, superTimer: 0, feverTimer: 0,
    airSteer: 0,
    airTrick: null, trickTime: 0, trickDur: 0, trickDir: 1, trickCam: 0,
    lastMilestone: 0,
    stage: 1,
    targetX: 0, vx: 0, lean: 0,
    distance: 0, score: 0, airScore: 0,
    chips: 0, nearMisses: 0,
    combo: 0, maxCombo: 0, comboTimer: 0,
    crashTimer: 0, deathReason: '',
    maxSpeed: 0,
    events: freshEvents(),
  }
}

/** 렌더 보간용 포즈 — 고정 60Hz 스텝과 rAF(90/120Hz) 위상 어긋남 저더 제거 */
export interface RenderPose {
  s: number
  x: number
  z: number
  lean: number
  speed: number
}

const DEATH_LABEL: Record<string, string> = {
  rock: '바위 충돌',
  cone: '콘 충돌',
  barrier: '바리케이드 충돌',
  log: '통나무 충돌',
  barrel: '드럼통 충돌',
  crate: '나무상자 충돌',
  trunk: '나무 충돌',
  car: '차량 충돌',
  truck: '트럭 충돌',
  bus: '버스 충돌',
}

/** 램프 variant → 티어 (0 일반 / 1 빅 / 2 초빅) — track 인코딩과 동일 */
function rampTier(variant: number): 0 | 1 | 2 {
  return variant < 0.5 ? 0 : variant < 0.8 ? 1 : 2
}

/** 흙길 버름 상승 프로파일 — TrackMeshes DIRT_CROSS_SECTION(1.8→0 / 2.4→0.35 / 3.6→1.9)과
 *  동일 곡선. 라이더가 버름 표면에 정확히 붙는다 (뜨거나 파묻히지 않게). */
export function dirtBermLift(x: number): number {
  const ax = Math.abs(x)
  if (ax <= 1.8) return 0
  if (ax <= 2.4) return ((ax - 1.8) / 0.6) * 0.35
  return 0.35 + ((Math.min(ax, 3.6) - 2.4) / 1.2) * 1.55
}

export class ApexSim {
  readonly state: SimState
  readonly track: TrackBuilder
  private accumulator = 0
  private lastBiome: string
  /** 경사 반영 속도 (부드럽게 추적) */
  private gradeSpeed = START_SPEED
  /** 크레스트 감지용 직전 경사 */
  private prevGrade = -0.07
  /** 직전 스텝 포즈 (렌더 보간용) */
  private prevPose: RenderPose = { s: 0, x: 0, z: 0, lean: 0, speed: START_SPEED }
  /** 마지막 스텝 이후 경과 비율 (0~1) — getRenderPose 의 보간 계수 */
  private renderAlpha = 1

  constructor(seed: number) {
    this.state = createSimState()
    // 테마 순서 시드 셔플 — 트랙 생성 전에 확정해야 함 ("매 판 랜덤 코스")
    setThemeOrder(seed)
    this.track = new TrackBuilder(seed)
    this.track.update(0)
    this.lastBiome = biomeAt(0)
  }

  start(): void {
    this.state.phase = 'playing'
  }

  /**
   * 렌더 프레임마다 호출. 실제 시뮬은 고정 타임스텝으로 누적 실행.
   * @param rawDt 렌더 프레임 델타 (s)
   * @param input 이번 프레임 입력 (steerDelta 는 소비 후 리셋)
   */
  tick(rawDt: number, input: InputState): void {
    const st = this.state
    if (st.phase === 'ready' || st.phase === 'dead') return

    const dt = Math.min(rawDt, MAX_FRAME_DT)
    // 크래시 슬로모
    const timeScale = st.phase === 'crashing' ? CRASH_TIMESCALE : 1
    this.accumulator += dt * timeScale

    // 입력은 프레임 단위로 도착 → 첫 스텝에서 전부 소비
    let steer = input.steerDelta
    input.steerDelta = 0

    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT
      // 스텝 직전 포즈 스냅샷 — 렌더는 prev↔current 를 accumulator 비율로 보간
      // (보간 없으면 90/120Hz 화면에서 프레임당 스텝 수가 0,1,0,1 로 튀며 미세 저더)
      this.prevPose.s = st.s
      this.prevPose.x = st.x
      this.prevPose.z = st.z
      this.prevPose.lean = st.lean
      this.prevPose.speed = st.speed
      this.step(FIXED_DT, steer, input.active)
      steer = 0
    }
    this.renderAlpha = Math.min(1, this.accumulator / FIXED_DT)

    // 🤸 트릭 카메라 블렌드 — 렌더 프레임 기준(step 조기 return 무관). 트릭 활성 시 목표치로 스무딩,
    //   아니면 0(1인칭). 카메라(GameScene)·자전거(ApexBikeGLB) 공유.
    //   ★백플립/윕/테이블탑=1.0 (프레임이 크게 도는/눕는 기술 → 뒤+위 3인칭으로 전체 노출).
    //   ★테일휩/바스핀=0.5 (핸들·프레임이 발밑에서 도는 걸 라이더가 내려다보는 기술 → 1인칭 느낌 유지,
    //     반쯤만 물러남 — 진호 2026-07-07 "이 둘은 1인칭 느낌이 조금 있어야, 많이 바꾸진 말고").
    const trickTarget = st.airTrick && st.airborne && st.phase === 'playing'
      ? (st.airTrick === 'tailwhip' || st.airTrick === 'barspin' ? 0.5 : 1)
      : 0
    st.trickCam += (trickTarget - st.trickCam) * Math.min(1, 9 * dt)

    // 크래시 연출 타이머는 실시간 기준
    if (st.phase === 'crashing') {
      st.crashTimer += dt
      if (st.crashTimer >= CRASH_SLOWMO_DURATION) {
        st.phase = 'dead'
      }
    }
  }

  /** 렌더용 보간 포즈 — 카메라/라이더는 이걸 쓴다 (HUD 숫자는 state 그대로) */
  getRenderPose(out: RenderPose): RenderPose {
    const st = this.state
    const a = this.renderAlpha
    const p = this.prevPose
    out.s = p.s + (st.s - p.s) * a
    out.x = p.x + (st.x - p.x) * a
    out.z = p.z + (st.z - p.z) * a
    out.lean = p.lean + (st.lean - p.lean) * a
    out.speed = p.speed + (st.speed - p.speed) * a
    // 🏞 흙길 — 뱅크(도로면 기울기) + 버름 경사 위 상승 (카메라/자전거가 코너에서 눕는 면을 탄다)
    if (biomeAt(out.s) === 'dirt') {
      out.z += -out.x * this.bankSlopeAt(out.s) + dirtBermLift(out.x)
    }
    return out
  }

  /** 🏞 뱅크(수퍼엘리베이션) 기울기 — 4m 앞 방향과의 사잇각 기반. 우회전(+) = 왼쪽(바깥) 상승 */
  private bankSlopeAt(s: number): number {
    const a = this.track.sampleAt(s)
    const b = this.track.sampleAt(s + 4)
    const sinT = a.dirX * b.dirZ - a.dirZ * b.dirX
    return Math.max(-0.45, Math.min(0.45, (sinT / 4) * DIRT_BANK_K))
  }

  /** 렌더/HUD가 소비한 뒤 이벤트 플래그 리셋 */
  consumeEvents(): SimEvents {
    const ev = this.state.events
    this.state.events = freshEvents()
    return ev
  }

  private step(dt: number, steerDelta: number, steerActive: boolean): void {
    const st = this.state
    if (st.phase !== 'playing' && st.phase !== 'crashing') return
    st.time += dt

    // ── 속도 — 거리 상한 × 경사 배율 (오르막 감속·다운힐 폭발) ──
    const smpHere = this.track.sampleAt(st.s)
    const onDirt = biomeAt(st.s) === 'dirt'
    const bankSlope = onDirt ? this.bankSlopeAt(st.s) : 0
    if (st.phase === 'playing') {
      const distCap = Math.min(MAX_SPEED, START_SPEED + st.s * SPEED_GAIN_PER_M)
      // 오르막 감속 하한 0.55→0.78 — 유저 피드백 "업힐은 느려져서 재미없다" (빈도도 track 에서 축소)
      const gradeMult = Math.max(0.78, Math.min(1.4, 1 - smpHere.grade * GRADE_SPEED_FACTOR))
      // 🏞 흙길 코너 감속 — 곡률 비례 (직선 질주 ↔ 코너 브레이킹 리듬, 리얼 MTB)
      const curveMult = onDirt
        ? Math.max(0.62, 1 - Math.abs(bankSlope / DIRT_BANK_K) * DIRT_CURVE_SLOW)
        : 1
      const target = distCap * gradeMult * curveMult
      this.gradeSpeed += (target - this.gradeSpeed) * Math.min(1, GRADE_SPEED_LERP * dt)

      let spd = this.gradeSpeed
      if (st.turboTimer > 0) {
        spd *= TURBO_SPEED_MULT
        st.turboTimer = Math.max(0, st.turboTimer - dt)
      }
      // 🌈 슈퍼부스트 — 최강 배율(터보 대비 +20%). 무적이라 캡도 완화 (아래 st.speed)
      if (st.superTimer > 0) {
        spd *= SUPERBOOST_SPEED_MULT
        st.superTimer = Math.max(0, st.superTimer - dt)
      }
      if (st.boostTimer > 0) {
        spd += BOOST_SPEED_BONUS * Math.min(1, st.boostTimer / 0.4)
        st.boostTimer = Math.max(0, st.boostTimer - dt)
      }
      if (st.feverTimer > 0) {
        spd += FEVER_SPEED_BONUS
        st.feverTimer = Math.max(0, st.feverTimer - dt)
      }
      if (st.magnetTimer > 0) st.magnetTimer = Math.max(0, st.magnetTimer - dt)
      if (st.slickTimer > 0) st.slickTimer = Math.max(0, st.slickTimer - dt)
      // 🛡 실드 10초 만료 (유저 피드백 "무제한 = 사기템")
      if (st.shieldTimer > 0) {
        st.shieldTimer = Math.max(0, st.shieldTimer - dt)
        if (st.shieldTimer === 0) st.shield = false
      }
      // 절대 하드캡 — 조향 물리(정착 0.6s)가 감당 못 하는 속도 차단.
      //   슈퍼부스트 중엔 무적(충돌사 없음)이라 캡 완화해 폭발적 질주 허용.
      st.speed = Math.min(spd, st.superTimer > 0 ? SUPERBOOST_SPEED_CAP : HARD_SPEED_CAP)
      if (st.speed > st.maxSpeed) st.maxSpeed = st.speed
    } else {
      // 크래시 중 감속
      st.speed = Math.max(0, st.speed - 30 * dt)
    }

    // ── 크레스트 자연 점프 — 언덕 정점을 빠르게 넘으면 관성으로 뜬다 ──
    // ★거리 기반: 7m 뒤보다 지금이 더 가파른 내리막이면(정점 통과) 발사. 프레임당 검출은
    //   grade lerp 때문에 변화가 거의 0이라 죽어있었음 (플레이테스트 실측 6000m당 1회).
    if (st.phase === 'playing' && !st.airborne && st.crestCooldown <= 0) {
      const gradeBehind = this.track.sampleAt(Math.max(0, st.s - 7)).grade
      const gradeDrop = gradeBehind - smpHere.grade
      if (gradeDrop > CREST_GRADE_DROP && st.speed > CREST_MIN_SPEED) {
        st.airborne = true
        st.airTime = 0
        st.vz = Math.max(1.6, st.speed * CREST_VZ_FACTOR)
        st.crestCooldown = 0.8 // 같은 정점 재발동 방지
        st.events.crest = true
      }
    }
    if (st.crestCooldown > 0) st.crestCooldown = Math.max(0, st.crestCooldown - dt)
    this.prevGrade = smpHere.grade

    // 에어 트릭 — 공중 좌우 드래그 누적 = 착지 시 윕 판정 (백플립은 진호 결정으로 제거)
    if (st.phase === 'playing' && st.airborne) st.airSteer += Math.abs(steerDelta)

    // ── 🏞 흙길(MTB 파크) 뱅크 물리 — 원심력이 바깥으로 밀고, 뱅크/버름이 받아준다 ──
    if (onDirt && st.phase === 'playing' && !st.airborne) {
      // 우회전(+)이면 관성은 왼쪽(바깥, -x)으로. 뱅크 위(같은 방향 기울면)에선 원심 30% 상쇄
      const curvPerM = bankSlope / DIRT_BANK_K
      const bankAssist = Math.sign(-curvPerM) === Math.sign(st.x) ? 0.7 : 1
      st.targetX -= curvPerM * st.speed * st.speed * DIRT_CENTRIFUGAL * bankAssist * dt
      // 버름 복원 — 뱅크 경사에 올라타면 트레일 안쪽으로 되밀어줌 (뱅크 타기).
      // 원심력이 이걸 이기면 계속 밀려 → 절벽 (진호 "곡면 못 타면 절벽으로")
      if (Math.abs(st.x) > DIRT_BERM_IN_X) {
        const depth = Math.min(1, (Math.abs(st.x) - DIRT_BERM_IN_X) / (DIRT_CLIFF_X - DIRT_BERM_IN_X))
        st.targetX -= Math.sign(st.x) * DIRT_BERM_PUSH * depth * dt
      }
    }
    // 흙길은 버름 꼭대기까지 이동 허용 (그 밖 = 절벽)
    const maxX = onDirt ? DIRT_MAX_X : RIDER_MAX_X

    // ── 조향 (스프링 추적) — 💧미끄럼 중엔 조향이 잘 안 먹는다 (죽지 않는 기믹) ──
    // 흙길은 이동 폭이 절반 이하 — 같은 드래그로 절반만 움직여야 정밀 라인 조준이 가능
    const steerFactor = (st.airborne ? AIR_STEER_FACTOR : 1)
      * (st.slickTimer > 0 ? SLICK_STEER_FACTOR : 1)
      * (onDirt ? 0.45 : 1)
    st.targetX += steerDelta * STEER_SENSITIVITY * (RIDER_MAX_X * 2) * steerFactor
    if (st.targetX > maxX) st.targetX = maxX
    if (st.targetX < -maxX) st.targetX = -maxX
    // 드래그 안 하는 동안엔 현재 위치 유지 (targetX 를 x 로 끌어당김 — 관성 여운)
    if (!steerActive) {
      st.targetX += (st.x - st.targetX) * Math.min(1, 6 * dt)
    }

    // 💧 미끄럼 중엔 감쇠도 절반 — 관성으로 옆으로 흐르는 진짜 미끄러짐 체감
    const damping = STEER_DAMPING * (st.slickTimer > 0 ? SLICK_DAMPING_FACTOR : 1)
    const ax = (st.targetX - st.x) * STEER_STIFFNESS - st.vx * damping
    st.vx += ax * dt
    st.x += st.vx * dt
    if (st.x > maxX) { st.x = maxX; st.vx = Math.min(0, st.vx) }
    if (st.x < -maxX) { st.x = -maxX; st.vx = Math.max(0, st.vx) }

    // 🏞 절벽 낙사 — 버름 꼭대기를 넘어가면 트레일 밖으로 추락 (흙길 전용). 슈퍼부스트=무적 예외
    if (st.superTimer <= 0 && onDirt && st.phase === 'playing' && !st.airborne && Math.abs(st.x) > DIRT_CLIFF_X) {
      st.phase = 'crashing'
      st.crashTimer = 0
      st.deathReason = '절벽 추락'
      st.events.crash = true
      return
    }

    // 자전거 린 (측면 속도 비례 + 부드럽게). 미끄럼 중엔 워블, 뱅크/버름 위에선 코너 안쪽으로 기움
    const wobble = st.slickTimer > 0 ? Math.sin(st.time * 17) * 0.22 : 0
    const bermLean = onDirt && Math.abs(st.x) > DIRT_BERM_IN_X
      ? -Math.sign(st.x) * Math.min(1, (Math.abs(st.x) - DIRT_BERM_IN_X) / 1.8) * 0.5
      : 0
    const bankLean = onDirt ? bankSlope * 1.2 : 0
    const targetLean = Math.max(-1, Math.min(1, st.vx * 0.14 + wobble + bermLean + bankLean))
    st.lean += (targetLean - st.lean) * Math.min(1, 10 * dt)

    // ── 전진 + 마일스톤 ──
    if (st.phase === 'playing') {
      st.s += st.speed * dt
      st.distance = st.s
      if (st.distance >= st.lastMilestone + MILESTONE_STEP) {
        st.lastMilestone += MILESTONE_STEP
        st.events.milestone = st.lastMilestone
      }
    }

    // ── 점프/중력 ──
    if (st.airborne) {
      st.vz -= GRAVITY * dt
      st.z += st.vz * dt
      st.airTime += dt
      if (st.airTrick) st.trickTime += dt
      if (st.z <= 0) {
        st.z = 0
        st.vz = 0
        st.airborne = false
        const gained = Math.round(st.airTime * AIR_SCORE_PER_SEC)
        st.airScore += gained
        st.events.land = true
        st.events.landAirScore = gained
        // 퍼펙트 랜딩 — 내리막에 정렬 착지 = 보너스 + 콤보 + 부스트 (에어를 보상으로)
        if (st.airTime > 0.25 && smpHere.grade < PERFECT_LAND_GRADE) {
          this.addBonus(PERFECT_LAND_SCORE * Math.max(1, st.combo))
          this.bumpCombo()
          st.boostTimer = BOOST_DURATION
          st.events.perfectLand = true
        }
        // 🤸 에어트릭(큰 점프대) 완주 착지 — 보너스 + 콤보 + 부스트 (진호 2026-07-07)
        if (st.airTrick) {
          this.addBonus(TRICK_SCORE)
          this.bumpCombo()
          st.boostTimer = BOOST_DURATION
          st.events.trickLanded = st.airTrick
          st.airTrick = null
          st.trickTime = 0
        } else if (st.airTime > 0.25 && st.airSteer > WHIP_THRESHOLD) {
          // 윕 트릭(수동 드래그) — 트릭 없는 일반/크레스트 점프에서만 (유저 피드백 ⑥)
          this.addBonus(WHIP_SCORE)
          this.bumpCombo()
          st.events.whip = true
        }
        st.airSteer = 0
        st.airTime = 0
      }
    }

    // ── 거리 점수 ──
    if (st.phase === 'playing') {
      st.score = Math.floor(st.distance * SCORE_PER_METER)
        + st.airScore
        + this.bonusScore
    }

    // ── 콤보 타이머 ──
    if (st.combo > 0) {
      st.comboTimer -= dt
      if (st.comboTimer <= 0) {
        st.combo = 0
        st.comboTimer = 0
      }
    }

    // ── 트랙 스트리밍 + 스테이지 전환 감지 (게이트 통과 = 보너스 + 연출) ──
    this.track.update(st.s)
    const stage = stageAt(st.s)
    if (stage !== st.stage) {
      st.stage = stage
      st.events.stageUp = stage
      if (st.phase === 'playing') this.addBonus(STAGE_CLEAR_BONUS)
    }
    const biome = biomeAt(st.s)
    if (biome !== this.lastBiome) {
      this.lastBiome = biome
      st.events.biomeChanged = true
    }

    // ── 장애물 ──
    if (st.phase === 'playing') this.updateObstacles(dt)
  }

  /** 니어미스/칩/에어 보너스 누적 (distance 점수와 분리 관리) */
  private bonusScore = 0

  /** 보너스 점수 지급 — 피버 중엔 2배. 실제 지급액 반환 (HUD 팝업용) */
  private addBonus(amount: number): number {
    const gained = this.state.feverTimer > 0 ? amount * FEVER_SCORE_MULT : amount
    this.bonusScore += gained
    return gained
  }

  /** 콤보 +1 — FEVER_COMBO 도달 순간 피버 발동 */
  private bumpCombo(): void {
    const st = this.state
    const before = st.combo
    st.combo = Math.min(COMBO_MULT_MAX, st.combo + 1)
    if (st.combo > st.maxCombo) st.maxCombo = st.combo
    st.comboTimer = COMBO_WINDOW
    if (before < FEVER_COMBO && st.combo >= FEVER_COMBO && st.feverTimer <= 0) {
      st.feverTimer = FEVER_DURATION
      st.events.fever = true
    }
  }

  private updateObstacles(dt: number): void {
    const st = this.state
    const riderFront = st.s + RIDER_HALF_D
    const riderBack = st.s - RIDER_HALF_D

    // 라이더 주변 청크만 검사
    const centerIdx = Math.floor(st.s / CHUNK_LEN)
    for (let ci = centerIdx - 1; ci <= centerIdx + 2; ci++) {
      const chunk = this.track.getChunk(ci)
      if (!chunk) continue
      for (const ob of chunk.obstacles) {
        if (ob.gone) continue

        // 동적 장애물 이동
        if (ob.vs !== 0) {
          ob.s += ob.vs * dt
          // 라이더보다 한참 뒤로 가면 소멸
          if (ob.s < st.s - 60) { ob.gone = true; continue }
          // 🏞 숲속 흙길엔 차 없음 — 옆 스테이지에서 굴러들어온 차량은 경계에서 제거 (진호 "흙길에 차가 왜 다님")
          if (biomeAt(ob.s) === 'dirt') { ob.gone = true; continue }
        }

        const dS = ob.s - st.s
        // 검사 범위 밖
        if (dS < -12 || dS > 30) continue

        const overlapS = riderFront > ob.s - ob.halfD && riderBack < ob.s + ob.halfD
        const dx = Math.abs(st.x - ob.x)

        if (ob.kind === 'chip' || ob.kind === 'goldchip') {
          // 🧲 마그넷(또는 🌈슈퍼부스트=자동 자석) — 근처 칩을 라이더 라인으로 끌어당김. 슈퍼부스트는
          //   무적 질주라 반경 2배로 "다 끌어당김" (진호 2026-07-07). 공중 칩은 라인 유지(점프 조준 재미).
          const magR = st.superTimer > 0 ? MAGNET_RADIUS * 2 : MAGNET_RADIUS
          if (ob.y === undefined && (st.magnetTimer > 0 || st.superTimer > 0) && dS > -2 && dS < magR * 2 && Math.abs(st.x - ob.x) < magR) {
            ob.x += (st.x - ob.x) * Math.min(1, 12 * dt)
          }
          // 공중 칩(y 있음)은 몸 중심 높이 정합, 지상 칩은 기존 판정
          const heightOk = ob.y !== undefined
            ? Math.abs(st.z + 0.9 - ob.y) < 1.1
            : st.z < 1.2
          if (overlapS && dx < ob.halfW + RIDER_HALF_W && heightOk) {
            ob.gone = true
            st.chips += 1
            if (ob.kind === 'goldchip') {
              // 💰 골드 = 고정 +1000 (콤보 미적용, 피버 2배는 허용) — 대형 골드 팝업
              st.events.goldScore += this.addBonus(GOLD_CHIP_SCORE)
            } else {
              const mult = Math.max(1, Math.min(COMBO_MULT_MAX, st.combo))
              // 실제 지급액(피버 2배 포함)을 이벤트로 — HUD "+N" 팝업 (유저 피드백 "점수 느는지 모르겠다")
              st.events.chipScore += this.addBonus(CHIP_SCORE * mult)
            }
            st.events.chip = true
          }
          continue
        }

        // ── 💧 물웅덩이/오일 — 밟으면 잠깐 미끄러움 (죽지 않음, 1회 트리거) ──
        if (ob.kind === 'puddle') {
          if (!ob.passed && overlapS && dx < ob.halfW + RIDER_HALF_W && st.z < 0.4) {
            ob.passed = true
            st.slickTimer = SLICK_DURATION
            st.events.puddle = true
          }
          continue
        }

        // ── ◎ 스피드 링 — 몸 중심이 링 안을 지나면 보너스+부스트 ──
        if (ob.kind === 'ring') {
          if (overlapS && dx < RING_PASS_DX) {
            const ringY = ob.variant < 0.5 ? RING_Y_LOW : RING_Y_HIGH
            if (Math.abs(st.z + 0.9 - ringY) < RING_PASS_DZ) {
              ob.gone = true
              this.addBonus(RING_SCORE)
              st.boostTimer = Math.max(st.boostTimer, RING_BOOST)
              st.events.ring = true
            }
          }
          continue
        }

        // ── 🌈 슈퍼부스트 픽업 (희귀 — 무적 관통 + 최고 속도) ──
        if (ob.kind === 'superboost') {
          if (overlapS && dx < ob.halfW + RIDER_HALF_W && st.z < 1.8) {
            ob.gone = true
            st.superTimer = SUPERBOOST_DURATION
            st.events.superboost = true
          }
          continue
        }

        // ── 아이템 픽업 ──
        if (ob.kind === 'turbo' || ob.kind === 'shield' || ob.kind === 'magnet') {
          if (overlapS && dx < ob.halfW + RIDER_HALF_W && st.z < 1.6) {
            ob.gone = true
            const kind = ob.kind as ItemKind
            if (kind === 'turbo') st.turboTimer = TURBO_DURATION
            else if (kind === 'magnet') st.magnetTimer = MAGNET_DURATION
            else if (kind === 'shield') {
              if (st.shield) this.addBonus(250) // 중복 실드 = 보너스 점수 + 타이머 리필
              st.shield = true
              st.shieldTimer = SHIELD_DURATION // 10초 제한 (진호 2026-07-07)
            }
            st.events.item = kind
          }
          continue
        }

        if (ob.kind === 'ramp') {
          if (overlapS && dx < ob.halfW + RIDER_HALF_W && !st.airborne) {
            // 티어별 발사력 (일반/빅/초빅 — 유저 피드백 ⑤ "체공 길게, 하늘에서 코인")
            const tier = rampTier(ob.variant)
            st.airborne = true
            st.airTime = 0
            st.vz = Math.min(
              (RAMP_VZ_BASE + st.speed * RAMP_VZ_SPEED_FACTOR) * RAMP_TIER_VZ_MULT[tier],
              RAMP_TIER_VZ_MAX[tier],
            )
            st.events.jump = true
            // 🤸 큰 점프대(빅/초빅)면 랜덤 에어트릭 자동 발동 (진호 2026-07-07 "실제 MTB 에어트릭 3종").
            //   일반 점프대(tier0)·크레스트는 트릭 없음. 체공(2vz/g)을 트릭 진행 총시간으로.
            if (tier >= 1) {
              const kinds: TrickKind[] = ['backflip', 'whip', 'tabletop', 'tailwhip', 'barspin']
              st.airTrick = kinds[Math.floor(Math.random() * kinds.length)]
              st.trickDir = Math.random() < 0.5 ? -1 : 1
              st.trickTime = 0
              st.trickDur = Math.max(0.5, (2 * st.vz) / GRAVITY)
              st.events.trick = st.airTrick
            }
          }
          continue
        }

        // ── 충돌 장애물 ──
        const clearH = CLEAR_HEIGHT[ob.kind] ?? 1
        if (overlapS && dx < ob.halfW + RIDER_HALF_W && st.z < clearH) {
          if (st.superTimer > 0) {
            // 🌈 슈퍼부스트 무적 — 장애물을 관통 파괴 (부서지는 연출 + 소소한 보너스, 진호 2026-07-07)
            ob.gone = true
            this.addBonus(SMASH_SCORE)
            st.events.smash = true
            continue
          }
          if (st.shield) {
            // 🛡 실드 — 1회 방어: 장애물 파괴 + 감속 + 계속 주행
            st.shield = false
            st.shieldTimer = 0
            ob.gone = true
            this.gradeSpeed *= 0.72
            st.events.shieldBreak = true
            continue
          }
          // 충돌 → 크래시
          st.phase = 'crashing'
          st.crashTimer = 0
          st.deathReason = DEATH_LABEL[ob.kind] ?? '충돌'
          st.events.crash = true
          return
        }

        // ── 니어미스: 장애물을 방금 지나쳤고, 아슬한 거리였다 (속도 게이트 + 근접 2등급) ──
        if (!ob.passed && ob.s + ob.halfD < riderBack) {
          ob.passed = true
          const passDx = Math.abs(st.x - ob.x)
          const nearGap = passDx - (ob.halfW + RIDER_HALF_W)
          if (
            nearGap >= 0 && nearGap < NEAR_MISS_MARGIN
            && st.z < (CLEAR_HEIGHT[ob.kind] ?? 1)
            && st.speed >= NEAR_MISS_MIN_SPEED
          ) {
            st.nearMisses += 1
            this.bumpCombo()
            st.boostTimer = BOOST_DURATION
            // 트럭/버스 스릴 가중 + 초근접(INSANE) 2배
            const bigMult = ob.kind === 'truck' || ob.kind === 'bus' ? BIG_VEHICLE_NEAR_MULT : 1
            const insane = nearGap < INSANE_NEAR_GAP
            this.addBonus(NEAR_MISS_SCORE * st.combo * bigMult * (insane ? 2 : 1))
            st.events.nearMiss = true
            st.events.nearMissCombo = st.combo
            st.events.nearMissInsane = insane
          }
        }
      }
    }
  }
}
