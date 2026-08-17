/**
 * 햅틱 SSOT (UI-HAPTIC-001) — ZINOSB lib/haptic 적응 이식 2026-08-09
 *
 * ★ 새로 발명하지 않았다. `features/life/games/useGameFeedback.ts` 가 이미 쓰고 있던
 *   feature-detect + 패턴 배열 방식을 라이브러리로 승격한 것이다(UI-ADOPT-001 "만들지 말고 옮겨라").
 *
 * 실측(2026-08-09): onClick 703건 · <button> 647건 인데 햅틱은 13건/4파일 = **3.5%**.
 *   전부 게임 안에만 있었고 SSOT 도 없었다.
 *
 * ⚠️ 웹(브라우저·PWA)에서는 `navigator.vibrate` 만 쓸 수 있고 **iOS Safari 는 미지원**이다.
 *   그래서 설계 원칙은 "없어도 동작에 지장 0" — 지원 여부를 **feature detect 로 먼저 확인**하고
 *   미지원이면 조용히 no-op 한다(try/catch 로 예외를 삼키는 방식이 아니다. 예외 처리는
 *   "실패했지만 일단 호출은 했다"는 뜻이고, 여기 필요한 건 "지원 안 하면 아예 안 부른다"이다).
 *
 * ★ 네이티브 앱(2026-08-18 추가) — Capacitor Haptics 로 간다.
 *   웹 진동은 "몇 ms 를 떨어라"는 저수준 명령이라 iOS 에는 아예 없지만, 네이티브 API 는
 *   **의미**(가벼운 탭 / 성공 / 실패)를 받아 OS 가 기종에 맞는 촉감으로 번역해 준다.
 *   그래서 iOS 에서도 비로소 햅틱이 생기고, 안드로이드에서도 기계적 진동 대신 시스템 촉감이 된다.
 *   패턴 배열(PATTERNS)은 웹 폴백 전용으로 남는다.
 *
 * ⚠️ 개별 버튼 703곳 배선은 이번 세션 범위 밖(진호 결정 2026-08-09).
 *   대신 **토스트가 자동 발화**하므로 성공/실패/경고 피드백은 배선 0으로 커버된다.
 *   → 호출부에서 토스트와 함께 햅틱을 중복 호출하지 말 것.
 *
 * 관련 룰: docs/rules/ui/design-system.md UI-HAPTIC-001
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativeApp } from '@/lib/native/platform'

/** 의미 단위 패턴 (ms) — **웹 폴백 전용**. 배열 = [진동, 정지, 진동, ...] */
const PATTERNS = {
  /** 가벼운 탭 — 탭 전환, 토글, 칩 선택 */
  light: 10,
  /** 주요 CTA — 저장, 제출 */
  medium: 20,
  /** 완료/성공 */
  success: [12, 40, 12],
  /** 주의 — 되돌릴 수 없는 확인 */
  warning: [18, 60, 18],
  /** 실패 */
  error: [30, 50, 30],
} as const

type HapticKind = keyof typeof PATTERNS

/**
 * 이 환경에서 촉각 피드백이 가능한가 — **호출 전에 먼저 묻는다**.
 * 네이티브 앱이면 항상 가능(OS 가 담당). 웹은 navigator.vibrate 유무로 판정하며,
 * iOS Safari 는 그게 없어 false 가 되고 아무 일도 일어나지 않는다.
 */
export function canVibrate(): boolean {
  if (isNativeApp()) return true
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  )
}

/**
 * 사용자가 모션 감소를 켰으면 진동도 하지 않는다.
 * train-dia 는 prefers-reduced-motion 을 **존중**하는 게 정책이다
 * (50~60대 + 야간근무 — ZINOSB 의 전면 미존중 정책은 이식하지 않음).
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** 의미 → 네이티브 촉감 매핑. impact = 물리적 탭, notification = 결과 알림. */
function fireNative(kind: HapticKind): void {
  switch (kind) {
    case 'light':
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      break
    case 'medium':
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
      break
    case 'success':
      Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      break
    case 'warning':
      Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
      break
    case 'error':
      Haptics.notification({ type: NotificationType.Error }).catch(() => {})
      break
  }
}

/** 내부 공용 — 지원/정책 확인 후에만 실제로 호출한다. */
function fire(kind: HapticKind): void {
  if (prefersReducedMotion()) return
  if (isNativeApp()) {
    fireNative(kind)
    return
  }
  if (!canVibrate()) return
  navigator.vibrate(PATTERNS[kind] as number | number[])
}

/** 가벼운 탭 — 탭 전환·토글·칩 선택 */
export const hapticLight = () => fire('light')
/** 주요 CTA — 저장·제출 */
export const hapticMedium = () => fire('medium')
/** 완료/성공 — 토스트가 자동 발화하므로 보통 직접 부를 일이 없다 */
export const hapticSuccess = () => fire('success')
/** 주의 — 되돌릴 수 없는 확인 */
export const hapticWarning = () => fire('warning')
/** 실패 — 토스트가 자동 발화 */
export const hapticError = () => fire('error')

/**
 * 진행 중 진동을 즉시 끊는다(화면 이탈 등).
 * 네이티브는 끊을 대상이 없다 — impact/notification 은 지속형이 아니라 순간 촉감이라
 * 발화 시점에 이미 끝나 있다. 그래서 웹 폴백에서만 의미가 있다.
 */
export function hapticCancel(): void {
  if (isNativeApp()) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(0)
}
