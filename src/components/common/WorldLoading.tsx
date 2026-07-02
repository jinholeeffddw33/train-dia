'use client';

import styles from './WorldLoading.module.css';

/** 코드 스플리팅된 월드/탭 청크 로딩 중 폴백 스피너 */
export default function WorldLoading() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p>불러오고 있어요...</p>
    </div>
  );
}
