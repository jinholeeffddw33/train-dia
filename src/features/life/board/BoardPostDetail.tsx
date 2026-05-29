'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Heart, MessageSquare, Trash2, AlertTriangle, Send, CornerDownRight, VenetianMask } from 'lucide-react';
import styles from './Board.module.css';

interface PostDetail {
  id: number;
  category: string;
  title: string;
  body: string;
  author_alias: string;
  is_anonymous: boolean;
  is_mine: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  metadata: { when?: string; place?: string; capacity?: number } | null;
  images: string[];
  i_liked: boolean;
}

interface CommentItem {
  id: number;
  parent_id: number | null;
  body: string;
  author_alias: string;
  is_mine: boolean;
  like_count: number;
  created_at: string;
  i_liked: boolean;
}

interface Props {
  id: number;
  onClose: (didChange: boolean) => void;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

export default function BoardPostDetail({ id, onClose }: Props) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [didChange, setDidChange] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; alias: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/posts/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.code === 'NOT_FOUND' ? '삭제된 글이에요' : j.code === 'HIDDEN' ? '숨김 처리된 글이에요' : '불러올 수 없어요');
      }
      const data = await res.json();
      setPost(data.post);
      setComments(data.comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(didChange); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, didChange]);

  const togglePostLike = useCallback(async () => {
    if (!post) return;
    const prevLiked = post.i_liked;
    const prevCount = post.like_count;
    // 낙관적 업데이트
    setPost({ ...post, i_liked: !prevLiked, like_count: prevCount + (prevLiked ? -1 : 1) });
    setDidChange(true);
    try {
      const res = await fetch(`/api/board/posts/${id}/likes`, { method: 'POST' });
      if (!res.ok) throw new Error('실패');
    } catch {
      // 롤백
      setPost({ ...post, i_liked: prevLiked, like_count: prevCount });
    }
  }, [post, id]);

  const toggleCommentLike = useCallback(async (cid: number) => {
    const prev = comments.find((c) => c.id === cid);
    if (!prev) return;
    setComments((cs) => cs.map((c) => c.id === cid
      ? { ...c, i_liked: !c.i_liked, like_count: c.like_count + (c.i_liked ? -1 : 1) }
      : c));
    try {
      await fetch(`/api/board/comments/${cid}/likes`, { method: 'POST' });
    } catch {
      setComments((cs) => cs.map((c) => c.id === cid ? prev : c));
    }
  }, [comments]);

  const submitComment = useCallback(async () => {
    if (submitting) return;
    const b = commentBody.trim();
    if (b.length < 1) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/board/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: b, parent_id: replyTo?.id ?? null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || '댓글 등록 실패');
      }
      setCommentBody('');
      setReplyTo(null);
      setDidChange(true);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, commentBody, id, replyTo, load]);

  const deletePost = useCallback(async () => {
    if (!confirm('이 글을 삭제할까요?')) return;
    try {
      const res = await fetch(`/api/board/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('실패');
      setDidChange(true);
      onClose(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류');
    }
  }, [id, onClose]);

  const deleteComment = useCallback(async (cid: number) => {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    try {
      const res = await fetch(`/api/board/comments/${cid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('실패');
      setDidChange(true);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류');
    }
  }, [load]);

  const reportTarget = useCallback(async (target_type: 'post' | 'comment', target_id: number) => {
    const reason = window.prompt('신고 사유를 선택해주세요\n1. 욕설·혐오  2. 스팸·광고  3. 개인정보 노출  4. 음란성  5. 기타\n(번호 입력)');
    if (!reason) return;
    const reasons = ['욕설·혐오', '스팸·광고', '개인정보 노출', '음란성', '기타'];
    const idx = parseInt(reason) - 1;
    if (isNaN(idx) || idx < 0 || idx >= reasons.length) { alert('1~5 사이로 입력해주세요'); return; }
    try {
      const res = await fetch('/api/board/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type, target_id, reason: reasons[idx] }),
      });
      if (!res.ok) throw new Error('신고 실패');
      alert('신고가 접수되었어요. 검토 후 처리됩니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류');
    }
  }, []);

  // 댓글 트리 구성 (1단 + 대댓글)
  const tree = comments.filter((c) => !c.parent_id).map((parent) => ({
    parent,
    children: comments.filter((c) => c.parent_id === parent.id),
  }));

  return (
    <div className={styles.detailOverlay} role="dialog" aria-modal="true" aria-label={post?.title || '게시글'}>
      <div className={styles.detailHeader}>
        <button type="button" className={styles.iconBtn} onClick={() => onClose(didChange)} aria-label="닫기">
          <X size={20} />
        </button>
        <span className={styles.detailHeaderTitle}>게시글</span>
        {post?.is_mine && (
          <button type="button" className={styles.iconBtn} onClick={deletePost} aria-label="글 삭제">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <div className={styles.detailBody}>
        {loading && <div className={styles.empty}>불러오는 중...</div>}
        {!loading && error && (
          <div className={styles.empty}>
            <p>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={() => onClose(didChange)}>돌아가기</button>
          </div>
        )}
        {!loading && !error && post && (
          <>
            <article className={styles.detailPost}>
              <div className={styles.postHeader}>
                {post.is_anonymous && <VenetianMask size={13} className={styles.anonIcon} aria-label="익명" />}
                <span className={styles.postAlias}>{post.author_alias}</span>
                {post.is_mine && <span className={styles.mineBadge}>내 글</span>}
                <span className={styles.postTime}>{relTime(post.created_at)}</span>
                {!post.is_mine && (
                  <button type="button" className={styles.reportBtn} onClick={() => reportTarget('post', post.id)} aria-label="신고">
                    <AlertTriangle size={14} />
                  </button>
                )}
              </div>
              <h2 className={styles.detailTitle}>{post.title}</h2>
              {post.metadata?.when && (
                <div className={styles.metaChips}>
                  <span className={styles.metaChip}>📅 {post.metadata.when}</span>
                  {post.metadata.place && <span className={styles.metaChip}>📍 {post.metadata.place}</span>}
                  {post.metadata.capacity && <span className={styles.metaChip}>👥 {post.metadata.capacity}명</span>}
                </div>
              )}
              <div className={styles.detailBodyText}>{post.body}</div>
              {post.images && post.images.length > 0 && (
                <div className={styles.detailImagesWrap}>
                  {post.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.detailImageLink}>
                      <img src={url} alt={`첨부 사진 ${i + 1}`} className={styles.detailImage} loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <div className={styles.detailActions}>
                <button
                  type="button"
                  className={`${styles.likeBtn} ${post.i_liked ? styles.likeBtnActive : ''}`}
                  onClick={togglePostLike}
                >
                  <Heart size={16} fill={post.i_liked ? 'currentColor' : 'none'} />
                  <span>{post.like_count}</span>
                </button>
                <span className={styles.stat}><MessageSquare size={16} /> {post.comment_count}</span>
              </div>
            </article>

            {/* 댓글 */}
            <section className={styles.commentSection}>
              <h3 className={styles.commentHeader}>댓글 {post.comment_count}</h3>
              {tree.length === 0 && <div className={styles.empty}>첫 댓글을 남겨주세요</div>}
              {tree.map(({ parent, children }) => (
                <div key={parent.id} className={styles.commentThread}>
                  <div className={styles.commentItem}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAlias}>{parent.author_alias}</span>
                      {parent.is_mine && <span className={styles.mineBadgeSmall}>내</span>}
                      <span className={styles.commentTime}>{relTime(parent.created_at)}</span>
                    </div>
                    <p className={styles.commentBody}>{parent.body}</p>
                    <div className={styles.commentActions}>
                      <button
                        type="button"
                        className={`${styles.commentLikeBtn} ${parent.i_liked ? styles.commentLikeBtnActive : ''}`}
                        onClick={() => toggleCommentLike(parent.id)}
                      >
                        <Heart size={12} fill={parent.i_liked ? 'currentColor' : 'none'} /> {parent.like_count}
                      </button>
                      <button
                        type="button"
                        className={styles.commentReplyBtn}
                        onClick={() => setReplyTo({ id: parent.id, alias: parent.author_alias })}
                      >
                        답글
                      </button>
                      {parent.is_mine ? (
                        <button type="button" className={styles.commentReplyBtn} onClick={() => deleteComment(parent.id)}>
                          <Trash2 size={12} /> 삭제
                        </button>
                      ) : (
                        <button type="button" className={styles.commentReplyBtn} onClick={() => reportTarget('comment', parent.id)}>
                          <AlertTriangle size={12} /> 신고
                        </button>
                      )}
                    </div>
                  </div>

                  {children.map((child) => (
                    <div key={child.id} className={`${styles.commentItem} ${styles.commentChild}`}>
                      <CornerDownRight size={14} className={styles.replyIcon} />
                      <div className={styles.commentChildContent}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentAlias}>{child.author_alias}</span>
                          {child.is_mine && <span className={styles.mineBadgeSmall}>내</span>}
                          <span className={styles.commentTime}>{relTime(child.created_at)}</span>
                        </div>
                        <p className={styles.commentBody}>{child.body}</p>
                        <div className={styles.commentActions}>
                          <button
                            type="button"
                            className={`${styles.commentLikeBtn} ${child.i_liked ? styles.commentLikeBtnActive : ''}`}
                            onClick={() => toggleCommentLike(child.id)}
                          >
                            <Heart size={12} fill={child.i_liked ? 'currentColor' : 'none'} /> {child.like_count}
                          </button>
                          {child.is_mine ? (
                            <button type="button" className={styles.commentReplyBtn} onClick={() => deleteComment(child.id)}>
                              <Trash2 size={12} /> 삭제
                            </button>
                          ) : (
                            <button type="button" className={styles.commentReplyBtn} onClick={() => reportTarget('comment', child.id)}>
                              <AlertTriangle size={12} /> 신고
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      {/* 댓글 입력 */}
      {!loading && !error && post && (
        <div className={styles.commentInputBar}>
          {replyTo && (
            <div className={styles.replyTo}>
              <span>↪ {replyTo.alias}에게 답글</span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="답글 취소">
                <X size={14} />
              </button>
            </div>
          )}
          <div className={styles.commentInputRow}>
            <textarea
              className={styles.commentInput}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={replyTo ? '답글을 입력하세요' : '댓글을 입력하세요'}
              maxLength={500}
              rows={1}
            />
            <button type="button" className={styles.commentSendBtn} onClick={submitComment} disabled={submitting || !commentBody.trim()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
