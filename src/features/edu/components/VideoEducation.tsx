'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Play, Calendar } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import styles from '../styles/edu.module.css';

interface VideoItem {
  id: string;
  title: string;
  youtubeId: string;
  duration: string;
  date: string;
  category: string;
}

interface VideoEducationProps {
  onBack: () => void;
}

export default function VideoEducation({ onBack }: VideoEducationProps) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const closePlayer = useCallback(() => setActiveVideo(null), []);

  useHistoryBack('video-player', closePlayer, !!activeVideo);
  useEscapeClose(!!activeVideo, closePlayer);

  useEffect(() => {
    fetch('/data/edu/videos.json')
      .then(r => r.json())
      .then((data: VideoItem[]) => {
        setVideos(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${y}.${m}.${d}`;
  };

  return (
    <div className={`${styles.screen} ${styles.screenWide}`}>
      {/* 헤더 */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.topTitle}>동영상 교육</h2>
      </div>

      <div className={styles.videoListWrap}>
        {/* 로딩 */}
        {loading && (
          <div className={styles.videoEmpty}>
            <p>불러오는 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className={styles.videoEmpty}>
            <p>영상 목록을 불러올 수 없어요</p>
            <button
              type="button"
              className={styles.videoRetryBtn}
              onClick={() => window.location.reload()}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && videos.length === 0 && (
          <div className={styles.videoEmpty}>
            <Play size={40} />
            <p>아직 등록된 영상이 없어요</p>
          </div>
        )}

        {/* 영상 카드 목록 */}
        {!loading && !error && videos.map(v => (
          <button
            key={v.id}
            type="button"
            className={styles.videoCard}
            onClick={() => setActiveVideo(v)}
          >
            <div className={styles.videoThumbWrap}>
              <img
                src={`https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`}
                alt={v.title}
                className={styles.videoThumb}
                loading="lazy"
              />
              <div className={styles.videoPlayOverlay}>
                <Play size={36} fill="currentColor" />
              </div>
              {v.duration && (
                <span className={styles.videoDuration}>{v.duration}</span>
              )}
            </div>
            <div className={styles.videoInfo}>
              <h3 className={styles.videoTitle}>{v.title}</h3>
              <div className={styles.videoMeta}>
                <Calendar size={13} />
                <span>{formatDate(v.date)}</span>
                {v.category && (
                  <span className={styles.videoCategoryBadge}>{v.category}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 풀스크린 플레이어 오버레이 */}
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
            <div className={styles.videoPlayerInfo}>
              <div className={styles.videoMeta}>
                <Calendar size={13} />
                <span>{formatDate(activeVideo.date)}</span>
                {activeVideo.category && (
                  <span className={styles.videoCategoryBadge}>{activeVideo.category}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
