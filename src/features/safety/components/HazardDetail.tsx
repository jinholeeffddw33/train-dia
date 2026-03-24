'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, MoreVertical, Pencil, Trash2, X, Check } from 'lucide-react';
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
  const [showMenu, setShowMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const report = useHazardStore((s) => s.reports.find((r) => r.id === reportId));
  const comments = useHazardStore((s) => s.comments[reportId] ?? EMPTY_COMMENTS);
  const loadingComments = useHazardStore((s) => s.loadingComments);
  const fetchComments = useHazardStore((s) => s.fetchComments);
  const addComment = useHazardStore((s) => s.addComment);
  const updateReport = useHazardStore((s) => s.updateReport);
  const deleteReport = useHazardStore((s) => s.deleteReport);
  const updateComment = useHazardStore((s) => s.updateComment);
  const deleteComment = useHazardStore((s) => s.deleteComment);
  const toggleLike = useHazardStore((s) => s.toggleLike);

  const name = useDriverStore((s) => (s.myDriver ?? s.current)?.n ?? '');
  const sabun = useDriverStore((s) => (s.myDriver ?? s.current)?.s ?? '');

  const isMyReport = report && name && report.createdBy === name;

  useEffect(() => {
    fetchComments(reportId);
  }, [reportId, fetchComments]);

  // 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showMenu && !commentMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setCommentMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu, commentMenuId]);

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

  const handleDelete = async () => {
    if (!name || !sabun) return;
    if (!window.confirm('정말 삭제하시겠습니까? 댓글과 사진도 모두 삭제됩니다.')) return;

    setError('');
    try {
      await deleteReport(reportId, name, sabun);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다');
    }
  };

  const handleEditStart = () => {
    if (!report) return;
    setEditDesc(report.description);
    setEditLocation(report.location);
    setEditMode(true);
    setShowMenu(false);
  };

  const handleEditSave = async () => {
    if (!editDesc.trim() || !name || !sabun) return;
    setError('');
    try {
      await updateReport(reportId, editDesc.trim(), editLocation.trim(), name, sabun);
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다');
    }
  };

  const handleLike = async () => {
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }
    setError('');
    try {
      await toggleLike(reportId, name, sabun);
    } catch (e) {
      setError(e instanceof Error ? e.message : '좋아요에 실패했습니다');
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!name || !sabun) return;
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    setError('');
    setCommentMenuId(null);
    try {
      await deleteComment(reportId, commentId, name, sabun);
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 삭제에 실패했습니다');
    }
  };

  const handleCommentEditStart = (c: HazardComment) => {
    setEditingCommentId(c.id);
    setEditCommentText(c.comment);
    setCommentMenuId(null);
  };

  const handleCommentEditSave = async () => {
    if (!editingCommentId || !editCommentText.trim() || !name || !sabun) return;
    setError('');
    try {
      await updateComment(reportId, editingCommentId, editCommentText.trim(), name, sabun);
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 수정에 실패했습니다');
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
        {isMyReport && (
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setShowMenu((v) => !v)}
              aria-label="더보기"
            >
              <MoreVertical size={20} strokeWidth={2} />
            </button>
            {showMenu && (
              <div className={styles.menuDropdown}>
                <button type="button" className={styles.menuItem} onClick={handleEditStart}>
                  <Pencil size={16} /> 수정
                </button>
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDelete}>
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className={styles.detailScroll}>
        {/* 사진 */}
        <img src={report.photoUrl} alt="위험요소 사진" className={styles.detailPhoto} />

        {/* 내용 */}
        <div className={styles.detailContent}>
          {editMode ? (
            <>
              <div className={styles.editField}>
                <label className={styles.editLabel}>위치</label>
                <input
                  type="text"
                  className={styles.textInput}
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="위치 (선택)"
                  maxLength={100}
                />
              </div>
              <div className={styles.editField}>
                <label className={styles.editLabel}>설명</label>
                <textarea
                  className={styles.textArea}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
              </div>
              <div className={styles.editActions}>
                <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                  <X size={16} /> 취소
                </button>
                <button
                  type="button"
                  className={styles.editSaveBtn}
                  onClick={handleEditSave}
                  disabled={!editDesc.trim()}
                >
                  <Check size={16} /> 저장
                </button>
              </div>
            </>
          ) : (
            <>
              {report.location && (
                <span className={styles.detailLocation}>📍 {report.location}</span>
              )}
              <p className={styles.detailDesc}>{report.description}</p>
              <div className={styles.detailMeta}>
                <span className={styles.detailAuthor}>{report.createdBy}</span>
                <span className={styles.detailDot}>·</span>
                <span className={styles.detailTime}>{formatDate(report.createdAt)}</span>
              </div>
            </>
          )}
        </div>

        {/* 좋아요 */}
        <div className={styles.likeSection}>
          <button
            type="button"
            className={`${styles.likeBtn} ${report.likedByMe ? styles.likeBtnActive : ''}`}
            onClick={handleLike}
            aria-label={report.likedByMe ? '좋아요 취소' : '좋아요'}
          >
            <Heart
              size={20}
              fill={report.likedByMe ? 'var(--dia-red)' : 'none'}
              stroke={report.likedByMe ? 'var(--dia-red)' : 'currentColor'}
            />
            <span className={styles.likeCount}>{report.likeCount}</span>
          </button>
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
              {comments.map((c) => {
                const isMyComment = name && c.createdBy === name;
                const isEditing = editingCommentId === c.id;

                return (
                  <div key={c.id} className={styles.commentCard}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>{c.createdBy}</span>
                      <div className={styles.commentHeaderRight}>
                        <span className={styles.commentTime}>{formatDate(c.createdAt)}</span>
                        {isMyComment && !isEditing && (
                          <div className={styles.commentMenuWrap}>
                            <button
                              type="button"
                              className={styles.commentMenuBtn}
                              onClick={() => setCommentMenuId(commentMenuId === c.id ? null : c.id)}
                              aria-label="댓글 더보기"
                            >
                              <MoreVertical size={14} />
                            </button>
                            {commentMenuId === c.id && (
                              <div className={styles.commentMenuDropdown} ref={menuRef}>
                                <button type="button" className={styles.menuItem} onClick={() => handleCommentEditStart(c)}>
                                  <Pencil size={14} /> 수정
                                </button>
                                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => handleCommentDelete(c.id)}>
                                  <Trash2 size={14} /> 삭제
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className={styles.commentEditWrap}>
                        <textarea
                          className={styles.commentEditInput}
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          rows={2}
                          maxLength={500}
                        />
                        <div className={styles.commentEditActions}>
                          <button
                            type="button"
                            className={styles.commentEditCancel}
                            onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            className={styles.commentEditSave}
                            onClick={handleCommentEditSave}
                            disabled={!editCommentText.trim()}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.commentText}>{c.comment}</p>
                    )}
                  </div>
                );
              })}
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
