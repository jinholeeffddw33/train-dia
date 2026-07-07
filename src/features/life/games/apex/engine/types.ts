/**
 * APEX RUSH — 엔진 타입 정의
 * 시뮬레이션은 React 상태 밖(mutable)에서 60fps 고정 타임스텝으로 돈다.
 * 좌표계: s = 트랙 진행거리(m), x = 중심선 기준 측면 오프셋(m, +우측), z = 높이(m)
 */

// ── 바이옴(스테이지 테마) — V15 진호 확정 4종: 자연/도심/사이버 밤/산길 ──

export type BiomeId = 'mountain' | 'nature' | 'city' | 'cyber' | 'dirt'

export interface BiomePalette {
  /** 하늘 상단/지평선/하단 */
  skyTop: number
  skyHorizon: number
  skyBottom: number
  /** 포그 색 (지평선과 비슷하게) */
  fog: number
  /** 도로면 / 도로 라인 */
  road: number
  roadLine: number
  /** 도로 밖 지면(스커트) */
  ground: number
  /** 앰비언트/디렉셔널 라이트 색 */
  ambient: number
  sun: number
  /** 태양(하늘 디스크) 색 + 위치(방위각 0~1, 고도 0~1) */
  sunDisc: number
  sunAzimuth: number
  sunElevation: number
  /** 밤 강도 (별 페이드인, 0~1) */
  night: number
  /** 테마별 식생 색 — 소나무 잎(설산=눈), 활엽수 잎, 덤불 */
  leafPine: number
  leafTree: number
  bushCol: number
}

// ── 트랙 ──

/** 트랙 중심선 샘플 (2m 간격) */
export interface TrackSample {
  /** 월드 좌표 */
  px: number
  py: number
  pz: number
  /** 진행 방향 단위벡터 (수평면) */
  dirX: number
  dirZ: number
  /** 수평면 기준 좌→우 단위벡터 */
  rightX: number
  rightZ: number
  /** 이 지점 경사 (dy/ds, 음수 = 내리막) */
  grade: number
}

export type ObstacleKind =
  | 'rock'      // 바위 — 정적, 못 넘음
  | 'cone'      // 콘 — 정적, 좁음
  | 'barrier'   // 바리케이드 — 정적, 넓음
  | 'log'       // 통나무 — 정적, 도로 절반
  | 'barrel'    // 드럼통 — 정적 (장애물 다양화, 유저 피드백 ⑧)
  | 'crate'     // 나무 상자 — 정적 (장애물 다양화)
  | 'trunk'     // 나무 기둥 — 흙길 트레일 위 (MTB "나무 피하기", 못 넘음)
  | 'car'       // 세단 — 동적 (도로/도심)
  | 'truck'     // 트럭 — 동적, 길고 높음 (니어미스 보너스 ↑)
  | 'bus'       // 버스 — 동적, 최장 (니어미스 보너스 ↑↑)
  | 'ramp'      // 램프 — 밟으면 점프 (variant 티어: <0.5 일반 / <0.8 빅 / ≥0.8 초빅)
  | 'chip'      // 칩(수집품) — 점수
  | 'goldchip'  // 💰 골드 칩 — 고득점 (유저 피드백 ② "코인 한 종류라 재미없다")
  | 'turbo'     // ⚡ 아이템: 터보 (속도 급가속)
  | 'shield'    // 🛡 아이템: 실드 (10초 제한, 1회 충돌 방어)
  | 'magnet'    // 🧲 아이템: 마그넷 (칩 흡인)
  | 'superboost' // 🌈 아이템: 슈퍼부스트 (인스타 그라데이션 번개 — 무적 관통 + 최고 속도, 희귀)
  | 'puddle'    // 💧 물웅덩이/오일 — 밟으면 잠깐 미끄러움 (죽지 않는 기믹)
  | 'ring'      // ◎ 스피드 링 — 통과 시 보너스+부스트 (variant<0.5 지상 / ≥0.5 공중)

export type ItemKind = 'turbo' | 'shield' | 'magnet'

/** 🤸 에어트릭 — 큰 점프대(빅/초빅 램프)에서만 랜덤 자동 발동 (진호 2026-07-07)
 *  backflip = 뒤로 한바퀴 / whip = 프레임 옆 90°(앞바퀴 20°만) / tabletop = 옆으로 눕힘(핸들 살짝)
 *  tailwhip = 핸들 고정한 채 프레임이 한바퀴 / barspin = 핸들바(+앞포크·앞바퀴)만 한바퀴 (진호 2026-07-07) */
export type TrickKind = 'backflip' | 'whip' | 'tabletop' | 'tailwhip' | 'barspin'

export interface Obstacle {
  kind: ObstacleKind
  /** 트랙 진행거리 위치 (동적이면 갱신됨) */
  s: number
  /** 측면 오프셋 */
  x: number
  /** 충돌 반폭(측면) / 반깊이(진행방향) */
  halfW: number
  halfD: number
  /** 동적 속도 (m/s, s축. 마주오는 차량은 음수) */
  vs: number
  /** 공중 배치 높이 (m, 몸 중심 기준) — 빅점프 공중 코인용. 없으면 지상 */
  y?: number
  /** 니어미스 판정 완료 여부 */
  passed: boolean
  /** 수집/소멸 여부 (chip 수집, car 뒤로 지나감) */
  gone: boolean
  /** 렌더 변주 (색/스케일 시드) */
  variant: number
}

/** 소품 종류 (충돌 없음, 순수 비주얼) */
export type PropKind =
  | 'tree' | 'rock' | 'building' | 'lamp' | 'bush' | 'pine'
  | 'palm'      // 야자수 (해안 스테이지)
  | 'gate'      // 스테이지 경계 게이트 아치
  | 'tunnel'    // 바이옴 경계 터널 (통과 연출)
  | 'guardrail' // 커브 바깥 가드레일 기둥
  | 'neon'      // 도심 빌딩 네온 간판

export interface SceneryProp {
  kind: PropKind
  s: number
  x: number
  scale: number
  rotY: number
  variant: number
}

/** 트랙 청크 — CHUNK_LEN(m) 단위 절차 생성 */
export interface TrackChunk {
  index: number
  /** 시작 진행거리 */
  s0: number
  /** 중심선 샘플 (SAMPLES_PER_CHUNK + 1개, 끝점 = 다음 청크 시작점) */
  samples: TrackSample[]
  biome: BiomeId
  obstacles: Obstacle[]
  props: SceneryProp[]
}

// ── 시뮬레이션 상태 ──

export type GamePhase = 'ready' | 'playing' | 'crashing' | 'dead'

export interface SimState {
  phase: GamePhase
  /** 경과 시간 (s) */
  time: number
  /** 라이더 진행거리/측면/높이 */
  s: number
  x: number
  z: number
  /** 수직 속도 (점프) */
  vz: number
  /** 공중 여부 */
  airborne: boolean
  /** 현재 에어타임 (s) — 착지 시 AIR 점수로 환산 */
  airTime: number
  /** 크레스트 재발동 쿨다운 (s) — 같은 정점에서 연속 점프 방지 */
  crestCooldown: number
  /** 전진 속도 (m/s) */
  speed: number
  /** 니어미스 스피드 버스트 잔여 시간 */
  boostTimer: number
  /** ⚡ 터보 잔여 시간 (아이템) */
  turboTimer: number
  /** 🛡 실드 보유 여부 (1회 충돌 방어) */
  shield: boolean
  /** 🛡 실드 잔여 시간 (s) — 10초 제한 (유저 피드백 "무제한 = 사기템") */
  shieldTimer: number
  /** 🧲 마그넷 잔여 시간 */
  magnetTimer: number
  /** 💧 미끄럼 잔여 시간 (물웅덩이/오일 — 조향 감쇠) */
  slickTimer: number
  /** 🌈 슈퍼부스트 잔여 시간 (무적 관통 + 최고 속도 — 진호 2026-07-07) */
  superTimer: number
  /** 공중 조향 누적 (착지 시 |값| 크면 WHIP 트릭 판정) */
  airSteer: number
  /** 🤸 현재 에어트릭 (큰 점프대 자동 — null = 없음) */
  airTrick: TrickKind | null
  /** 트릭 경과 시간 + 예상 체공(트릭 진행도 = trickTime/trickDur) */
  trickTime: number
  trickDur: number
  /** 트릭 방향 (±1 — 윕/테이블탑 좌우) */
  trickDir: number
  /** 트릭 카메라/자전거 블렌드 (0~1 스무딩 — 트릭 중 자전거 전체 노출) */
  trickCam: number
  /** 🔥 피버 잔여 시간 (콤보 5 도달 시 발동 — 보너스 점수 2배) */
  feverTimer: number
  /** 마지막으로 알린 마일스톤 (m) */
  lastMilestone: number
  /** 현재 스테이지 (1부터) */
  stage: number
  /** 조향 목표 오프셋 (입력) */
  targetX: number
  /** 측면 이동 속도 (스프링) */
  vx: number
  /** 자전거 기울기 (-1 ~ 1) */
  lean: number
  /** 점수 요소 */
  distance: number
  score: number
  airScore: number
  chips: number
  nearMisses: number
  combo: number
  maxCombo: number
  comboTimer: number
  /** 죽음 연출 */
  crashTimer: number
  deathReason: string
  /** 최고 속도 (km/h 기록용) */
  maxSpeed: number
  /** 이번 프레임 이벤트 (렌더/사운드/HUD 소비 후 리셋) */
  events: SimEvents
}

export interface SimEvents {
  nearMiss: boolean
  /** 니어미스 순간의 배수 (플로팅 표시용) */
  nearMissCombo: number
  /** 초근접 니어미스 (INSANE — 점수 2배) */
  nearMissInsane: boolean
  /** 퍼펙트 랜딩 (내리막 정렬 착지) */
  perfectLand: boolean
  /** 피버 발동 */
  fever: boolean
  chip: boolean
  /** 칩 획득 시 실제 지급 점수 (콤보/피버 반영 — HUD "+N" 표시용, 유저 피드백 "점수 느는지 모르겠다") */
  chipScore: number
  /** 💰 골드 코인 지급액 (0 = 없음) — 대형 골드 팝업 전용 */
  goldScore: number
  jump: boolean
  /** 크레스트(언덕 정점) 자연 점프 */
  crest: boolean
  land: boolean
  /** 착지 에어 점수 (>0이면 표시) */
  landAirScore: number
  crash: boolean
  /** 아이템 획득 (null = 없음) */
  item: ItemKind | null
  /** ◎ 스피드 링 통과 */
  ring: boolean
  /** 💧 미끄럼 진입 (물웅덩이/오일) */
  puddle: boolean
  /** 실드로 충돌 방어함 */
  shieldBreak: boolean
  /** 🌈 슈퍼부스트 획득 (번개 픽업) */
  superboost: boolean
  /** 🌈 슈퍼부스트 무적으로 장애물 관통 파괴 (이번 프레임 1개 이상) */
  smash: boolean
  /** 윕 트릭 성공 (공중 좌우 흔들기 후 착지) */
  whip: boolean
  /** 🤸 에어트릭 발동 (큰 점프대 이륙 — HUD 텍스트) */
  trick: TrickKind | null
  /** 🤸 에어트릭 완주 착지 (보너스 + 텍스트) */
  trickLanded: TrickKind | null
  /** 마일스톤 도달 (0 = 없음, 값 = m) */
  milestone: number
  /** 바이옴 전환 발생 */
  biomeChanged: boolean
  /** 스테이지 진입 (0 = 없음, 값 = 새 스테이지 번호) */
  stageUp: number
}

/** 입력 상태 (포인터 → 시뮬레이션) */
export interface InputState {
  /** 드래그 중 여부 */
  active: boolean
  /** 이번 프레임 누적 드래그 델타 (도로폭 대비 정규화 값) */
  steerDelta: number
}

// ── 렌더 → 시뮬 결과 조회용 ──

/** 라이더의 월드 변환 (렌더러가 매 프레임 계산해 씀) */
export interface RiderWorld {
  px: number
  py: number
  pz: number
  /** 진행 방향 (수평) */
  dirX: number
  dirZ: number
  rightX: number
  rightZ: number
  grade: number
}
