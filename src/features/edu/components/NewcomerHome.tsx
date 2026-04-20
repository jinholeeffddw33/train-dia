'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, BookOpen, ExternalLink, Play, ChevronRight } from 'lucide-react';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface VideoItem {
  id: string;
  order: number;
  title: string;
  description?: string;
  url: string;
  source?: string;
}

interface VideoGuideData {
  title: string;
  subtitle?: string;
  videos: VideoItem[];
}

interface NewcomerHomeProps {
  onBack: () => void;
  onHandbook: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  'naver-cafe': '네이버 카페',
  'youtube': '유튜브',
};

export default function NewcomerHome({ onBack, onHandbook }: NewcomerHomeProps) {
  const [data, setData] = useState<VideoGuideData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/edu/video-guide.json')
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sortedVideos = (data?.videos ?? []).slice().sort((a, b) => a.order - b.order);

  const openVideo = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>새내기 기관사</h1>
      </div>

      <div className={styles.newcomerBody}>
        {/* ── 영상 가이드 섹션 ── */}
        <section className={styles.newcomerSection}>
          <div className={styles.newcomerSectionHeader}>
            <div className={`${styles.newcomerSectionIcon} ${styles.iconBgBlue}`}>
              <Eye size={20} />
            </div>
            <div className={styles.newcomerSectionTitle}>
              <div className={styles.newcomerSectionLabel}>{data?.title ?? '눈으로 보는 영상 가이드'}</div>
              <div className={styles.newcomerSectionSub}>
                {data?.subtitle ?? '새내기 기관사 필수 영상'}
                {sortedVideos.length > 0 && ` · ${sortedVideos.length}개`}
              </div>
            </div>
          </div>

          {loading && (
            <div className={styles.newcomerEmpty}>불러오는 중...</div>
          )}

          {!loading && sortedVideos.length === 0 && (
            <div className={styles.newcomerEmpty}>
              <p>아직 등록된 영상이 없어요</p>
            </div>
          )}

          {!loading && sortedVideos.length > 0 && (
            <div className={styles.videoGuideList}>
              {sortedVideos.map((video, idx) => (
                <div key={video.id} className={styles.videoGuideItem}>
                  <button
                    type="button"
                    className={styles.videoGuideCard}
                    onClick={() => openVideo(video.url)}
                    aria-label={`${video.order}강 ${video.title} 재생`}
                  >
                    <div className={styles.videoGuideNumber}>
                      <Play size={18} fill="currentColor" />
                      <span className={styles.videoGuideOrder}>{video.order}강</span>
                    </div>
                    <div className={styles.videoGuideBody}>
                      <div className={styles.videoGuideTitle}>{video.title}</div>
                      {video.description && (
                        <div className={styles.videoGuideDesc}>{video.description}</div>
                      )}
                      {video.source && (
                        <div className={styles.videoGuideSource}>
                          <ExternalLink size={12} />
                          <span>{SOURCE_LABEL[video.source] ?? '외부 링크'}</span>
                        </div>
                      )}
                    </div>
                  </button>
                  {idx < sortedVideos.length - 1 && (
                    <div className={styles.videoGuideConnector} aria-hidden />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 신규기관사 핸드북 섹션 ── */}
        <section className={styles.newcomerSection}>
          <button type="button" className={styles.newcomerHandbookCard} onClick={onHandbook}>
            <div className={`${styles.newcomerSectionIcon} ${styles.iconBgAmber}`}>
              <BookOpen size={20} />
            </div>
            <div className={styles.newcomerHandbookText}>
              <div className={styles.newcomerHandbookLabel}>신규 기관사 핸드북</div>
              <div className={styles.newcomerHandbookSub}>출고준비 · 상황별 조치 · 중고장</div>
            </div>
            <ChevronRight size={20} className={styles.resumeArrow} />
          </button>
        </section>
      </div>
    </div>
  );
}
