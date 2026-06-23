'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { useSheetDragDismiss } from '@/hooks/useSheetDragDismiss';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Modal — train-dia 바텀시트 단일 SSOT (ZINOSB BottomSheetShell 거동 이식, 진호 2026-06-23 전역 통일).
 *
 * 보장:
 *  1) 상단 핸들 바 — 모든 바텀시트 공통 시그니처(28px 히트 + 36×4 바)
 *  2) 업/다운 애니메이션 — 진입 slideUp, 닫힘은 시트가 아래로 슬라이드 + dim 동기 페이드(iOS 정석)
 *  3) 불투명 표면 — --dia-sheet-fill(글래스 위 솔리드). 반투명 --dia-surface 금지(뒤 콘텐츠 비침)
 *  4) dim 은 시트의 *형제* 레이어 — 부모 opacity 페이드 시 시트까지 투명해지는 버그 회피
 *  5) ESC/배경탭/스크롤락/포커스 유지
 */
export default function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 닫기 = 아래로 스륵 슬라이드 + dim 페이드 → 끝난 뒤 onClose (X·배경탭·ESC 공통).
  // 330ms = .closing/.dimClosing transition(0.3s) + 30ms 버퍼(잔여 dim snap 방지).
  const requestClose = useCallback(() => {
    setClosing((prev) => {
      if (prev) return prev;
      closeTimer.current = setTimeout(() => onClose(), 330);
      return true;
    });
  }, [onClose]);

  // ESC 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    },
    [requestClose],
  );

  // 포커스 트랩 + 스크롤 잠금
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleKeyDown]);

  // 외부에서 open=false 로 닫힌 경우 closing 상태 리셋 (다음 오픈 때 내려간 채로 뜨는 것 방지)
  useEffect(() => {
    if (!open && (closeTimer.current || closing)) {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
      setClosing(false);
    }
  }, [open, closing]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // 핸들 잡고 아래로 드래그 → 닫기. 드래그 중 dim 을 시트 위치에 실시간 동기(끄는 만큼 뒤 화면 밝아짐).
  const { handleRef, sheetRef } = useSheetDragDismiss({
    onDismiss: onClose,
    onDragMove: (dy, h) => {
      const d = dimRef.current;
      if (!d) return;
      d.style.transition = 'none';
      d.style.opacity = String(Math.max(0, 1 - dy / h));
    },
    onSettle: (dismissing) => {
      const d = dimRef.current;
      if (!d) return;
      if (dismissing) {
        d.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 1, 1)';
        d.style.opacity = '0';
      } else {
        d.style.transition = 'opacity 0.22s cubic-bezier(0.32, 0.72, 0, 1)';
        d.style.opacity = '';
      }
    },
  });

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '모달'}
      onClick={(e) => {
        if (e.target === overlayRef.current || e.target === dimRef.current) requestClose();
      }}
    >
      {/* dim — 시트의 형제 레이어. 닫힘 시 이것만 페이드(시트는 항상 불투명) */}
      <div ref={dimRef} className={`${styles.dim} ${closing ? styles.dimClosing : ''}`} aria-hidden />
      <div
        ref={(el) => { contentRef.current = el; sheetRef.current = el; }}
        className={`${styles.content} ${closing ? styles.closing : ''}`}
      >
        {/* 상단 핸들 — 잡고 아래로 끌어 닫기(드래그 소스). 스크롤 본문 밖이라 고정. */}
        <div ref={handleRef} className={styles.handle} role="button" tabIndex={-1} aria-label="아래로 끌어 닫기" />
        {title && (
          <div className={styles.headerArea}>
            <h2 className={styles.title}>{title}</h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={requestClose}
              aria-label="닫기"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
