'use client';

import { createPortal } from 'react-dom';
import Modal from '@/components/common/Modal';
import { useRollCallStore } from '@/stores/rollcall';
import RollCallBoard from './RollCallBoard';

/**
 * 공지(점호)사항 시트 — 홈의 «공지(점호)» 아이콘과 안전 화면의 공지 칸이 같은 시트를 연다.
 * 두 곳이 서로 부모-자식이 아니라 스토어로 잇는다(청렴 시트와 같은 방식).
 */
export default function RollCallSheet() {
  const open = useRollCallStore((s) => s.open);
  const close = useRollCallStore((s) => s.closeBoard);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <Modal open={open} onClose={close} title="공지(점호)사항">
      <RollCallBoard />
    </Modal>,
    document.body,
  );
}
