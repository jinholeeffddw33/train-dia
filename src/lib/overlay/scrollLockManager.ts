/**
 * 배경 스크롤 잠금 SSOT (참조 카운팅) — ZINOSB 이식 2026-08-18
 *
 * ── 왜 SSOT 가 필요한가 (train-dia 실측) ──
 * 모달 13곳이 **각자** 이 패턴을 갖고 있었다:
 *     const prev = document.body.style.overflow
 *     document.body.style.overflow = 'hidden'
 *     return () => { document.body.style.overflow = prev }
 * 하나만 열릴 때는 멀쩡하다. 겹치는 순간 무너진다:
 *   1) 모달 A 열림 → prev='' 저장, hidden
 *   2) A 위에 B 열림 → prev='hidden' **저장**, hidden
 *   3) A 가 먼저 닫힘 → '' 로 복원 → **B 가 떠 있는데 배경이 스크롤된다**
 *   4) B 닫힘 → 'hidden' 으로 복원 → **다 닫혔는데 화면이 영구히 얼어붙는다**
 * train-dia 에도 겹치는 자리가 실제로 있다(안전수칙 전체화면 → 첨부 라이트박스,
 * 설정 오버레이 → PIN 변경 모달). ZINOSB 는 이 사고를 두 번 겪고 나서야
 * "잠금 방식이 두 벌"이라는 근본을 고쳤다 — 여기서는 처음부터 하나로 간다.
 *
 * ── iOS Safari ──
 * `overflow: hidden` 만으로는 **iOS 에서 배경이 그대로 스크롤된다**.
 * position:fixed + top 오프셋으로 묶고, 풀 때 원래 위치로 scrollTo 복원한다.
 * (그래서 잠금/해제가 반드시 짝을 이뤄야 하고, 그 짝을 카운터가 보장한다)
 */

let lockCount = 0
let savedScrollY = 0

/** 지금 배경이 잠겨 있나 (오버레이가 하나라도 열려 있나) */
export function isScrollLocked(): boolean {
  return lockCount > 0
}

/** 디버그/테스트용 — 현재 잠금 깊이 */
export function getScrollLockDepth(): number {
  return lockCount
}

export function acquireScrollLock(): void {
  if (typeof document === 'undefined') return
  lockCount += 1
  if (lockCount > 1) return // 이미 잠겨 있다 — 카운트만 올린다

  savedScrollY = window.scrollY
  const body = document.body
  body.style.position = 'fixed'
  body.style.top = `-${savedScrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.overflow = 'hidden'
}

export function releaseScrollLock(): void {
  if (typeof document === 'undefined') return
  if (lockCount === 0) return // 짝이 안 맞는 해제 — 무시(음수로 내려가면 다음 잠금이 깨진다)
  lockCount -= 1
  if (lockCount > 0) return // 아직 다른 오버레이가 잠가두는 중

  const body = document.body
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.overflow = ''
  // 잠글 때 body 를 fixed 로 만들면서 잃어버린 스크롤 위치를 되돌린다
  window.scrollTo(0, savedScrollY)
}

/**
 * 테스트 전용 — 카운터와 body 를 초기 상태로 되돌린다.
 * (프로덕션 코드에서 부르지 말 것. 열려 있는 오버레이가 있어도 강제로 푼다)
 */
export function __resetScrollLockForTest(): void {
  lockCount = 0
  savedScrollY = 0
  if (typeof document === 'undefined') return
  const body = document.body
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.overflow = ''
}
