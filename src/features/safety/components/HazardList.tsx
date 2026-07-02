'use client';

import { useMemo, useState } from 'react';
import { Heart, MessageCircle, Check, ThumbsUp, Paperclip } from 'lucide-react';
import { useHazardStore, type SafetyCategory } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import AttachmentLightbox from './AttachmentLightbox';
import styles from './Hazard.module.css';

const READ_STORAGE_KEY = 'safety-read-ids';
function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

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

type CardSubKey = 'notice' | 'train' | 'driving' | 'incident' | 'hazard';

/** 편성 태그 — `503편성` (특정 편성) 또는 `전편성` (전체 편성 공지) */
const TRAIN_TAG_RE = /^(?:\d+|전)편성$/;
const DRIVING_TAGS = new Set(['시설물', '열차', '신호']);

function getDescriptionTag(desc: string): string {
  const normalized = (desc || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = (normalized.split('\n')[0] || '').trim();
  const m = firstLine.match(/^\[([^\]]+)\]/);
  return m ? m[1].trim() : '';
}

interface HazardListProps {
  onSelect: (id: string) => void;
  category?: SafetyCategory;
  cardKey?: CardSubKey;
}

export default function HazardList({ onSelect, category, cardKey }: HazardListProps) {
  const allReports = useHazardStore((s) => s.reports);
  const loading = useHazardStore((s) => s.loadingReports);
  const toggleLike = useHazardStore((s) => s.toggleLike);
  const name = useDriverStore((s) => s.myDriver?.n ?? '');
  const sabun = useDriverStore((s) => s.myDriver?.s ?? '');
  const isNotice = category === 'inspect' && (!cardKey || cardKey === 'notice');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // cardKey별 inspect 하위 필터
  const reports = useMemo(() => {
    if (category !== 'inspect' || !cardKey) return allReports;
    return allReports.filter((r) => {
      const tag = getDescriptionTag(r.description);
      if (cardKey === 'train') return TRAIN_TAG_RE.test(tag);
      if (cardKey === 'driving') return DRIVING_TAGS.has(tag);
      if (cardKey === 'notice') return !tag || (r.location === '점호내용' || r.location === '중요알림');
      return true;
    });
  }, [allReports, category, cardKey]);

  // localStorage 기반 확인 상태 — 렌더 시점 1회 로드 (목록 재진입 시 갱신)
  const readIds = useMemo(() => loadReadIds(), [reports.length]);

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
        <p className={styles.emptyText}>{isNotice ? '등록된 공지가 없어요' : '등록된 글이 없어요'}</p>
        <p className={styles.emptyHint}>{isNotice ? '관리자가 등록한 공지가 여기에 표시됩니다' : '사진과 함께 공유해주세요'}</p>
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
                <span className={styles.authorWrap}>
                  <span className={styles.authorAvatar}>{r.createdBy.charAt(0)}</span>
                  <span className={styles.noticeAuthor}>{r.createdBy}</span>
                </span>
              </div>
              <div className={styles.noticeBodyPreview}>
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
                <button
                  type="button"
                  className={styles.noticeFile}
                  onClick={(e) => { e.stopPropagation(); setLightboxUrl(r.photoUrl); }}
                  aria-label="첨부파일 보기"
                >
                  <Paperclip size={12} /> 첨부파일
                </button>
              )}
              <div className={styles.noticeFooter}>
                <div className={styles.noticeReactions}>
                  <button
                    type="button"
                    className={`${styles.reactionBtn} ${r.likedByMe ? styles.reactionBtnActive : ''}`}
                    aria-label="공감"
                    aria-pressed={r.likedByMe}
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
                  {/* 공지사항은 확인(✓) 표시 미사용 */}
                </div>
              </div>
            </button>
          );
        })}
        {lightboxUrl && (
          <AttachmentLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </div>
    );
  }

  // 기존: 위험/조치 / 운전 정보 / 열차 정보
  const isDriving = cardKey === 'driving';
  const isIncident = cardKey === 'incident';
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
            {isDriving && r.location && (
              <span className={styles.driveHoBadge}>운전정보 {r.location}</span>
            )}
            {isIncident && r.location && (
              <span className={styles.driveHoBadge}>사례교육 {r.location}</span>
            )}
            {!isDriving && !isIncident && r.location && (
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
              <ConfirmStat read={readIds.has(r.id)} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/** 확인 상태 표시 — 읽기 전: 외곽선 ✓, 읽음: 채워진 초록 ✓ + '확인' */
function ConfirmStat({ read }: { read: boolean }) {
  return (
    <span
      className={`${styles.cardStat} ${read ? styles.cardStatConfirmed : styles.cardStatUnconfirmed}`}
      aria-label={read ? '확인 완료' : '확인 전'}
    >
      <Check size={13} strokeWidth={3} />
      {read ? '확인' : '미확인'}
    </span>
  );
}
