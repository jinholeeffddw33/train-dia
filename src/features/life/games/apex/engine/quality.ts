/**
 * APEX RUSH — 품질 오토스케일
 * Slow Roads 교훈: 모바일 웹 55fps+ 유저는 절반뿐 — 측정해서 스스로 낮춘다.
 * 프레임타임 이동평균이 나쁘면 단계를 내리고, 충분히 좋으면 (히스테리시스) 올린다.
 */

export interface QualityLevel {
  /** devicePixelRatio 상한 */
  maxDpr: number
  /** 포그 시작/끝 (드로우 거리) */
  fogNear: number
  fogFar: number
  /** 소품 밀도 (1 = 전부, 0.5 = 절반 렌더) */
  propDensity: number
  /** 실시간 그림자 (저사양은 블롭 섀도만) */
  shadows: boolean
}

// DPR 상한 1.6 — 픽셀 부하가 프레임 예산의 지배 항 (프로파일: JS 3% vs 렌더/래스터 84%).
// 모션 중 3D 씬에서 1.6 vs 2.0 은 체감 차이가 거의 없고 픽셀 수는 36% 준다 (NEONLINE 1.5 상한과 동일 교훈)
// propDensity 격차 완화(0.8/0.6/0.45 → 0.85/0.72/0.6): 레벨 전환 시 한꺼번에 나타나거나
// 사라지는 소품 비율을 20~35% → 10~15% 로 줄여 "지형이 갑자기 바뀜" 체감 완화 (진호 실폰 제보).
export const QUALITY_LEVELS: QualityLevel[] = [
  { maxDpr: 1.6, fogNear: 70, fogFar: 300, propDensity: 1, shadows: true },    // 0 high
  { maxDpr: 1.4, fogNear: 60, fogFar: 240, propDensity: 0.85, shadows: true }, // 1 mid
  { maxDpr: 1.2, fogNear: 50, fogFar: 190, propDensity: 0.72, shadows: false }, // 2 low
  { maxDpr: 1.0, fogNear: 42, fogFar: 150, propDensity: 0.6, shadows: false }, // 3 potato
]

const SAMPLE_WINDOW = 50 // 프레임
const DOWNGRADE_MS = 22 // 평균 프레임타임 이 이상이면 하향 (≈45fps)
/** 상향 임계 — 60Hz vsync 바닥(16.7ms)보다 커야 60fps 안정 기기가 복귀 가능 (13.5 는 영구 강등 고정이었음) */
const UPGRADE_MS = 17.2
const UPGRADE_HOLD = 8 // 상향엔 연속 좋은 윈도우 n번 필요 (요요 방지)
/** 스파이크 클램프 — 탭 복귀/GC/셰이더 컴파일 1회가 허위 강등을 만들지 않게 */
const SAMPLE_CLAMP_MS = 50

export class QualityGovernor {
  level: number
  private acc = 0
  private count = 0
  private goodStreak = 0
  /** 레벨 변경 시 알림 (DPR 반영 등) */
  onChange: ((level: QualityLevel, index: number) => void) | null = null

  constructor(initialLevel = 1) {
    // 모바일은 중간에서 시작해 올라가는 게 첫인상에 안전
    this.level = initialLevel
  }

  get current(): QualityLevel {
    return QUALITY_LEVELS[this.level]
  }

  /** 측정 윈도우 리셋 (탭 복귀/레벨 전환 직후 오염 방지) */
  reset(): void {
    this.acc = 0
    this.count = 0
  }

  /** 매 렌더 프레임 호출 */
  sample(deltaMs: number): void {
    this.acc += Math.min(deltaMs, SAMPLE_CLAMP_MS)
    this.count += 1
    if (this.count < SAMPLE_WINDOW) return
    const avg = this.acc / this.count
    this.acc = 0
    this.count = 0

    if (avg > DOWNGRADE_MS && this.level < QUALITY_LEVELS.length - 1) {
      this.level += 1
      this.goodStreak = 0
      this.onChange?.(this.current, this.level)
      this.reset() // 전환 직후 스톨(리사이즈 등)이 다음 윈도우를 오염시켜 연쇄 강등되는 것 차단
    } else if (avg < UPGRADE_MS && this.level > 0) {
      this.goodStreak += 1
      if (this.goodStreak >= UPGRADE_HOLD) {
        this.level -= 1
        this.goodStreak = 0
        this.onChange?.(this.current, this.level)
        this.reset()
      }
    } else {
      this.goodStreak = 0
    }
  }
}
