'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, MessageSquare, Inbox, Trash2, ChevronLeft, Send, ChevronRight } from 'lucide-react';
import styles from '../styles/More.module.css';

interface FeedbackItem {
  id: number;
  content: string;
  created_at: string;
  has_reply?: boolean;
  anonymous_id?: string;
}

interface Reply {
  id: number;
  content: string;
  is_admin: boolean;
  created_at: string;
}

interface Props {
  onClose: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AdminFeedbackOverlay({ onClose }: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openThread, setOpenThread] = useState<FeedbackItem | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback');
      if (!res.ok) throw new Error('조회 권한이 없습니다');
      const data = await res.json();
      setItems(data.data ?? []);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패');
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/feedback?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.fullOverlay}>
      <div className={styles.overlayHeader}>
        {openThread ? (
          <button type="button" className={styles.overlayClose} onClick={() => setOpenThread(null)} aria-label="뒤로">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        )}
        <h2 className={styles.overlayTitle}>{openThread ? '대화' : '제보 목록'}</h2>
        {!openThread && !loading && !error && (
          <span className={styles.adminFeedbackCount}>{items.length}건</span>
        )}
      </div>

      <div className={styles.overlayBody}>
        {openThread ? (
          <AdminThreadView feedback={openThread} onReplied={loadList} />
        ) : (
          <>
            {loading && (
              <div className={styles.adminFeedbackLoading}>
                <span className={styles.feedbackSpinner} aria-hidden />
                <span>불러오는 중...</span>
              </div>
            )}

            {!loading && error && (
              <div className={styles.adminFeedbackError}>
                <p>{error}</p>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className={styles.adminFeedbackEmpty}>
                <Inbox size={40} className={styles.adminFeedbackEmptyIcon} />
                <p>아직 제보가 없어요</p>
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <ul className={styles.adminFeedbackList}>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.feedbackThreadItem}
                      onClick={() => setOpenThread(item)}
                    >
                      <div className={styles.adminFeedbackMeta}>
                        <MessageSquare size={12} />
                        <span>{formatDate(item.created_at)}</span>
                        <span className={styles.adminFeedbackAnon}>익명</span>
                        {item.has_reply && <span className={styles.feedbackReplyBadge}>답변완료</span>}
                        <button
                          type="button"
                          className={styles.adminFeedbackDeleteBtn}
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deletingId === item.id}
                          aria-label="제보 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className={styles.adminFeedbackContent}>{item.content}</p>
                      <ChevronRight size={16} className={styles.feedbackThreadArrow} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── 관리자 대화 뷰 ── */
function AdminThreadView({ feedback, onReplied }: { feedback: FeedbackItem; onReplied: () => void }) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback/${feedback.id}/replies`);
      const json = await res.json();
      setReplies(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [feedback.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/feedback/${feedback.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg }),
      });
      if (res.ok) {
        setText('');
        await load();
        onReplied();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.threadWrap}>
      <div className={styles.chatScroll}>
        {/* 원본 제보 (익명 사용자 = 왼쪽 버블) */}
        <div className={`${styles.chatBubble} ${styles.chatBubbleUser}`}>
          <span className={styles.chatAuthor}>익명</span>
          <p>{feedback.content}</p>
          <span className={styles.chatTime}>{formatDate(feedback.created_at)}</span>
        </div>

        {loading && <div className={styles.chatLoading}>불러오는 중...</div>}

        {replies.map(r => (
          <div
            key={r.id}
            className={`${styles.chatBubble} ${r.is_admin ? styles.chatBubbleMine : styles.chatBubbleUser}`}
          >
            {!r.is_admin && <span className={styles.chatAuthor}>익명</span>}
            <p>{r.content}</p>
            <span className={styles.chatTime}>{formatDate(r.created_at)}</span>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div className={styles.chatInputBar}>
        <textarea
          className={styles.chatInput}
          placeholder="답변을 입력하세요"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          rows={2}
          enterKeyHint="send"
          aria-label="답글 입력"
        />
        <button
          type="button"
          className={styles.chatSendBtn}
          onClick={handleSend}
          disabled={!text.trim() || sending}
          aria-label="보내기"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
