'use client';

import { Heart, MessageCircle, Eye, ThumbsUp } from 'lucide-react';
import { useHazardStore, type SafetyCategory } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
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

const DOW_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

function parseDateInfo(iso: string) {
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  return {
    month: `${d.getMonth() + 1}월`,
    date: String(d.getDate()),
    dow: DOW_FULL[day],
    isHoliday: day === 0 || day === 6,
  };
}

interface HazardListProps {
  onSelect: (id: string) => void;
  category?: SafetyCategory;
}

export default function HazardList({ onSelect, category }: HazardListProps) {
  const reports = useHazardStore((s) => s.reports);
  const loading = useHazardStore((s) => s.loadingReports);
  const toggleLike = useHazardStore((s) => s.toggleLike);
  const name = useDriverStore((s) => s.myDriver?.n ?? '');
  const sabun = useDriverStore((s) => s.myDriver?.s ?? '');
  const isNotice = category === 'inspect';

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
        <span className={styles.emptyIcon}>{isNotice ? '📋' : '📷'}</span>
        <p className={styles.emptyText}>{isNotice ? '등록된 알림이 없어요' : '등록된 글이 없어요'}</p>
        <p className={styles.emptyHint}>{isNotice ? '관리자가 등록한 알림이 여기에 표시됩니다' : '사진과 함께 공유해주세요'}</p>
      </div>
    );
  }

  // 알림마당: 번호 리스트 형태
  if (isNotice) {
    return (
      <div className={styles.list}>
        {reports.map((r) => {
          const lines = r.description.split('\n');
          const isPlaceholder = r.photoUrl.includes('placeholder');
          const hasFile = !isPlaceholder && r.photoUrl;
          const isImportant = r.location === '중요알림';
          const dateInfo = parseDateInfo(r.createdAt);
          return (
            <button
              key={r.id}
              type="button"
              className={`${styles.noticeCard} ${isImportant ? styles.noticeCardImportant : ''}`}
              onClick={() => onSelect(r.id)}
            >
              <div className={styles.noticeHeader}>
                {r.location && (
                  <span className={`${styles.noticeType} ${isImportant ? styles.noticeTypeImportant : styles.noticeTypeRollcall}`}>
                    {r.location}
                  </span>
                )}
                {dateInfo && (
                  <span className={styles.noticeDateWrap}>
                    <span className={styles.noticeDateMonth}>{dateInfo.month}</span>
                    <span className={styles.noticeDateDay}>{dateInfo.date}</span>
                    <span className={`${styles.noticeDateDow} ${dateInfo.isHoliday ? styles.noticeDateHoliday : ''}`}>
                      {dateInfo.dow}
                    </span>
                  </span>
                )}
                <span className={styles.noticeAuthor}>{r.createdBy}</span>
              </div>
              <div className={styles.noticeBody}>
                {lines.map((line, i) => {
                  const num = parseInt(line);
                  const isHighlight = num === 1 || num === 2;
                  return (
                    <div
                      key={i}
                      className={`${styles.noticeLine} ${isHighlight ? styles.noticeLineHighlight : ''}`}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
              {hasFile && (
                <div className={styles.noticeFile}>📎 첨부파일</div>
              )}
              <div className={styles.noticeFooter}>
                <div className={styles.noticeReactions}>
                  <button
                    type="button"
                    className={`${styles.reactionBtn} ${r.likedByMe ? styles.reactionBtnActive : ''}`}
                    onClick={(e) => { e.stopPropagation(); if (name && sabun) toggleLike(r.id, name, sabun); }}
                  >
                    <ThumbsUp size={14} fill={r.likedByMe ? 'currentColor' : 'none'} /> <span>{r.likeCount}</span>
                  </button>
                </div>
                <div className={styles.cardStats}>
                  <span className={styles.cardStat}>
                    <MessageCircle size={13} />
                    {r.commentCount}
                  </span>
                  <span className={styles.cardStat}>
                    <Eye size={13} />
                    {r.readCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // 기존: 위험/조치
  return (
    <div className={styles.list}>
      {reports.map((r) => (
        <button
          key={r.id}
          type="button"
          className={styles.card}
          onClick={() => onSelect(r.id)}
          aria-label={r.description}
        >
          <img
            src={r.photoUrl}
            alt="첨부 사진"
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
            </div>
            <div className={styles.cardStats}>
              <span className={`${styles.cardStat} ${r.likedByMe ? styles.cardStatLiked : ''}`}>
                <Heart size={13} fill={r.likedByMe ? 'currentColor' : 'none'} />
                {r.likeCount}
              </span>
              <span className={styles.cardStat}>
                <MessageCircle size={13} />
                {r.commentCount}
              </span>
              <span className={styles.cardStat}>
                <Eye size={13} />
                {r.readCount}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
