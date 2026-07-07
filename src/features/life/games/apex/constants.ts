/**
 * APEX RUSH — 튜닝 상수 SSOT
 * 서버 안티치트(app/api/v1/game/scores)와 동기화되는 값은 주석에 표시.
 */

/** 서버 검증과 동기화 (scores route GAME_CONFIGS.apex-rush) */
export const APEX_GAME_ID = 'apex-rush'
export const APEX_GAME_VERSION = '1.0.0'
/** 서버 동기화: 최대 제출 거리 (m) — V2.2 30km→100km.
 *  30km 상한이 최상위 유저의 50km+ 완주 판(99만점)을 서버가 통째로 거부하던 버그 수정.
 *  게임엔 거리 하드캡이 없어 실력자는 30km 를 넘겨 달릴 수 있는데, 그 순간 판 전체가 날아갔다. */
export const APEX_MAX_DISTANCE = 100000
/**
 * 서버 동기화: score <= distance * 이 값.
 * V2.1 실측: 피버(×2)+INSANE(×2)+큰차(×2)+콤보8 니어미스 국소 최대 ~229/m,
 * 현실 상위 플레이 40~80/m — 150 은 정당 유저 여유 2배 + 치터 캡.
 */
export const APEX_SCORE_PER_METER_MAX = 150

// ── 트랙 ──

/** 청크 길이 (m) */
export const CHUNK_LEN = 60
/** 중심선 샘플 간격 (m) */
export const SAMPLE_STEP = 2
export const SAMPLES_PER_CHUNK = CHUNK_LEN / SAMPLE_STEP // 30
/** 도로 반폭 (m) — 라이더 이동 가능 범위 */
export const ROAD_HALF_W = 4.6
/** 라이더가 실제로 못 나가는 한계 (도로 가장자리 살짝 안) */
export const RIDER_MAX_X = ROAD_HALF_W - 0.55
/** 앞으로 유지할 청크 수 / 뒤로 유지할 청크 수 */
export const CHUNKS_AHEAD = 6
export const CHUNKS_BEHIND = 1

// ── 라이더 물리 ──

export const START_SPEED = 16 // m/s (진호 피드백: 초반 너무 느긋 → 상향)
/** 거리 기반 기본 속도 상한 — 경사 배율(×1.4)로 실효 ~50m/s 까지 오름 */
export const MAX_SPEED = 36 // m/s
/** 절대 하드캡 (~194km/h) — 조향 스프링(정착 0.6s)·최소 행간 10.5m 가 감당하는 물리 상한 */
export const HARD_SPEED_CAP = MAX_SPEED * 1.5
/** 거리→속도 상승 (m/s per m) — 2200m에서 최고속 도달 */
export const SPEED_GAIN_PER_M = (MAX_SPEED - START_SPEED) / 2200
/** 니어미스 스피드 버스트 */
export const BOOST_SPEED_BONUS = 4 // m/s
export const BOOST_DURATION = 1.6 // s
/** 경사→속도 배율: speed = base * (1 - grade * 이 값). 다운힐 -0.1 → +35%, 오르막 +0.06 → -21% */
export const GRADE_SPEED_FACTOR = 3.5
/** 경사 속도 추적 반응 (1/s) */
export const GRADE_SPEED_LERP = 1.6
/** 크레스트 자연 점프: 경사 급락 임계 (grade 감소량/물리스텝) + 최소 속도 */
// ★거리 기반 검출(7m 뒤 vs 현재 grade 차)로 변경 — 프레임당 검출은 lerp 때문에 거의 0이라
// 크레스트 점프가 6000m당 1회로 죽어있었음(플레이테스트 실측). 7m 창에선 크레스트 전환이 0.08~0.2.
export const CREST_GRADE_DROP = 0.05
export const CREST_MIN_SPEED = 20
/** 크레스트 점프 수직 속도 = 속도 × 이 값 (36m/s → vz 3.1 ≈ 0.6s 에어) */
export const CREST_VZ_FACTOR = 0.085

// ── 아이템 ──

/** ⚡ 터보: 지속(s) + 속도 배율 (1.65→1.35 — 급다운힐×터보 88m/s 폭주가 조향 물리를 초과했음. 최종 HARD_SPEED_CAP) */
export const TURBO_DURATION = 4
export const TURBO_SPEED_MULT = 1.35
/** 🌈 슈퍼부스트 (진호 2026-07-07 인스타 그라데이션 번개) — 무적 관통 + 자동 자석 + "기존 최강 부스트(터보)보다
 *  30% 더 빠르게". 무적이라 조향 물리 위험을 감수 가능 → 지속 중엔 하드캡을 1.5배 완화해 진짜 폭주감. 희귀 픽업(track).
 *  (진호 2026-07-07 상향: 5→7s, 20%→30%, 캡 1.25→1.5, 자동 자석) */
export const SUPERBOOST_DURATION = 7
export const SUPERBOOST_SPEED_MULT = TURBO_SPEED_MULT * 1.3 // 터보 1.35 × 1.3 = 1.755
export const SUPERBOOST_CAP_MULT = 1.5
/** 슈퍼부스트 중엔 무적이라 조향 물리 상한을 완화 (충돌사 없음) */
export const SUPERBOOST_SPEED_CAP = HARD_SPEED_CAP * SUPERBOOST_CAP_MULT
/** 슈퍼부스트 관통 파괴 1개당 소소한 점수 (부순 맛) */
export const SMASH_SCORE = 40
/** 🛡 실드: 지속(s) — 유저 피드백 "한번 먹으면 무제한 = 사기템" → 12초 제한 (진호 2026-07-07) */
export const SHIELD_DURATION = 12
/** 🧲 마그넷: 지속(s) + 흡인 반경(m) */
export const MAGNET_DURATION = 7
export const MAGNET_RADIUS = 4.2
/** 큰 차량(트럭/버스) 니어미스 점수 배율 */
export const BIG_VEHICLE_NEAR_MULT = 2
/** 초근접(INSANE) 니어미스 갭 (m) — 이내면 점수 2배 (Traffic Rider 근접 등급) */
export const INSANE_NEAR_GAP = 0.32
/** 니어미스 발동 최소 속도 (m/s) — 저속 알박기 방지 */
export const NEAR_MISS_MIN_SPEED = 17

// ── 피버 / 퍼펙트 랜딩 ──

/** 콤보 이 값 도달 순간 피버 발동 (Tiny Wings Fever 원형) */
export const FEVER_COMBO = 5
export const FEVER_DURATION = 8 // s
/** 피버 중 보너스 점수 배율 + 속도 가산 */
export const FEVER_SCORE_MULT = 2
export const FEVER_SPEED_BONUS = 1.5 // m/s
/** 퍼펙트 랜딩: 착지 지점 내리막 경사 임계 + 보너스 (Bike Unchained "내리막 착지" 원형) */
export const PERFECT_LAND_GRADE = -0.055
export const PERFECT_LAND_SCORE = 120
/** 측면 스프링 추적 (임계감쇠 근사) — V3: 더 즉각적인 반응 */
export const STEER_STIFFNESS = 58
export const STEER_DAMPING = 15.2
/** 드래그 감도 — 화면 폭 1.0 드래그 = 도로폭 * 이 배수 이동 (진호: "감도 적어" → 상향) */
export const STEER_SENSITIVITY = 3.1
/** 공중 조향 감쇠 */
export const AIR_STEER_FACTOR = 0.35
/** 중력 (점프) */
export const GRAVITY = 22 // m/s^2 (게임적 과장)
/** 램프 점프 초기 수직 속도 (속도 비례 가산, 상한 = 비행거리 폭주 방지) */
export const RAMP_VZ_BASE = 6.2
export const RAMP_VZ_SPEED_FACTOR = 0.09
export const RAMP_VZ_MAX = 10
/** 램프 티어 (유저 피드백 ⑤ "빅/초빅 점프대") — variant <0.5 일반 / <0.8 빅 / ≥0.8 초빅.
 *  vz 배율 + vz 상한 + 렌더/히트박스 스케일(연동 필수 — 히트박스·렌더 불일치 금지) */
export const RAMP_TIER_VZ_MULT = [1, 1.35, 1.75] as const
export const RAMP_TIER_VZ_MAX = [10, 13, 16] as const
export const RAMP_TIER_SCALE = [1, 1.35, 1.7] as const

// ── 에어 트릭 (유저 피드백 ⑥ — 백플립은 진호 결정으로 제거, 윕만 유지) ──

/** 윕: 공중 좌우 드래그 누적(정규화)이 이 값 넘고 착지하면 성공 */
export const WHIP_THRESHOLD = 0.5
export const WHIP_SCORE = 150

/** 🤸 에어트릭 (큰 점프대 = 빅/초빅 램프 tier≥1 에서만 자동 발동 — 진호 2026-07-07
 *  "백플립/윕/테이블탑 랜덤). 완주 착지 시 보너스 + 콤보. 회전 각도는 렌더(ApexBikeGLB)에서. */
export const TRICK_SCORE = 300

// ── 라이더 충돌 ──

// 시각 핸들바 반폭 ≈ 0.26(스케일 1.55) — 히트박스가 그보다 넓으면 "안 스쳤는데 죽음".
// 0.34→0.30 으로 좁혀 시각에 근접(약간의 안전 여유만). 니어미스 window 폭은 불변(NEAR_MISS_MARGIN).
export const RIDER_HALF_W = 0.30
export const RIDER_HALF_D = 0.9
/** 니어미스 판정 여유 (m) — 이 거리 안으로 스치면 니어미스 */
export const NEAR_MISS_MARGIN = 0.85
/** 점프로 넘을 수 있는 높이 기준 (z가 이 이상이면 통과) */
export const CLEAR_HEIGHT: Record<string, number> = {
  rock: 1.1,
  cone: 0.7,
  barrier: 1.0,
  log: 0.7,
  barrel: 1.0,
  crate: 1.0,
  trunk: 4.5, // 서있는 나무 — 사실상 못 넘음 (피해가는 장애물)
  car: 1.6,
  truck: 2.8,
  bus: 3.2,
}

// ── 기믹 (죽지 않는 다양성 — V15) ──

/** 💧 물웅덩이/오일 미끄럼: 지속(s) + 조향 효과 배율 + 감쇠 배율.
 *  유저 피드백 "미끌!인데 전혀 안 미끄러움" → 지속↑ + 조향 거의 잠금 + 감쇠 절반(관성으로 흐름) */
export const SLICK_DURATION = 1.4
export const SLICK_STEER_FACTOR = 0.12
export const SLICK_DAMPING_FACTOR = 0.5
/** ◎ 스피드 링: 보너스 점수 + 통과 부스트(s). 지상/공중 링 중심 높이(m) */
export const RING_SCORE = 150
export const RING_BOOST = 1.1
export const RING_Y_LOW = 1.5
export const RING_Y_HIGH = 2.9
/** 링 통과 판정 — 몸 중심(z+0.9)이 링 중심 ± 이 값 안 + 측면 |dx| 이내 */
export const RING_PASS_DZ = 1.25
export const RING_PASS_DX = 1.15

// ── 🏞 흙길(MTB 파크) 뱅크 물리 (진호 2026-07-07 "뱅크를 타야 돼, 못 타면 절벽") ──

/** 🏞 흙길 = 좁은 싱글트랙 (진호 "너무 넓어" — 도로 9.2m 대신 트레일 폭 ~3.6m) */
export const DIRT_TRAIL_HALF = 1.8
/** 원심 드리프트 계수 — 커브에서 라이더가 바깥으로 밀리는 세기 (v²×곡률 비례) */
export const DIRT_CENTRIFUGAL = 0.1
/** 버름 시작 x — 이 밖은 뱅크 경사면 */
export const DIRT_BERM_IN_X = 1.9
/** 버름 복원력 — 뱅크가 라이더를 트레일 안으로 되밀어주는 세기 (뱅크 타기) */
export const DIRT_BERM_PUSH = 3.4
/** 절벽 낙사 임계 — 이 밖으로 밀리면 추락 사망 */
export const DIRT_CLIFF_X = 3.2
/** 흙길 이동 허용 한계 (비-dirt 는 RIDER_MAX_X) */
export const DIRT_MAX_X = 3.4
/** 뱅크(수퍼엘리베이션) 기울기 계수 — 코너에서 도로면이 눕는 정도 (curv/m × K = slope) */
export const DIRT_BANK_K = 9
/** 코너 자동 감속 — 곡률 비례 속도 페널티 (실제 MTB 코너링) */
export const DIRT_CURVE_SLOW = 18

/** 마일스톤 간격 (m) */
export const MILESTONE_STEP = 500

// ── 점수 ──

export const SCORE_PER_METER = 10
export const NEAR_MISS_SCORE = 50
export const CHIP_SCORE = 20
/** 💰 골드 코인 — 고정 +1000 (콤보 미적용 — 진호 2026-07-07. 유저 피드백 ② "코인 한 종류라 재미없다") */
export const GOLD_CHIP_SCORE = 1000
/** 콤보 유지 시간 (s) */
export const COMBO_WINDOW = 4
/** 콤보 배수 상한 */
export const COMBO_MULT_MAX = 8
/** 에어 점수 = airTime(s) * 이 값 */
export const AIR_SCORE_PER_SEC = 120

// ── 죽음 연출 ──

export const CRASH_SLOWMO_DURATION = 0.9 // s (실시간)
export const CRASH_TIMESCALE = 0.22

// ── 바이옴 (거리 기반, 로테이션) ──

/**
 * 스테이지 시스템 — STAGE_LENGTH(m)마다 스테이지 업, 테마는 순환 (진호: "스테이지 1부터 무제한,
 * 난이도 무한 상승 금지"). V15 진호 확정 4테마: 자연/도심/사이버 밤/산길.
 * 실제 순서는 시드별 셔플 (track.setThemeOrder — "코스가 계속 랜덤").
 */
export const STAGE_LENGTH = 750
export const STAGE_THEMES: Array<'mountain' | 'nature' | 'city' | 'cyber' | 'dirt'> = [
  'mountain', // 산길 — 새벽 산악
  'nature',   // 자연 — 한낮 초원/숲
  'city',     // 도심 — 노을 도심
  'cyber',    // 사이버 미래도시 — 심야 네온
  // 'dirt' — 숲속 흙길 MTB 파크: 구현돼 있으나 보류 (진호 2026-07-07 "나중에". 여기 넣으면 부활)
]
/** 난이도 만렙 스테이지 — 스테이지 6부터 난이도 고정 (무한 상승 금지) */
export const STAGE_DIFF_CAP = 6
/** 스테이지 게이트 통과 보너스 */
export const STAGE_CLEAR_BONUS = 800
/** 바이옴 경계 팔레트 블렌딩 구간 (m) */
export const BIOME_BLEND = 140

// (XP/레벨/미션 시스템은 V13 에서 제거 — 진호 "이딴거 싹다 없애고 겁나 심플하게")
