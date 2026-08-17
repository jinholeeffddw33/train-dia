'use client';

import { useCallback, useRef } from 'react';

interface SheetDragDismissOptions {
  /** 아래로 N px 이상 끌면 dismiss. 기본 80 */
  threshold?: number;
  onDismiss: () => void;
  /** 드래그 중 매 프레임 — dy(아래로 끈 px), sheetHeight. 배경 dim 을 시트 위치에 동기화할 때(선택). */
  onDragMove?: (dy: number, sheetHeight: number) => void;
  /** 손 뗐을 때 — dismissing(임계 초과로 닫힘) 여부. dim 마무리/복원 애니에 사용(선택). */
  onSettle?: (dismissing: boolean) => void;
}

/**
 * 바텀시트 표준 닫기 제스처 — ZINOSB SSOT 이식 (진호 2026-06-23 train-dia).
 *
 * "정석": 아래로 내리면 시트가 따라 내려가고, 충분히 내리면 닫힌다.
 * 드래그 소스(handleRef / bodyRef)와 움직일 대상(sheetRef) 분리. 데스크톱 마우스도 지원(핸들만).
 *
 * 두 가지 드래그 소스:
 *  - handleRef : 상단 손잡이. **언제나** 잡아 내리면 닫힌다(스크롤과 무관).
 *  - bodyRef   : 스크롤 본문. **맨 위(scrollTop≤0)에서 아래로** 끌 때만 닫기로 전환하고,
 *                그 외(위로/가로/스크롤 중간)에는 평범한 스크롤에 양보한다.
 *                → "시트 아무 곳이나 아래로 밀어서 닫기"가 스크롤을 깨지 않고 성립한다.
 *
 * 반환: { handleRef, sheetRef, bodyRef }.
 */
export function useSheetDragDismiss({ threshold = 80, onDismiss, onDragMove, onSettle }: SheetDragDismissOptions) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onDragMoveRef = useRef(onDragMove);
  onDragMoveRef.current = onDragMove;
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  const drag = useRef({ active: false, startY: 0, dy: 0 });

  const reset = useCallback((animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)' : 'none';
    el.style.transform = '';
  }, []);

  // ── 공용 드래그 코어(핸들·본문이 함께 씀) ──
  const begin = useCallback((startY: number) => {
    drag.current = { active: true, startY, dy: 0 };
  }, []);
  const move = useCallback((clientY: number) => {
    const d = drag.current;
    if (!d.active) return;
    // 아래로만 따라옴(위로 끌어도 안 올라감 — 단순 닫기 제스처).
    d.dy = Math.max(0, clientY - d.startY);
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${d.dy}px)`;
    onDragMoveRef.current?.(d.dy, sheet.offsetHeight);
  }, []);
  const end = useCallback(() => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const sheet = sheetRef.current;
    const dismissing = d.dy > threshold;
    onSettleRef.current?.(dismissing);
    if (dismissing) {
      if (sheet) {
        sheet.style.transition = 'transform 0.2s ease-in';
        sheet.style.transform = 'translateY(110%)';
      }
      const cb = onDismissRef.current;
      setTimeout(() => cb(), 180);
    } else {
      reset(true);
    }
  }, [threshold, reset]);

  // ── 손잡이: 언제나 드래그 소스 ──
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const controller = new AbortController();
    const { signal } = controller;

    // ── 터치 ──
    el.addEventListener('touchstart', (e) => begin(e.touches[0].clientY), { passive: true, signal });
    el.addEventListener('touchmove', (e) => {
      if (!drag.current.active) return;
      e.preventDefault(); // 핸들 드래그 중 스크롤/바운스 차단 → passive:false 필요
      move(e.touches[0].clientY);
    }, { passive: false, signal });
    el.addEventListener('touchend', end, { passive: true, signal });
    el.addEventListener('touchcancel', end, { passive: true, signal });

    // ── 마우스(데스크톱 디버그) ──
    const onMouseMove = (e: MouseEvent) => move(e.clientY);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      end();
    };
    el.addEventListener('mousedown', (e) => {
      begin(e.clientY);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }, { signal });

    return () => {
      controller.abort();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [begin, move, end]);

  // ── 스크롤 본문: 맨 위에서 아래로 끌 때만 닫기(그 외엔 스크롤) ──
  const bodyRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const controller = new AbortController();
    const { signal } = controller;

    // 제스처 1회당 상태: idle→(pending|scroll)→drag. pending 에서만 방향을 보고 결정한다.
    let phase: 'idle' | 'pending' | 'drag' | 'scroll' = 'idle';
    let sx = 0;
    let sy = 0;

    el.addEventListener('touchstart', (e) => {
      if (drag.current.active) return;
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      // 맨 위에 있을 때만 "아래로 끌어 닫기" 후보. 스크롤 중이면 스크롤에 양보.
      phase = el.scrollTop <= 0 ? 'pending' : 'scroll';
    }, { passive: true, signal });

    el.addEventListener('touchmove', (e) => {
      if (phase === 'idle' || phase === 'scroll') return;
      const t = e.touches[0];
      const dy = t.clientY - sy;
      const dx = t.clientX - sx;
      if (phase === 'pending') {
        if (dy > 6 && dy > Math.abs(dx)) {
          phase = 'drag';            // 아래로 수직 의도 확정 → 닫기 드래그로 전환
          begin(sy);
        } else if (dy < -2 || Math.abs(dx) > dy) {
          phase = 'scroll';          // 위로/가로 → 이 제스처는 스크롤에 넘긴다
          return;
        } else {
          return;                    // 아직 애매 — 판단 보류
        }
      }
      // phase === 'drag'
      e.preventDefault();            // 시트 따라 내려가는 동안 본문 스크롤/바운스 차단
      move(t.clientY);
    }, { passive: false, signal });

    const finish = () => {
      if (phase === 'drag') end();
      phase = 'idle';
    };
    el.addEventListener('touchend', finish, { passive: true, signal });
    el.addEventListener('touchcancel', finish, { passive: true, signal });

    return () => controller.abort();
  }, [begin, move, end]);

  return { handleRef, sheetRef, bodyRef };
}
