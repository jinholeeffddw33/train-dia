'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Inbox, Trash2 } from 'lucide-react';
import styles from '../styles/More.module.css';

interface FeedbackItem {
  id: number;
  content: string;
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

  async function handleDelete(id: number) {
    setDeletingId(id);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/feedback?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev); // 실패 시 복원
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    fetch('/api/feedback')
      .then((r) => {
        if (!r.ok) throw new Error('조회 권한이 없습니다');
        return r.json();
      })
      .then((d) => setItems(d.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.fullOverlay}>
      <div className={styles.overlayHeader}>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
        <h2 className={styles.overlayTitle}>제보 목록</h2>
        {!loading && !error && (
          <span className={styles.adminFeedbackCount}>{items.length}건</span>
        )}
      </div>

      <div className={styles.overlayBody}>
        {loading && (
          <div className={styles.adminFeedbackLoading}>
            <span className={styles.feedbackSpinner} aria-hidden="true" />
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
              <li key={item.id} className={styles.adminFeedbackItem}>
                <div className={styles.adminFeedbackMeta}>
                  <MessageSquare size={12} />
                  <span>{formatDate(item.created_at)}</span>
                  <span className={styles.adminFeedbackAnon}>익명</span>
                  <button
                    type="button"
                    className={styles.adminFeedbackDeleteBtn}
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    aria-label="제보 삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className={styles.adminFeedbackContent}>{item.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
