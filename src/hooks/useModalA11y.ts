'use client';

import { useEffect, useRef, useCallback } from 'react';
import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';

/**
 * 모달/오버레이 접근성 SSOT — ZINOSB useModalA11y 적응 이식 2026-08-18
 *
 * 담당: **배경 스크롤 잠금 + focus trap + ESC + 포커스 복원**.
 * 담당 아님: 뒤로가기 — train-dia 는 `useHistoryBack` 이 이미 38곳에서 그 일을 하고 있다.
 *   (책임을 겹치면 한 번의 뒤로가기가 두 번 소비된다)
 *
 * CLAUDE.md §1.6 은 "모든 모달에 role=dialog + aria-modal + focus trap + ESC" 를 P0 로 요구하는데,
 * 실측(2026-08-18)에서 train-dia 모달들은 **첫 요소에 포커스만** 주고 Tab 순환 트랩이 없었다.
 * 트랩이 없으면 Tab 이 모달 밖으로 나가 뒤 화면 버튼을 눌러 버린다(스크린리더는 더 심하게 샌다).
 *
 * ★ 이식하며 함께 가져온 사고 교훈 4가지 (ZINOSB 가 실제로 겪은 것):
 *   1. 스크롤 잠금은 전역 카운터로 — 중첩 모달에서 화면이 영구히 얼어붙는 사고
 *   2. 포커스 복원은 `preventScroll: true` — 안 하면 모달을 닫을 때 뒤 목록이 그 버튼 위치로
 *      튀어 스크롤 위치가 유실된다
 *   3. **첫 요소가 텍스트 입력이면 자동 포커스하지 않는다** — 모바일에서 입력 포커스는 곧
 *      키보드 오픈이다. 시트를 여는 것과 글을 쓰겠다는 것은 다른 의도인데, 진입 포커스가
 *      그 둘을 뭉개 화면 절반이 키보드에 먹힌다. 즉시 입력받아야 하면 그 input 에 autoFocus 를 주면 된다.
 *   4. 포커스 effect 의 deps 는 [isOpen] 만 — onClose 같은 매 렌더 바뀌는 값을 넣으면
 *      부모가 리렌더될 때마다 cleanup 이 돌아 입력에서 포커스를 뺏는다(키보드가 올라오다 내려감).
 *      그래서 키다운 리스너는 **별도 effect** 로 분리한다.
 *
 * 사용:
 * ```tsx
 * const modalRef = useModalA11y(open, onClose);
 * <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="...">
 * ```
 */

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 포커스하면 모바일 키보드가 올라오는 요소인가 */
function isTextEntry(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (el.isContentEditable) return true;
  if (tag !== 'input') return false;
  const type = (el as HTMLInputElement).type;
  // 키보드를 부르지 않는 input 들은 제외 (버튼처럼 동작한다)
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image'].includes(type);
}

export interface ModalA11yOptions {
  /** ESC 로 닫기 (기본 true). 폼 입력 중 실수 방지가 필요한 모달은 false */
  closeOnEscape?: boolean;
  /** 배경 스크롤 잠금 (기본 true) */
  lockScroll?: boolean;
}

export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose?: () => void,
  options: ModalA11yOptions = {},
) {
  const { closeOnEscape = true, lockScroll = true } = options;
  const modalRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── 배경 스크롤 잠금 (전역 카운터 위임) ──
  useEffect(() => {
    if (!isOpen || !lockScroll) return;
    acquireScrollLock();
    return () => releaseScrollLock();
  }, [isOpen, lockScroll]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        // 숨겨진 요소는 포커스 대상이 아니다(닫히는 중인 패널 등)
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        // 포커스할 게 없으면 Tab 이 모달 밖으로 나가지 않게 막기만 한다
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!modal.contains(document.activeElement)) {
        // 포커스가 이미 모달 밖에 있으면(배경 클릭 등) 안으로 되돌린다
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, closeOnEscape],
  );

  // ── 진입 포커스 + 복원 — deps 는 [isOpen] 만 (교훈 4) ──
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const modal = modalRef.current;
    if (modal) {
      requestAnimationFrame(() => {
        // 이미 모달 안에 포커스가 있으면 건드리지 않는다(autoFocus 존중 · 포커스 강탈 방지)
        if (modal.contains(document.activeElement)) return;

        const firstFocusable = modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable && !isTextEntry(firstFocusable)) {
          firstFocusable.focus();
        } else {
          // 텍스트 입력이거나 포커스 대상이 없으면 **컨테이너**에 포커스한다.
          // 스크린리더는 다이얼로그 진입을 그대로 인지하고, 키보드는 안 올라온다(교훈 3).
          modal.setAttribute('tabindex', '-1');
          modal.focus({ preventScroll: true });
        }
      });
    }

    return () => {
      // preventScroll: 복원 대상이 스크롤된 위치에 있으면 focus() 가 그 요소를 화면으로
      // 끌어올려 배경 스크롤을 훔친다 → 모달을 닫으면 목록 위치가 유실된다(교훈 2).
      previousFocusRef.current?.focus?.({ preventScroll: true });
      previousFocusRef.current = null;
    };
  }, [isOpen]);

  // ── 키다운 리스너는 분리 (handleKeyDown 이 바뀌어도 포커스는 안 건드린다) ──
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  return modalRef;
}
