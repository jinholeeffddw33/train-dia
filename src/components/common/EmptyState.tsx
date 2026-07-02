'use client';

import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** 이모지 문자열 또는 아이콘 노드 (예: "📷" 또는 <ImageIcon size={48} />) */
  icon?: React.ReactNode;
  /** 핵심 문구 — 해요체 (예: "아직 비교할 기관사가 없어요") */
  text: string;
  /** 다음 행동 힌트 (예: "위 버튼으로 추가해보세요") */
  hint?: string;
}

/** 빈 상태 표준 컴포넌트 — safety SafetyWorld 빈 상태 패턴 추출 (이모지+문구+힌트) */
export default function EmptyState({ icon, text, hint }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      {icon != null && <span className={styles.icon} aria-hidden>{icon}</span>}
      <p className={styles.text}>{text}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
