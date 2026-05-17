'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import type { BoardCategory } from './BoardWorld';
import styles from './Board.module.css';

const CATEGORIES: { id: BoardCategory; label: string; emoji: string }[] = [
  { id: 'free',   label: '자유',    emoji: '💬' },
  { id: 'tip',    label: '업무팁',  emoji: '💡' },
  { id: 'meet',   label: '모임',    emoji: '🤝' },
  { id: 'advice', label: '고민상담', emoji: '🙏' },
];

interface Props {
  defaultCategory: BoardCategory;
  onClose: () => void;
  onDone: () => void;
}

export default function BoardWriteModal({ defaultCategory, onClose, onDone }: Props) {
  const [category, setCategory] = useState<BoardCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // 모임 전용 메타
  const [metaWhen, setMetaWhen] = useState('');
  const [metaPlace, setMetaPlace] = useState('');
  const [metaCapacity, setMetaCapacity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const submit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    const t = title.trim();
    const b = body.trim();
    if (t.length < 1) { setError('제목을 입력해주세요'); return; }
    if (b.length < 1) { setError('내용을 입력해주세요'); return; }
    setSubmitting(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (category === 'meet') {
        if (metaWhen.trim()) metadata.when = metaWhen.trim();
        if (metaPlace.trim()) metadata.place = metaPlace.trim();
        const cap = parseInt(metaCapacity);
        if (!isNaN(cap) && cap > 0) metadata.capacity = cap;
      }
      const res = await fetch('/api/board/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title: t, body: b, metadata }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || '글 등록에 실패했어요');
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, body, category, metaWhen, metaPlace, metaCapacity, onDone]);

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="글쓰기"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>새 글</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>카테고리</label>
            <div className={styles.catGrid}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.catChip} ${category === c.id ? styles.catChipActive : ''}`}
                  onClick={() => setCategory(c.id)}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
            {category === 'advice' && (
              <p className={styles.formHint}>고민상담은 다른 카테고리와 별도 가명으로 작성됩니다</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="bw-title">제목</label>
            <input
              id="bw-title"
              type="text"
              className={styles.formInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="제목을 입력하세요"
            />
            <span className={styles.formCount}>{title.length} / 80</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="bw-body">내용</label>
            <textarea
              id="bw-body"
              className={styles.formTextarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="자유롭게 작성해주세요"
              rows={8}
            />
            <span className={styles.formCount}>{body.length} / 2000</span>
          </div>

          {category === 'meet' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>모임 정보 (선택)</label>
              <input
                type="text"
                className={styles.formInput}
                value={metaWhen}
                onChange={(e) => setMetaWhen(e.target.value)}
                placeholder="📅 일시 (예: 5/25 토요일 오후 7시)"
                maxLength={50}
              />
              <input
                type="text"
                className={styles.formInput}
                value={metaPlace}
                onChange={(e) => setMetaPlace(e.target.value)}
                placeholder="📍 장소 (예: 답십리역 1번 출구)"
                maxLength={50}
              />
              <input
                type="number"
                className={styles.formInput}
                value={metaCapacity}
                onChange={(e) => setMetaCapacity(e.target.value)}
                placeholder="👥 모집 인원 (숫자)"
                min={1}
                max={99}
              />
            </div>
          )}

          {error && <div className={styles.formError}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button type="button" className={styles.btnPrimary} onClick={submit} disabled={submitting}>
            <Send size={16} /> {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
