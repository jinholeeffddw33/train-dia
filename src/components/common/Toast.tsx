'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

let toastId = 0;
let addToastFn: ((text: string, type?: ToastMessage['type']) => void) | null = null;

/** 전역 토스트 호출 */
export function showToast(text: string, type: ToastMessage['type'] = 'info') {
  addToastFn?.(text, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
