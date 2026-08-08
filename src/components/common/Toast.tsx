'use client';

import { useToastStore } from '@/stores/toast';
import styles from './Toast.module.css';

/**
 * 전역 토스트 렌더러 (UI-TOAST-001)
 *
 * 상태는 `@/stores/toast` 가 갖고 있고 이 컴포넌트는 **그리기만** 한다.
 *
 * ★ 2026-08-09 이전 구현은 모듈 레벨 가변 싱글턴이었다:
 *     let addToastFn = null  →  컨테이너가 마운트될 때 자기 setState 를 꽂고 언마운트 때 null.
 *   그래서 컨테이너가 뜨기 전이나 재마운트 사이에 부른 토스트는 **조용히 사라졌다**.
 *   store 는 컴포넌트 생명주기 밖에 있어 그 창이 없다.
 *
 * ★ 햅틱은 store 의 show() 가 자동 발화한다(success/error/warning).
 *   호출부에서 토스트와 함께 햅틱을 중복 호출하지 말 것.
 *
 * showToast 는 기존 호출부(7파일) 호환을 위해 여기서 그대로 다시 내보낸다.
 */
export { showToast, dismissToast } from '@/stores/toast';
export type { ToastType } from '@/stores/toast';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
