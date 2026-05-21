'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Pencil, RefreshCw, Heart, MessageSquare, Clock, Flame } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import BoardWriteModal from './BoardWriteModal';
import BoardPostDetail from './BoardPostDetail';
import styles from './Board.module.css';

export type BoardCategory = 'free' | 'tip' | 'meet' | 'advice';

interface PostSummary {
  id: number;
  category: BoardCategory;
  title: string;
  body: string;
  author_alias: string;
  is_mine: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  metadata?: { when?: string; place?: string; capacity?: number } | null;
  images?: string[];
}

const CATEGORIES: { id: BoardCategory; label: string; emoji: string; color: string }[] = [
  { id: 'free',   label: '자유',    emoji: '💬', color: 'blue' },
  { id: 'tip',    label: '업무팁',  emoji: '💡', color: 'green' },
  { id: 'meet',   label: '모임',    emoji: '🤝', color: 'amber' },
  { id: 'advice', label: '고민상담', emoji: '🙏', color: 'purple' },
];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function isHot(p: PostSummary): boolean {
  const ageH = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
  return ageH <= 24 && p.like_count >= 10;
}

interface Props {
  onBack: () => void;
}

export default function BoardWorld({ onBack }: Props) {
  const [category, setCategory] = useState<BoardCategory>('free');
  const [sort, setSort] = useState<'latest' | 'hot'>('latest');
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Level 2 뒤로가기: 상세·작성 → 목록
  const closeOverlay = useCallback(() => {
    if (writeOpen) setWriteOpen(false);
    else if (detailId !== null) setDetailId(null);
  }, [writeOpen, detailId]);
  useHistoryBack('board-overlay', closeOverlay, writeOpen || detailId !== null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/posts?category=${category}&sort=${sort}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || '목록을 불러오지 못했어요');
      }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  }, [category, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWriteDone = useCallback(() => {
    setWriteOpen(false);
    load();
  }, [load]);

  const handleDetailClose = useCallback((didChange: boolean) => {
    setDetailId(null);
    if (didChange) load();
  }, [load]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.headerTitle}>사업소 게시판</h2>
        <button type="button" className={styles.iconBtn} onClick={load} aria-label="새로고침">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 카테고리 탭 */}
      <div className={styles.tabRow} role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            tabIndex={category === c.id ? 0 : -1}
            className={`${styles.tab} ${category === c.id ? styles.tabActive : ''}`}
            onClick={() => setCategory(c.id)}
          >
            <span className={styles.tabEmoji}>{c.emoji}</span>
            <span className={styles.tabLabel}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* 정렬 */}
      <div className={styles.sortRow}>
        <button
          type="button"
          className={`${styles.sortBtn} ${sort === 'latest' ? styles.sortBtnActive : ''}`}
          onClick={() => setSort('latest')}
        >
          <Clock size={14} /> 최신
        </button>
        <button
          type="button"
          className={`${styles.sortBtn} ${sort === 'hot' ? styles.sortBtnActive : ''}`}
          onClick={() => setSort('hot')}
        >
          <Flame size={14} /> 24h 인기
        </button>
      </div>

      {/* 목록 */}
      <div className={styles.listWrap}>
        {loading && <div className={styles.empty}>불러오는 중...</div>}
        {!loading && error && (
          <div className={styles.empty}>
            <p>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={load}>다시 시도</button>
          </div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div className={styles.empty}>
            <p>{sort === 'hot' ? '24시간 내 인기글이 아직 없어요' : '첫 글을 남겨주세요'}</p>
          </div>
        )}
        {!loading && !error && posts.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.postCard}
            onClick={() => setDetailId(p.id)}
          >
            <div className={styles.postHeader}>
              <span className={styles.postAlias}>{p.author_alias}</span>
              {isHot(p) && <span className={styles.hotBadge}><Flame size={11} /> HOT</span>}
              {p.is_mine && <span className={styles.mineBadge}>내 글</span>}
              <span className={styles.postTime}>{relTime(p.created_at)}</span>
            </div>
            <h3 className={styles.postTitle}>{p.title}</h3>
            <p className={styles.postBody}>{p.body}</p>
            {p.images && p.images.length > 0 && (
              <div className={styles.postThumbRow}>
                {p.images.slice(0, 3).map((url, i) => (
                  <img key={i} src={url} alt="" className={styles.postThumb} loading="lazy" />
                ))}
                {p.images.length > 3 && (
                  <span className={styles.postThumbMore}>+{p.images.length - 3}</span>
                )}
              </div>
            )}
            {p.category === 'meet' && p.metadata?.when && (
              <div className={styles.metaChips}>
                <span className={styles.metaChip}>📅 {p.metadata.when}</span>
                {p.metadata.place && <span className={styles.metaChip}>📍 {p.metadata.place}</span>}
                {p.metadata.capacity && <span className={styles.metaChip}>👥 {p.metadata.capacity}명</span>}
              </div>
            )}
            <div className={styles.postFooter}>
              <span className={styles.footerStat}><Heart size={13} /> {p.like_count}</span>
              <span className={styles.footerStat}><MessageSquare size={13} /> {p.comment_count}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 글쓰기 FAB */}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setWriteOpen(true)}
        aria-label="글쓰기"
      >
        <Pencil size={20} />
        <span>글쓰기</span>
      </button>

      {writeOpen && (
        <BoardWriteModal
          defaultCategory={category}
          onClose={() => setWriteOpen(false)}
          onDone={handleWriteDone}
        />
      )}
      {detailId !== null && (
        <BoardPostDetail id={detailId} onClose={handleDetailClose} />
      )}
    </div>
  );
}
