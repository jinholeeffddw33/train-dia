'use client'

import { useEffect } from 'react'

/**
 * GlassTapSweep — 눌림 피드백 컨트롤러 (2026-06-21 진호 directive / 2026-06-22 근본 수정).
 *
 * ★ opt-in 전용: 명시 지정한 라이즈드 라벨/칩·마이페이지 메뉴 박스에만.
 *   적용 = 요소에 `data-press` 속성(또는 글로벌 `.z-glass-pill`/`.z-glass-jewel` 클래스).
 *
 * ⚠️ 2026-06-22 수정 — DOM 주입 제거:
 *   기존 버전은 pointerdown(capture)에서 버튼 안에 `.tap-flash` span 을 appendChild 하고
 *   `position` 인라인 변경 + 강제 reflow(`offsetWidth`)를 했다. 안드로이드 크롬에서 이 DOM/레이아웃
 *   교란이 뒤이은 `click` 을 취소시켜, "눌러도 모달이 안 닫히고 저장 안 됨"(교번비교 선택 완료 등)이
 *   발생했고, React 가 모르는 주입 노드가 언마운트와 충돌해 투명 잔상도 남았다.
 *   → 이제 DOM 을 일절 건드리지 않고 `.z-pressing` 클래스만 토글한다(순수 CSS 눌림). 클릭 안전.
 *
 * 동작 (document 위임 1개):
 *  - pointerdown: 매칭 요소에 `.z-pressing`(살짝 가라앉고 어두워짐) 부여.
 *  - pointerup/cancel/lostpointercapture: `.z-pressing` 해제.
 *
 * 제외: `[data-no-press]`, 비활성/스위치/체크박스/라디오.
 */
const PRESS_SELECTOR = '[data-press], .z-glass-pill, .z-glass-jewel'
const EXCLUDE_MATCH =
  '[data-no-press], [aria-disabled="true"], [role="switch"], [role="checkbox"], [role="radio"]'

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
      // 이전 눌림이 남아있으면 먼저 정리(연속 탭 안전)
      if (pressed && pressed !== el) pressed.classList.remove('z-pressing')
      pressed = el
      // ⚠️ DOM 주입/스타일 변경/reflow 금지 — 클래스만. (click 안전)
      el.classList.add('z-pressing')
    }

    function clearPressed() {
      if (pressed) {
        pressed.classList.remove('z-pressing')
        pressed = null
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
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', clearPressed, true)
      document.removeEventListener('pointercancel', clearPressed, true)
      document.removeEventListener('lostpointercapture', clearPressed, true)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  return null
}
