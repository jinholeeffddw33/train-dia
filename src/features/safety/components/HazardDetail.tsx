'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useHazardStore, type HazardComment } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import styles from './Hazard.module.css';

// Stable empty array — prevents useSyncExternalStore from triggering infinite re-renders
// when comments[reportId] is undefined (React 19 + Zustand 5 strict reference equality check)
const EMPTY_COMMENTS: HazardComment[] = [];

function formatDate(iso: string): string {
  if (!iso) return '';
  // Supabase timestamps: "2026-03-23 14:26:56.577709+00" — Safari requires ISO 8601 with T separator
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface HazardDetailProps {
  reportId: string;
  onBack: () => void;
}

export default function HazardDetail({ reportId, onBack }: HazardDetailProps) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const report = useHazardStore((s) => s.reports.find((r) => r.id === reportId));
  const comments = useHazardStore((s) => s.comments[reportId] ?? EMPTY_COMMENTS);
  const loadingComments = useHazardStore((s) => s.loadingComments);
  const fetchComments = useHazardStore((s) => s.fetchComments);
  const addComment = useHazardStore((s) => s.addComment);

  const name = useDriverStore((s) => (s.myDriver ?? s.current)?.n ?? '');
  const sabun = useDriverStore((s) => (s.myDriver ?? s.current)?.s ?? '');

  useEffect(() => {
    fetchComments(reportId);
  }, [reportId, fetchComments]);

  const handleSend = async () => {
    if (!commentText.trim()) return;
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }

    setSubmitting(true);
    setError('');
    try {
      await addComment(reportId, commentText.trim(), name, sabun);
      setCommentText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (!report) {
    return (
      <div className={styles.detailWrap}>
        <header className={styles.detailHeader}>
          <button type="button" className={styles.detailBackBtn} onClick={onBack} aria-label="뒤로">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.detailTitle}>위험요소</h1>
        </header>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>게시물을 찾을 수 없어요</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailWrap}>
      <header className={styles.detailHeader}>
        <button type="button" className={styles.detailBackBtn} onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.detailTitle}>위험요소</h1>
      </header>

      <div className={styles.detailScroll}>
        {/* 사진 */}
        <img src={report.photoUrl} alt="위험요소 사진" className={styles.detailPhoto} />

        {/* 내용 */}
        <div className={styles.detailContent}>
          {report.location && (
            <span className={styles.detailLocation}>📍 {report.location}</span>
          )}
          <p className={styles.detailDesc}>{report.description}</p>
          <div className={styles.detailMeta}>
            <span className={styles.detailAuthor}>{report.createdBy}</span>
            <span className={styles.detailDot}>·</span>
            <span className={styles.detailTime}>{formatDate(report.createdAt)}</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* 댓글 섹션 */}
        <div className={styles.commentsSection}>
          <h2 className={styles.commentsTitle}>
            댓글 <span className={styles.commentsCount}>{comments.length}</span>
          </h2>

          {loadingComments && comments.length === 0 ? (
            <div className={styles.loadingState}>
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
            </div>
          ) : comments.length === 0 ? (
            <div className={styles.emptyComments}>
              <p>첫 댓글을 달아주세요</p>
            </div>
          ) : (
            <div className={styles.commentList}>
              {comments.map((c) => (
                <div key={c.id} className={styles.commentCard}>
                  <div className={styles.commentHeader}>
                    <span className={styles.commentAuthor}>{c.createdBy}</span>
                    <span className={styles.commentTime}>{formatDate(c.createdAt)}</span>
                  </div>
                  <p className={styles.commentText}>{c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 스크롤 앵커 */}
        <div ref={bottomRef} className={styles.commentAnchor} />
      </div>

      {/* 댓글 입력 (하단 고정) */}
      <div className={styles.commentInputWrap}>
        {error && <p className={styles.commentError}>{error}</p>}
        <div className={styles.commentInputRow}>
          <textarea
            className={styles.commentInput}
            placeholder="댓글을 입력하세요..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={1}
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={submitting || !commentText.trim()}
            aria-label="댓글 등록"
          >
            {submitting ? '...' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
