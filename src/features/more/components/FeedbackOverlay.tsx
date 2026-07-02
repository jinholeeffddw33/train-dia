'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Lock, Send, CheckCircle, MessageSquare, ChevronLeft, Inbox } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { getAnonymousId } from '@/lib/anonymousId';
import styles from '../styles/More.module.css';

interface Props {
  onClose: () => void;
}

interface MyFeedback {
  id: number;
  content: string;
  created_at: string;
  has_reply: boolean;
}

interface Reply {
  id: number;
  content: string;
  is_admin: boolean;
  created_at: string;
}

type Tab = 'write' | 'mine';

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function FeedbackOverlay({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('write');
  const [anonId, setAnonId] = useState('');
  const [myList, setMyList] = useState<MyFeedback[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [openThread, setOpenThread] = useState<MyFeedback | null>(null);

  useEffect(() => {
    setAnonId(getAnonymousId());
  }, []);

  /* 내 제보 목록 로드 */
  const loadMyList = useCallback(async () => {
    if (!anonId) return;
    setMyLoading(true);
    try {
      const res = await fetch(`/api/feedback?anonymous_id=${encodeURIComponent(anonId)}`);
      const json = await res.json();
      setMyList(json.data ?? []);
    } catch {
      setMyList([]);
    } finally {
      setMyLoading(false);
    }
  }, [anonId]);

  useEffect(() => {
    if (tab === 'mine' && anonId) loadMyList();
  }, [tab, anonId, loadMyList]);

  // ESC — 대화 스레드가 열려 있으면 스레드만 닫고, 아니면 오버레이 닫기
  useEscapeClose(true, () => {
    if (openThread) setOpenThread(null);
    else onClose();
  });

  return (
    <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="의견 / 버그 제보">
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
        <h2 className={styles.overlayTitle}>
          {openThread ? '대화' : '의견 / 버그 제보'}
        </h2>
      </div>

      {!openThread && (
        <div
          className={`z-segment ${styles.feedbackTabs}`}
          data-no-press
          role="tablist"
          style={{ '--seg-count': 2, '--seg-idx': tab === 'write' ? 0 : 1 } as React.CSSProperties}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'write'}
            className={`z-segment-item ${styles.feedbackTab} ${tab === 'write' ? 'is-on' : ''}`}
            onClick={() => setTab('write')}
          >
            새 제보
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={`z-segment-item ${styles.feedbackTab} ${tab === 'mine' ? 'is-on' : ''}`}
            onClick={() => setTab('mine')}
          >
            내 대화
            {myList.some(m => m.has_reply) && <span className={styles.feedbackTabDot} aria-hidden />}
          </button>
        </div>
      )}

      <div className={styles.overlayBody}>
        {openThread ? (
          <ThreadView
            feedback={openThread}
            anonId={anonId}
            onReplied={loadMyList}
          />
        ) : tab === 'write' ? (
          <WriteView anonId={anonId} onSubmitted={() => { setTab('mine'); loadMyList(); }} />
        ) : (
          <MyListView
            items={myList}
            loading={myLoading}
            onOpen={(fb) => setOpenThread(fb)}
          />
        )}
      </div>
    </div>
  );
}

/* ── 새 제보 작성 ── */
function WriteView({ anonId, onSubmitted }: { anonId: string; onSubmitted: () => void }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const MAX = 1000;
  const canSubmit = content.trim().length >= 5 && !loading && !!anonId;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), anonymous_id: anonId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? '제보를 보내지 못했어요');
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '잠시 후 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.feedbackDone}>
        <CheckCircle size={48} className={styles.feedbackDoneIcon} />
        <p className={styles.feedbackDoneTitle}>익명으로 전달됐어요</p>
        <p className={styles.feedbackDoneDesc}>확인 후 답변해 드릴게요. &apos;내 대화&apos; 탭에서 답글을 볼 수 있어요.</p>
        <button type="button" className={`z-cta ${styles.feedbackSubmitBtn}`} data-press onClick={onSubmitted}>
          내 대화 보기
        </button>
      </div>
    );
  }

  return (
    <div className={styles.feedbackForm}>
      <div className={styles.feedbackAnonBadge}>
        <Lock size={14} />
        <span>이름·사번·기기 정보를 일절 수집하지 않아요</span>
      </div>

      <p className={styles.feedbackGuide}>
        버그, 오류, 아이디어, 개선 사항 등 무엇이든 자유롭게 작성해주세요.
      </p>

      <div className={styles.feedbackTextWrap}>
        <textarea
          className={styles.feedbackTextarea}
          placeholder="예) 특정 날짜에서 다이아가 잘못 표시됩니다&#10;예) ○○ 기능이 있으면 좋겠어요"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          rows={6}
          aria-label="제보 내용"
        />
        <span className={styles.feedbackCount}>{content.length} / {MAX}</span>
      </div>

      {error && <p className={styles.feedbackError}>{error}</p>}

      <button
        type="button"
        className={`z-cta ${styles.feedbackSubmitBtn}`}
        data-press
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {loading ? <span className={styles.feedbackSpinner} aria-hidden /> : <Send size={16} />}
        {loading ? '전송 중...' : '익명으로 제보하기'}
      </button>
    </div>
  );
}

/* ── 내 제보 목록 ── */
function MyListView({ items, loading, onOpen }: {
  items: MyFeedback[];
  loading: boolean;
  onOpen: (fb: MyFeedback) => void;
}) {
  if (loading) {
    return (
      <div className={styles.adminFeedbackLoading}>
        <span className={styles.feedbackSpinner} aria-hidden />
        <span>불러오는 중...</span>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className={styles.adminFeedbackEmpty}>
        <Inbox size={40} className={styles.adminFeedbackEmptyIcon} />
        <p>아직 보낸 제보가 없어요</p>
      </div>
    );
  }
  return (
    <ul className={styles.adminFeedbackList}>
      {items.map(fb => (
        <li key={fb.id}>
          <button type="button" className={styles.feedbackThreadItem} onClick={() => onOpen(fb)}>
            <div className={styles.adminFeedbackMeta}>
              <MessageSquare size={12} />
              <span>{formatDate(fb.created_at)}</span>
              {fb.has_reply && <span className={styles.feedbackReplyBadge}>답변 있음</span>}
            </div>
            <p className={styles.adminFeedbackContent}>{fb.content}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── 대화창 ── */
function ThreadView({ feedback, anonId, onReplied }: {
  feedback: MyFeedback;
  anonId: string;
  onReplied: () => void;
}) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback/${feedback.id}/replies?anonymous_id=${encodeURIComponent(anonId)}`);
      const json = await res.json();
      setReplies(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [feedback.id, anonId]);

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
        body: JSON.stringify({ content: msg, anonymous_id: anonId }),
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
      {/* 원본 제보 (내 메시지 버블) */}
      <div className={styles.chatScroll}>
        <div className={`${styles.chatBubble} ${styles.chatBubbleMine}`}>
          <p>{feedback.content}</p>
          <span className={styles.chatTime}>{formatDate(feedback.created_at)}</span>
        </div>

        {loading && <div className={styles.chatLoading}>불러오는 중...</div>}

        {replies.map(r => (
          <div
            key={r.id}
            className={`${styles.chatBubble} ${r.is_admin ? styles.chatBubbleAdmin : styles.chatBubbleMine}`}
          >
            {r.is_admin && <span className={styles.chatAuthor}>관리자</span>}
            <p>{r.content}</p>
            <span className={styles.chatTime}>{formatDate(r.created_at)}</span>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className={styles.chatInputBar}>
        <textarea
          className={styles.chatInput}
          placeholder="추가로 하고 싶은 말을 적어주세요"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          rows={2}
          enterKeyHint="send"
          aria-label="메시지 입력"
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
