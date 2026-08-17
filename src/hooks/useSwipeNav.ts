'use client';

import { useCallback, useRef } from 'react';

interface SwipeNavOptions {
  /** 가로 스와이프 확정 → 'next'(왼쪽으로 밀기) | 'prev'(오른쪽으로 밀기) */
  onSwipe: (dir: 'next' | 'prev') => void;
  /** 이 거리(px) 이상 가로로 밀어야 발동. 기본 60 */
  threshold?: number;
  /** 화면 좌우 끝 이 폭(px)에서 시작한 제스처는 무시 — iOS/안드로이드 시스템 엣지 제스처 양보. 기본 16 */
  edgeGuard?: number;
  /** false 면 리스너를 안 붙인다 — 오버레이가 화면을 덮은 동안 뒤 화면이 스와이프되는 것 방지. 기본 true */
  enabled?: boolean;
}

/**
 * 탭 가로 스와이프 내비게이션 — 본문을 좌우로 밀어 인접 탭으로 이동.
 *
 * 설계 원칙(스크롤을 절대 깨지 않는다):
 *  - 전부 passive 리스너 + preventDefault 안 함 → 세로 스크롤·본문 어떤 스크롤도 방해 0.
 *  - 판정은 touchend 에서만: 가로 이동이 세로보다 뚜렷하고 임계 넘을 때만 스와이프로 인정.
 *  - **가로 스크롤 자식 양보**: 터치가 가로 스크롤 가능한 요소(행로도·타임라인)에서 시작했고
 *    그 방향으로 더 스크롤할 여지가 있으면(시작 시점 기준) 탭 이동을 넘긴다.
 *    → "한 제스처 = 한 동작"(카루셀을 끝까지 민 뒤 다시 밀어야 탭이 넘어간다).
 *
 * 반환: container 에 부착할 콜백 ref.
 */
export function useSwipeNav({ onSwipe, threshold = 60, edgeGuard = 16, enabled = true }: SwipeNavOptions) {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  return useCallback((el: HTMLElement | null) => {
    if (!el || !enabled) return;
    const controller = new AbortController();
    const { signal } = controller;

    let sx = 0;
    let sy = 0;
    let active = false;
    let yieldLeft = false;   // 시작 시점: 가로 스크롤 자식이 왼쪽으로 더 갈 수 있나(오른쪽 스와이프 양보)
    let yieldRight = false;  // 시작 시점: 오른쪽으로 더 갈 수 있나(왼쪽 스와이프 양보)

    // 터치 지점에서 위로 올라가며 가장 가까운 가로 스크롤 요소를 찾는다(본문 루트까지).
    const findHScroller = (start: EventTarget | null): HTMLElement | null => {
      let node = start instanceof HTMLElement ? start : null;
      const stop = el.parentElement;
      while (node && node !== stop) {
        if (node.scrollWidth > node.clientWidth + 1) {
          const ox = getComputedStyle(node).overflowX;
          if (ox === 'auto' || ox === 'scroll') return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { active = false; return; }
      const t = e.touches[0];
      // 화면 좌우 끝에서 시작한 제스처는 시스템 뒤로/앞으로에 양보
      if (t.clientX < edgeGuard || t.clientX > window.innerWidth - edgeGuard) {
        active = false;
        return;
      }
      sx = t.clientX; sy = t.clientY; active = true;
      const hs = findHScroller(t.target);
      yieldLeft = !!hs && hs.scrollLeft > 0;
      yieldRight = !!hs && hs.scrollLeft + hs.clientWidth < hs.scrollWidth - 1;
    }, { passive: true, signal });

    el.addEventListener('touchend', (e) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < threshold) return;             // 너무 짧음
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) return;   // 세로가 우세 → 스크롤로 본다
      if (dx < 0 && yieldRight) return;                 // 왼쪽 스와이프인데 가로 스크롤 여지 → 양보
      if (dx > 0 && yieldLeft) return;                  // 오른쪽 스와이프인데 가로 스크롤 여지 → 양보
      onSwipeRef.current(dx < 0 ? 'next' : 'prev');
    }, { passive: true, signal });

    el.addEventListener('touchcancel', () => { active = false; }, { passive: true, signal });

    return () => controller.abort();
  }, [threshold, edgeGuard, enabled]);
}
