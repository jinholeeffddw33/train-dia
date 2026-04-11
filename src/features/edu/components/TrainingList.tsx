'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen, Play, X, Calendar } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import styles from '../styles/edu.module.css';

interface TrainingItem {
  id: string;
  title: string;
  category: string;
  slide?: { chapterIds: string[] };
  video?: { youtubeId: string };
}

interface TrainingListProps {
  onBack: () => void;
  onSlide: (chapterIds: string[]) => void;
}

export default function TrainingList({ onBack, onSlide }: TrainingListProps) {
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{ title: string; youtubeId: string } | null>(null);

  const closePlayer = useCallback(() => setActiveVideo(null), []);
  useHistoryBack('training-video', closePlayer, !!activeVideo);

  useEffect(() => {
    fetch('/data/edu/training.json')
      .then(r => r.json())
      .then((data: TrainingItem[]) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.topTitle}>교육훈련</h2>
      </div>

      <div className={styles.trainingListWrap}>
        {loading && (
          <div className={styles.videoEmpty}>
            <p>불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className={styles.videoEmpty}>
            <p>교육자료를 불러올 수 없어요</p>
            <button
              type="button"
              className={styles.videoRetryBtn}
              onClick={() => window.location.reload()}
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className={styles.videoEmpty}>
            <BookOpen size={40} />
            <p>아직 등록된 교육자료가 없어요</p>
          </div>
        )}

        {!loading && !error && items.map(item => (
          <div key={item.id} className={styles.trainingCard}>
            <div className={styles.trainingCardHeader}>
              <h3 className={styles.trainingCardTitle}>{item.title}</h3>
              <span className={styles.videoCategoryBadge}>{item.category}</span>
            </div>
            <div className={styles.trainingBtnRow}>
              {item.slide && (
                <button
                  type="button"
                  className={styles.trainingBtn}
                  onClick={() => onSlide(item.slide!.chapterIds)}
                >
                  <BookOpen size={18} />
                  <span>슬라이드</span>
                </button>
              )}
              {item.video && (
                <button
                  type="button"
                  className={`${styles.trainingBtn} ${styles.trainingBtnVideo}`}
                  onClick={() => setActiveVideo({ title: item.title, youtubeId: item.video!.youtubeId })}
                >
                  <Play size={18} />
                  <span>동영상</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 동영상 풀스크린 플레이어 */}
      {activeVideo && (
        <div
          className={styles.videoPlayerOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={activeVideo.title}
        >
          <div className={styles.videoPlayerHeader}>
            <h3 className={styles.videoPlayerTitle}>{activeVideo.title}</h3>
            <button
              type="button"
              className={styles.videoPlayerClose}
              onClick={closePlayer}
              aria-label="닫기"
            >
              <X size={24} />
            </button>
          </div>
          <div className={styles.videoPlayerBody}>
            <div className={styles.videoIframeWrap}>
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className={styles.videoIframe}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
