'use client';

import styles from './LoadingDots.module.css';

interface LoadingDotsProps {
  /** 점 아래 보조 문구 (예: "불러오고 있어요") */
  label?: string;
}

/** 로딩 표준 컴포넌트 — 점 3개 펄스 (safety/standby loadingDot 스타일 재사용) */
export default function LoadingDots({ label }: LoadingDotsProps) {
  return (
    <div className={styles.wrap} role="status" aria-label={label ?? '불러오고 있어요'}>
      <div className={styles.dots} aria-hidden>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
}
