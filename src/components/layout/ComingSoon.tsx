'use client';

import { ArrowLeft } from 'lucide-react';
import type { WorldId } from './WorldHub';
import styles from './ComingSoon.module.css';

interface ComingSoonProps {
  worldId: WorldId;
  onBack: () => void;
}

const WORLD_META: Record<Exclude<WorldId, 'duty'>, { emoji: string; label: string; iconClass: string }> = {
  edu: { emoji: '📚', label: '교육', iconClass: styles.iconEdu },
  safety: { emoji: '🛡️', label: '안전', iconClass: styles.iconSafety },
  life: { emoji: '🌿', label: '라이프', iconClass: styles.iconSafety },
  standby: { emoji: '📋', label: '대기충당확인', iconClass: styles.iconEdu },
};

export default function ComingSoon({ worldId, onBack }: ComingSoonProps) {
  const meta = WORLD_META[worldId as Exclude<WorldId, 'duty'>];

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.backBtn}
        onClick={onBack}
        aria-label="세계 선택으로 돌아가기"
      >
        <ArrowLeft size={20} strokeWidth={2} />
      </button>

      <div className={styles.content}>
        <div className={`${styles.icon} ${meta.iconClass}`}>
          {meta.emoji}
        </div>
        <h1 className={styles.title}>{meta.label} 월드 준비중</h1>
        <p className={styles.desc}>곧 만나요! 열심히 만들고 있어요.</p>
      </div>
    </div>
  );
}
