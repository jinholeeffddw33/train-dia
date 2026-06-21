'use client'

import { useEffect } from 'react'

/**
 * GlassTapSweep — 눌림 + 빛 sweep 컨트롤러 (2026-06-21 진호 directive, 2026-06-21 스코프 정정).
 *
 * ★ opt-in 전용: "모든 버튼"이 아니라 *명시 지정한 라이즈드(튀어나온) 라벨/칩 + 마이페이지 메뉴 박스*에만.
 *   백버튼·CTA·아이콘버튼 등 다른 디자인은 제외(진호: "그 외는 다른 디자인이라 일단 빼, 나중에 순차적으로").
 *   적용 = 요소에 `data-press` 속성(또는 글로벌 `.z-glass-pill`/`.z-glass-jewel` 클래스).
 *
 * 동작 (document 위임 1개):
 *  - pointerdown: 매칭 요소에 `.z-pressing`(살짝 가라앉고 어두워짐) + `.tap-flash` 오버레이 1회 주입 + `.z-sweeping` 좌→오 광띠.
 *  - 광띠는 누르는 시간 무관 끝까지 재생(animationend 에 제거 → 재탭 재시작).
 *  - pointerup/cancel/lostpointercapture: 눌렀던 요소 `.z-pressing` 해제(추적 변수로 손 밖 이탈도 확실히).
 *
 * 제외: `[data-no-press]`(눌림 전체 끔), `[data-no-sweep]`(sweep만), 비활성/스위치/체크박스/라디오.
 */
const PRESS_SELECTOR = '[data-press], .z-glass-pill, .z-glass-jewel'
const EXCLUDE_MATCH =
  '[data-no-press], [aria-disabled="true"], [role="switch"], [role="checkbox"], [role="radio"]'
const SWEEP_ANIM = 'z-tap-sweep'

export default function GlassTapSweep() {
  useEffect(() => {
    let pressed: HTMLElement | null = null

    function resolve(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null
      const el = target.closest(PRESS_SELECTOR) as HTMLElement | null
      if (!el) return null
      if ((el as HTMLButtonElement).disabled) return null
      if (el.matches(EXCLUDE_MATCH) || el.closest('[data-no-press]')) return null
      return el
    }

    function onDown(e: PointerEvent) {
      const el = resolve(e.target)
      if (!el) return
      pressed = el
      el.classList.add('z-pressing')

      if (el.hasAttribute('data-no-sweep')) return
      // sweep 오버레이는 위치 컨텍스트 필요 — static 이면 relative 부여(이동 없음)
      const cs = getComputedStyle(el)
      if (cs.position === 'static') el.style.position = 'relative'
      let flash = el.querySelector(':scope > .tap-flash')
      if (!flash) {
        flash = document.createElement('span')
        flash.className = 'tap-flash'
        flash.setAttribute('aria-hidden', 'true')
        el.appendChild(flash) // 마지막 자식(절대배치·pointer-events:none) — 레이아웃/리액트 영향 없음
      }
      el.classList.remove('z-sweeping')
      void el.offsetWidth // reflow → 재탭 시 애니 재시작
      el.classList.add('z-sweeping')
    }

    function clearPressed() {
      if (pressed) {
        pressed.classList.remove('z-pressing')
        pressed = null
      }
    }

    function onEnd(e: AnimationEvent) {
      if (e.animationName !== SWEEP_ANIM) return
      const t = e.target
      if (t instanceof Element) {
        const el = t.closest(PRESS_SELECTOR)
        el?.classList.remove('z-sweeping')
      }
    }

    // 롱프레스 시 링크 URL 미리보기/컨텍스트 메뉴 차단(진호: "버튼 꾹 누르면 링크 나와 없어보임").
    // 인터랙티브 요소에서만 — 본문 텍스트 선택/복사는 통과.
    const INTERACTIVE = 'a, button, [role="button"], [role="tab"], [role="menuitem"], [role="link"], nav, label, summary'
    function onContextMenu(e: MouseEvent) {
      const t = e.target
      if (t instanceof Element && t.closest(INTERACTIVE)) e.preventDefault()
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', clearPressed, true)
    document.addEventListener('pointercancel', clearPressed, true)
    document.addEventListener('lostpointercapture', clearPressed, true)
    document.addEventListener('animationend', onEnd, true)
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', clearPressed, true)
      document.removeEventListener('pointercancel', clearPressed, true)
      document.removeEventListener('lostpointercapture', clearPressed, true)
      document.removeEventListener('animationend', onEnd, true)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  return null
}
