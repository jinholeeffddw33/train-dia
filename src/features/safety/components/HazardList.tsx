'use client';

import { useHazardStore } from '@/stores/hazard';
import styles from './Hazard.module.css';

function timeAgo(iso: string): string {
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const diff = Date.now() - new Date(normalized).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

interface HazardListProps {
  onSelect: (id: string) => void;
}

export default function HazardList({ onSelect }: HazardListProps) {
  const reports = useHazardStore((s) => s.reports);
  const loading = useHazardStore((s) => s.loadingReports);

  if (loading && reports.length === 0) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingDot} />
        <span className={styles.loadingDot} />
        <span className={styles.loadingDot} />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📷</span>
        <p className={styles.emptyText}>등록된 위험요소가 없어요</p>
        <p className={styles.emptyHint}>발견한 위험요소를 사진으로 공유해주세요</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {reports.map((r) => (
        <button
          key={r.id}
          type="button"
          className={styles.card}
          onClick={() => onSelect(r.id)}
          aria-label={`위험요소: ${r.description}`}
        >
          <img
            src={r.photoUrl}
            alt="위험요소 사진"
            className={styles.cardPhoto}
            loading="lazy"
          />
          <div className={styles.cardInfo}>
            {r.location && (
              <span className={styles.cardLocation}>📍 {r.location}</span>
            )}
            <p className={styles.cardDesc}>{r.description}</p>
            <div className={styles.cardMeta}>
              <span className={styles.cardAuthor}>{r.createdBy}</span>
              <span className={styles.cardDot}>·</span>
              <span className={styles.cardTime}>{timeAgo(r.createdAt)}</span>
              <span className={styles.cardDot}>·</span>
              <span className={styles.cardComments}>💬 {r.commentCount}</span>
              {r.likeCount > 0 && (
                <>
                  <span className={styles.cardDot}>·</span>
                  <span className={styles.cardLikes}>❤️ {r.likeCount}</span>
                </>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
