'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, Eye, MoreVertical, Pencil, Trash2, X, Check, Plus, Paperclip, Send } from 'lucide-react';
import { useHazardStore, type HazardComment } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { isAdmin } from '@/lib/auth';
import styles from './Hazard.module.css';

// Stable empty array — prevents useSyncExternalStore from triggering infinite re-renders
// when comments[reportId] is undefined (React 19 + Zustand 5 strict reference equality check)
const EMPTY_COMMENTS: HazardComment[] = [];

const DOW_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

function formatDate(iso: string): string {
  if (!iso) return '';
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseDateInfo(iso: string) {
  if (!iso) return null;
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  return {
    month: `${d.getMonth() + 1}월`,
    date: String(d.getDate()),
    dow: DOW_FULL[day],
    isHoliday: day === 0 || day === 6,
    full: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${DOW_FULL[day]}`,
  };
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
  const [showReaders, setShowReaders] = useState(false);
  const [readers, setReaders] = useState<{ name: string; readAt: string }[]>([]);
  const [loadingReaders, setLoadingReaders] = useState(false);
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
  const recordRead = useHazardStore((s) => s.recordRead);
  const fetchReaders = useHazardStore((s) => s.fetchReaders);
  const incrementView = useHazardStore((s) => s.incrementView);

  const driverName = useDriverStore((s) => (s.myDriver)?.n ?? '');
  const driverSabun = useDriverStore((s) => (s.myDriver)?.s ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const name = authName || driverName;
  const sabun = authSabun || driverSabun;

  const isMyReport = report && name && report.createdBy === name;
  const adminUser = isAdmin(sabun);
  const canManage = isMyReport || adminUser;
  const isNotice = report?.category === 'inspect';

  // 알림마당 수정용: description을 번호별 items로 파싱
  const [editItems, setEditItems] = useState<string[]>([]);
  const [removeFile, setRemoveFile] = useState(false);

  const parseDescToItems = (desc: string): string[] => {
    const lines = desc.split('\n');
    return lines.map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  };

  const itemsToDesc = (items: string[]): string => {
    return items.filter((s) => s.trim()).map((text, i) => `${i + 1}. ${text.trim()}`).join('\n');
  };

  useEffect(() => {
    fetchComments(reportId);
    if (sabun && name) recordRead(reportId, sabun, name);
    incrementView(reportId);
  }, [reportId, fetchComments, recordRead, incrementView, sabun, name]);

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
    setRemoveFile(false);
    if (isNotice) {
      setEditItems(parseDescToItems(report.description));
    }
    setEditMode(true);
    setShowMenu(false);
  };

  const handleEditSave = async () => {
    const desc = isNotice ? itemsToDesc(editItems) : editDesc.trim();
    if (!desc || !name || !sabun) return;
    setError('');
    try {
      await updateReport(reportId, desc, editLocation.trim(), name, sabun, removeFile || undefined);
      setEditMode(false);
      setRemoveFile(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다');
    }
  };

  const handleShowReaders = async () => {
    if (showReaders) { setShowReaders(false); return; }
    setLoadingReaders(true);
    setShowReaders(true);
    const list = await fetchReaders(reportId);
    setReaders(list);
    setLoadingReaders(false);
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
          <h1 className={styles.detailTitle}>상세보기</h1>
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
        <h1 className={styles.detailTitle}>상세보기</h1>
        {canManage && (
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
                {isMyReport && (
                  <button type="button" className={styles.menuItem} onClick={handleEditStart}>
                    <Pencil size={16} /> 수정
                  </button>
                )}
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDelete}>
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className={styles.detailScroll}>
        {/* 사진 — 빈 URL/placeholder 숨김 + 로드 실패 시 숨김 */}
        {report.photoUrl && !report.photoUrl.includes('placeholder') && report.photoUrl.length > 10 && (
          <img
            src={report.photoUrl}
            alt="첨부 사진"
            className={styles.detailPhoto}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* 내용 */}
        <div className={styles.detailContent}>
          {editMode ? (
            isNotice ? (
              /* 알림마당 수정: 번호별 항목 편집 */
              <>
                <div className={styles.noticeEditHeader}>알림마당 수정</div>
                <div className={styles.noticeItemList}>
                  {editItems.map((text, i) => (
                    <div key={i} className={`${styles.noticeItem} ${i < 2 ? styles.noticeItemHighlight : ''}`}>
                      <span className={`${styles.noticeItemNum} ${i < 2 ? styles.noticeItemNumHighlight : ''}`}>{i + 1}</span>
                      <input
                        type="text"
                        className={styles.noticeItemInput}
                        placeholder={i < 2 ? '강조 항목' : `${i + 1}번 항목`}
                        value={text}
                        onChange={(e) => { const next = [...editItems]; next[i] = e.target.value; setEditItems(next); }}
                        maxLength={200}
                      />
                      {editItems.length > 1 && (
                        <button type="button" className={styles.noticeItemDel} onClick={() => setEditItems(editItems.filter((_, j) => j !== i))}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {editItems.length < 10 && (
                  <button type="button" className={styles.noticeAddBtn} onClick={() => setEditItems([...editItems, ''])}>
                    <Plus size={14} /> 항목 추가
                  </button>
                )}
                {/* 첨부파일 삭제 */}
                {report.photoUrl && !report.photoUrl.includes('placeholder') && report.photoUrl !== '' && (
                  <div className={styles.fileDeleteWrap}>
                    <Paperclip size={14} />
                    <span className={styles.fileDeleteName}>첨부파일</span>
                    {removeFile ? (
                      <span className={styles.fileDeletedLabel}>삭제 예정 (저장 시 적용)</span>
                    ) : (
                      <button type="button" className={styles.fileDeleteBtn} onClick={() => setRemoveFile(true)}>
                        <Trash2 size={14} /> 삭제
                      </button>
                    )}
                  </div>
                )}
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={editItems.every((s) => !s.trim())}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            ) : (
              /* 일반 수정 */
              <>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>위치</label>
                  <input type="text" className={styles.textInput} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="위치 (선택)" maxLength={100} />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>설명</label>
                  <textarea className={styles.textArea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} maxLength={1000} />
                </div>
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={!editDesc.trim()}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              {/* 날짜 + 요일 강조 + 작성자 — 그라데이션 헤더 카드 */}
              {(() => {
                const di = parseDateInfo(report.createdAt);
                const isImportant = report.location === '중요알림';
                const headerCardClass = `${styles.detailHeaderCard} ${isImportant ? styles.detailHeaderCardImportant : styles.detailHeaderCardRollcall}`;
                return (
                  <div className={headerCardClass}>
                    <div className={styles.detailHeaderRow}>
                      {report.location && (
                        <span className={`${styles.noticeType} ${isImportant ? styles.noticeTypeImportant : styles.noticeTypeRollcall}`}>
                          {report.location}
                        </span>
                      )}
                      {di && (
                        <span className={styles.noticeDateWrap}>
                          <span className={styles.noticeDateMonth}>{di.month}</span>
                          <span className={styles.noticeDateDay}>{di.date}</span>
                          <span className={`${styles.noticeDateDow} ${di.isHoliday ? styles.noticeDateHoliday : ''}`}>{di.dow}</span>
                        </span>
                      )}
                      <span className={styles.detailAuthorWrap}>
                        <span className={styles.authorAvatar}>{report.createdBy.charAt(0)}</span>
                        <span className={styles.detailAuthor}>{report.createdBy}</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {!isNotice && report.location && (
                <span className={styles.detailLocation}>📍 {report.location}</span>
              )}

              {/* 알림마당: 번호 리스트 형태 — 본문 카드 */}
              {isNotice ? (
                <div className={styles.detailBodyCard}>
                  <div className={styles.noticeBody}>
                    {report.description.split('\n').map((line, i) => {
                      const num = parseInt(line);
                      const isHighlight = num === 1 || num === 2;
                      return (
                        <div key={i} className={`${styles.noticeLine} ${isHighlight ? styles.noticeLineHighlight : ''}`}>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className={styles.detailDesc}>{report.description}</p>
              )}

              {/* 첨부파일 표시 — pill 카드 스타일 */}
              {isNotice && report.photoUrl && !report.photoUrl.includes('placeholder') && report.photoUrl.length > 10 && (
                <a href={report.photoUrl} target="_blank" rel="noopener noreferrer" className={styles.noticeFileLink}>
                  <Paperclip size={14} /> 첨부파일 보기
                </a>
              )}
            </>
          )}
        </div>

        {/* 좋아요 + 조회수 */}
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
          <button
            type="button"
            className={`${styles.readersBtn} ${showReaders ? styles.readersBtnActive : ''}`}
            onClick={handleShowReaders}
            aria-label="읽은 사람 보기"
          >
            <Eye size={16} />
            <span>{report.readCount}</span>
          </button>
        </div>

        {/* 읽은 사람 목록 */}
        {showReaders && (
          <div className={styles.readersList}>
            {loadingReaders ? (
              <div className={styles.readersLoading}>불러오는 중...</div>
            ) : readers.length === 0 ? (
              <div className={styles.readersEmpty}>아직 읽은 사람이 없어요</div>
            ) : (
              readers.map((r, i) => (
                <div key={i} className={styles.readerItem}>
                  <span className={styles.readerName}>{r.name}</span>
                  <span className={styles.readerTime}>{formatDate(r.readAt)}</span>
                </div>
              ))
            )}
          </div>
        )}

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
                    <span className={styles.authorAvatar}>{c.createdBy.charAt(0)}</span>
                    <div className={styles.commentBody}>
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
            {submitting ? '...' : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
