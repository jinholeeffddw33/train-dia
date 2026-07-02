'use client';

import Modal from './Modal';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  /** 시트 상단 제목 (예: "로그아웃") */
  title: string;
  /** 본문 메시지 — 해요체 */
  message: React.ReactNode;
  /**
   * 확인 버튼 라벨 — 반드시 동사+목적 형태 (예: "삭제하기", "로그아웃하기").
   * 명사("확인"/"삭제")나 존댓말 청유("~할게요")가 아닌 행동 라벨을 쓴다.
   */
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * ConfirmDialog — window.confirm() 대체 공용 확인 다이얼로그.
 * 공용 Modal(바텀시트 SSOT) 기반 — ESC/배경탭/드래그/포커스 트랩 자동 보장.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className={styles.body}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`z-glass-pill ${styles.cancelBtn}`}
            data-press
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${variant === 'danger' ? styles.confirmBtnDanger : `z-cta ${styles.confirmBtn}`}`}
            data-press
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
