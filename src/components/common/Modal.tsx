'use client';

import { useEffect, useRef, useCallback, useState, useId } from 'react';
import { X } from 'lucide-react';
import { useSheetDragDismiss } from '@/hooks/useSheetDragDismiss';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useModalA11y } from '@/hooks/useModalA11y';
import styles from './Modal.module.css';
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** 스크롤 밖 고정 하단바(선택). 여기 둔 버튼은 목록 스크롤/sticky 영향 없이 터치 클릭이 확실히 먹는다. */
  footer?: React.ReactNode;
  /** 헤더 우측(닫기 X 옆) 액션(선택). 헤더는 안드로이드에서도 터치가 확실히 먹는 안전 영역. */
  headerAction?: React.ReactNode;
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
export default function Modal({ open, onClose, title, children, footer, headerAction }: ModalProps) {
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

  // ── 뒤로가기(안드로이드 하드웨어 / iOS 엣지 스와이프)로 시트를 닫는다 (2026-08-09) ──
  // ★ 실측: useHistoryBack 은 21개 파일이 쓰는데 onClose 를 가진 오버레이 27개가 안 썼다.
  //   그 화면들에선 뒤로가기가 시트를 닫는 대신 **앱을 종료**시켰다.
  //   앱은 페이지가 '/' 하나뿐이라 화면 전환이 URL 로 남지 않아서, 훅이 더미 히스토리
  //   엔트리를 쌓아 두지 않으면 브라우저 입장에선 "더 뒤로 갈 곳이 없음"이 되기 때문이다.
  // ★ 개별 화면마다 배선하는 대신 **공용 Modal 한 곳**에 넣는다 —
  //   Modal 을 쓰는 화면은 전부 공짜로 따라오고, 앞으로 추가되는 시트도 마찬가지다.
  //   (UI-ADOPT-001: 채택률은 강제력에서 나온다)
  const modalKey = useId();
  useHistoryBack(modalKey, requestClose, open && !closing);

  /**
   * ESC · Tab 포커스 트랩 · 진입/복원 포커스 · 배경 스크롤 잠금 — 전부 SSOT 훅에 위임 (2026-08-18).
   *
   * 예전에는 이 파일이 직접 다 했는데, 그 구현에 ZINOSB 가 실제로 겪은 사고 세 가지가
   * 그대로 남아 있었다:
   *   ① 첫 포커스 대상이 **텍스트 입력이어도 포커스** → 모바일에서 시트를 여는 순간
   *      키보드가 올라와 화면 절반을 먹었다 (시트를 여는 것 ≠ 글을 쓰겠다는 것).
   *   ② 포커스 복원에 preventScroll 이 없어, 닫을 때 뒤 목록이 그 버튼 위치로 튀었다.
   *   ③ 포커스 effect 가 handleKeyDown(→requestClose→onClose) 에 의존해 **부모가 리렌더될
   *      때마다** 재실행 → 입력에서 포커스를 뺏어 키보드가 올라오다 내려갔다.
   * 훅은 셋을 다 막고, 잠금은 전역 카운터를 쓴다(중첩 시트에서도 안전).
   *
   * isOpen 에서 closing 을 빼지 않는 이유: 닫힘 애니메이션 330ms 동안에도 배경은 잠겨
   * 있어야 한다. 여기서 풀면 시트가 내려가는 사이 뒤 화면이 스크롤된다.
   */
  const modalRef = useModalA11y<HTMLDivElement>(open, requestClose);

  // 외부에서 open=false 로 닫힌 경우 closing 상태 리셋 (다음 오픈 때 내려간 채로 뜨는 것 방지)
  useEffect(() => {
    if (!open && (closeTimer.current || closing)) {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
      setClosing(false);
    }
  }, [open, closing]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // 핸들 잡고 아래로 드래그 → 닫기. 본문도 맨 위에서 아래로 끌면 닫기(스크롤은 그대로).
  // 드래그 중 dim 을 시트 위치에 실시간 동기(끄는 만큼 뒤 화면 밝아짐).
  const { handleRef, sheetRef, bodyRef } = useSheetDragDismiss({
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
        ref={(el) => { contentRef.current = el; sheetRef.current = el; modalRef.current = el; }}
        className={`${styles.content} ${closing ? styles.closing : ''}`}
      >
        {/* 상단 핸들 — 잡고 아래로 끌어 닫기(드래그 소스). 스크롤 본문 밖이라 고정. */}
        <div ref={handleRef} className={styles.handle} role="button" tabIndex={-1} aria-label="아래로 끌어 닫기" />
        {title && (
          <div className={styles.headerArea}>
            <h2 className={styles.title}>{title}</h2>
            <div className={styles.headerRight}>
              {headerAction}
              <button
                type="button"
                className={styles.closeBtn}
                onClick={requestClose}
                aria-label="닫기"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
        <div ref={bodyRef} className={styles.body}>{children}</div>
        {/* 고정 하단바 — 스크롤 본문(.body) 밖. sticky-in-scroll 이 안드로이드에서 탭을 삼키는 문제 회피. */}
        {footer && <div className={styles.footerBar}>{footer}</div>}
      </div>
    </div>
  );
}
