'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, ImagePlus } from 'lucide-react';
import type { BoardCategory } from './BoardWorld';
import styles from './Board.module.css';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 미리보기 URL 생성 / 정리
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [images]);

  const onPickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // 같은 파일 재선택 가능하게
    if (files.length === 0) return;
    const remain = MAX_IMAGES - images.length;
    if (remain <= 0) { setError(`사진은 최대 ${MAX_IMAGES}장까지 가능해요`); return; }
    const accepted: File[] = [];
    for (const f of files.slice(0, remain)) {
      if (!/^image\//.test(f.type)) { setError('사진 파일만 올릴 수 있어요'); continue; }
      if (f.size > MAX_IMAGE_BYTES) { setError('사진은 5MB 이하만 올릴 수 있어요'); continue; }
      accepted.push(f);
    }
    if (accepted.length > 0) {
      setImages((prev) => [...prev, ...accepted]);
      setError(null);
    }
  }, [images.length]);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

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
      const form = new FormData();
      form.append('category', category);
      form.append('title', t);
      form.append('body', b);
      form.append('metadata', JSON.stringify(metadata));
      for (const f of images) form.append('images', f);
      const res = await fetch('/api/board/posts', { method: 'POST', body: form });
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
  }, [submitting, title, body, category, metaWhen, metaPlace, metaCapacity, images, onDone]);

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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>사진 (최대 {MAX_IMAGES}장, 1장당 5MB)</label>
            <div className={styles.imagePickerRow}>
              {previews.map((src, i) => (
                <div key={i} className={styles.imagePreviewItem}>
                  <img src={src} alt={`첨부 ${i + 1}`} className={styles.imagePreview} />
                  <button
                    type="button"
                    className={styles.imagePreviewRemove}
                    onClick={() => removeImage(i)}
                    aria-label="사진 삭제"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  className={styles.imagePickerBtn}
                  onClick={() => fileRef.current?.click()}
                  aria-label="사진 추가"
                >
                  <ImagePlus size={22} />
                  <span>{images.length}/{MAX_IMAGES}</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              className={styles.imageHiddenInput}
            />
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
