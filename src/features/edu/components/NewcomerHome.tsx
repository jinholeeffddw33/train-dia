'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, BookOpen } from 'lucide-react';
import styles from '../styles/edu.module.css';

interface NewcomerHomeProps {
  onBack: () => void;
  onVideo: () => void;
  onHandbook: () => void;
}

export default function NewcomerHome({ onBack, onVideo, onHandbook }: NewcomerHomeProps) {
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const [sectionCount, setSectionCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/data/edu/video-guide.json')
      .then((r) => r.json())
      .then((json) => setVideoCount((json.videos ?? []).length))
      .catch(() => setVideoCount(null));

    fetch('/data/edu/handbook.json')
      .then((r) => r.json())
      .then((json) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const ids = ['newcomer1', 'newcomer2', 'newcomer3'];
        const chapters = (json.chapters ?? []).filter((c: any) => ids.includes(c.id));
        const total = chapters.reduce((sum: number, c: any) => sum + (c.sections?.length ?? 0), 0);
        setSectionCount(total);
      })
      .catch(() => setSectionCount(null));
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>새내기 기관사</h1>
      </div>

      <div className={styles.newcomerSubMenu}>
        <button type="button" className={styles.newcomerSubCard} onClick={onVideo}>
          <div className={`${styles.newcomerSubIcon} ${styles.iconBgBlue}`}>
            <Eye size={26} />
          </div>
          <div className={styles.newcomerSubLabel}>영상 가이드</div>
          <div className={styles.newcomerSubMeta}>
            {videoCount !== null ? `${videoCount}개 · 순서대로` : '순서대로 시청'}
          </div>
        </button>

        <button type="button" className={styles.newcomerSubCard} onClick={onHandbook}>
          <div className={`${styles.newcomerSubIcon} ${styles.iconBgAmber}`}>
            <BookOpen size={26} />
          </div>
          <div className={styles.newcomerSubLabel}>새내기 핸드북</div>
          <div className={styles.newcomerSubMeta}>
            {sectionCount !== null ? `${sectionCount}개 항목` : '핸드북 전체'}
          </div>
        </button>
      </div>
    </div>
  );
}
