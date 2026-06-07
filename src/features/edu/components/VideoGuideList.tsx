'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Play } from 'lucide-react';
import { useBonsaiStore } from '@/stores/bonsai';
import styles from '../styles/edu.module.css';

interface VideoItem {
  id: string;
  order: number;
  category?: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  source?: string;
}

interface VideoCategory {
  id: string;
  label: string;
  emoji?: string;
  color?: string;
}

interface VideoGuideData {
  title: string;
  subtitle?: string;
  categories?: VideoCategory[];
  videos: VideoItem[];
}

interface VideoGuideListProps {
  onBack: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  'naver-cafe': '네이버 카페',
  'youtube': '유튜브',
};

function getYouTubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

export default function VideoGuideList({ onBack }: VideoGuideListProps) {
  const [data, setData] = useState<VideoGuideData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/edu/video-guide.json')
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sortedVideos = (data?.videos ?? []).slice().sort((a, b) => a.order - b.order);
  const categories = data?.categories ?? [];
  // 카테고리별로 그룹화 — 카테고리 없는 영상은 마지막에 "기타"로
  const groupedVideos: { category: VideoCategory; items: VideoItem[] }[] = (() => {
    if (categories.length === 0) return [];
    const map = new Map<string, VideoItem[]>();
    for (const cat of categories) map.set(cat.id, []);
    const other: VideoItem[] = [];
    for (const v of sortedVideos) {
      if (v.category && map.has(v.category)) map.get(v.category)!.push(v);
      else other.push(v);
    }
    const groups = categories
      .map((c) => ({ category: c, items: map.get(c.id) ?? [] }))
      .filter((g) => g.items.length > 0);
    if (other.length > 0) {
      groups.push({ category: { id: '_other', label: '기타', emoji: '📁' }, items: other });
    }
    return groups;
  })();

  const openVideo = (videoId: string, url: string) => {
    fetch('/api/edu/video-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((res) => {
        if (res && !res.duplicate) {
          try { useBonsaiStore.getState().recordVideoComplete(); } catch { /* ignore */ }
        }
      })
      .catch(() => {});

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
        <h1 className={styles.topTitle}>눈으로 보는 영상 가이드</h1>
      </div>

      <div className={styles.newcomerBody}>
        {data?.subtitle && (
          <p className={styles.videoGuideSubtitle}>
            {data.subtitle}
            {sortedVideos.length > 0 && ` · ${sortedVideos.length}개`}
          </p>
        )}

        {loading && (
          <div className={styles.newcomerEmpty}>불러오는 중...</div>
        )}

        {!loading && sortedVideos.length === 0 && (
          <div className={styles.newcomerEmpty}>
            <p>아직 등록된 영상이 없어요</p>
          </div>
        )}

        {!loading && sortedVideos.length > 0 && groupedVideos.length === 0 && (
          /* 카테고리 정보 없으면 기존 flat list 유지 (하위 호환) */
          <div className={styles.videoGuideList}>
            {sortedVideos.map((video, idx) => {
              const thumb = video.thumbnail || getYouTubeThumbnail(video.url);
              return (
                <div key={video.id} className={styles.videoGuideItem}>
                  <button
                    type="button"
                    className={styles.videoGuideCard}
                    onClick={() => openVideo(video.id, video.url)}
                    aria-label={`${video.order}강 ${video.title} 재생`}
                  >
                    <div className={styles.videoGuideThumb}>
                      {thumb ? (
                        <>
                          <img src={thumb} alt="" loading="lazy" className={styles.videoGuideThumbImg} />
                          <span className={styles.videoGuideThumbPlay} aria-hidden>
                            <Play size={14} fill="currentColor" strokeWidth={0} />
                          </span>
                        </>
                      ) : (
                        <span className={`${styles.videoGuideThumbFallback} ${styles.iconBgBlue}`}>
                          <Play size={20} fill="currentColor" strokeWidth={0} />
                        </span>
                      )}
                    </div>
                    <div className={styles.videoGuideBody}>
                      <div className={styles.videoGuideTitle}>
                        <span className={styles.videoGuideOrder}>{video.order}강</span>
                        <span>{video.title}</span>
                      </div>
                      {video.description && (
                        <div className={styles.videoGuideDesc}>{video.description}</div>
                      )}
                      <div className={styles.videoGuideMeta}>
                        {video.source && (
                          <span className={styles.videoGuideSource}>
                            <ExternalLink size={12} />
                            <span>{SOURCE_LABEL[video.source] ?? '외부 링크'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  {idx < sortedVideos.length - 1 && (
                    <div className={styles.videoGuideConnector} aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && groupedVideos.length > 0 && (
          <div className={styles.videoGuideGroups}>
            {groupedVideos.map((group) => (
              <section
                key={group.category.id}
                className={`${styles.videoGuideGroup} ${group.category.color ? styles[`videoGuideGroupColor_${group.category.color}`] : ''}`}
              >
                <header className={styles.videoGuideGroupHeader}>
                  <span className={styles.videoGuideGroupEmoji}>{group.category.emoji}</span>
                  <h2 className={styles.videoGuideGroupTitle}>{group.category.label}</h2>
                  <span className={styles.videoGuideGroupCount}>{group.items.length}강</span>
                </header>
                <div className={styles.videoGuideList}>
                  {group.items.map((video, idx) => {
                    const thumb = video.thumbnail || getYouTubeThumbnail(video.url);
                    return (
                      <div key={video.id} className={styles.videoGuideItem}>
                        <button
                          type="button"
                          className={styles.videoGuideCard}
                          onClick={() => openVideo(video.id, video.url)}
                          aria-label={`${video.order}강 ${video.title} 재생`}
                        >
                          <div className={styles.videoGuideThumb}>
                            {thumb ? (
                              <>
                                <img src={thumb} alt="" loading="lazy" className={styles.videoGuideThumbImg} />
                                <span className={styles.videoGuideThumbPlay} aria-hidden>
                                  <Play size={14} fill="currentColor" strokeWidth={0} />
                                </span>
                              </>
                            ) : (
                              <span className={`${styles.videoGuideThumbFallback} ${styles.iconBgBlue}`}>
                                <Play size={20} fill="currentColor" strokeWidth={0} />
                              </span>
                            )}
                          </div>
                          <div className={styles.videoGuideBody}>
                            <div className={styles.videoGuideTitle}>
                              <span className={styles.videoGuideOrder}>{video.order}강</span>
                              <span>{video.title}</span>
                            </div>
                            {video.description && (
                              <div className={styles.videoGuideDesc}>{video.description}</div>
                            )}
                            <div className={styles.videoGuideMeta}>
                              {video.source && (
                                <span className={styles.videoGuideSource}>
                                  <ExternalLink size={12} />
                                  <span>{SOURCE_LABEL[video.source] ?? '외부 링크'}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        {idx < group.items.length - 1 && (
                          <div className={styles.videoGuideConnector} aria-hidden />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
