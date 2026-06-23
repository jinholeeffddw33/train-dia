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
 * "정석": **핸들을 잡고 아래로 내리면** 시트가 따라 내려가고, 충분히 내리면 닫힌다.
 * 본문(버튼/스크롤)은 손 안 댐 — 드래그 소스는 *핸들만*.
 * 드래그 소스(handleRef) 와 움직일 대상(sheetRef) 분리. 데스크톱 마우스도 지원(디버그 검증용).
 *
 * 반환: { handleRef, sheetRef } — 핸들 div 와 시트 div 에 각각 부착.
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

  const handleRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const controller = new AbortController();
    const { signal } = controller;

    const begin = (startY: number) => {
      drag.current = { active: true, startY, dy: 0 };
    };
    const move = (clientY: number) => {
      const d = drag.current;
      if (!d.active) return;
      // 아래로만 따라옴(위로 끌어도 안 올라감 — 단순 닫기 제스처).
      d.dy = Math.max(0, clientY - d.startY);
      const sheet = sheetRef.current;
      if (!sheet) return;
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${d.dy}px)`;
      onDragMoveRef.current?.(d.dy, sheet.offsetHeight);
    };
    const end = () => {
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
    };

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
  }, [threshold, reset]);

  return { handleRef, sheetRef };
}
