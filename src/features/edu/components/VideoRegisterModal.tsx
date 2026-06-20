'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Upload, Link2, Type } from 'lucide-react';
import styles from '../styles/edu.module.css';

interface VideoCategory {
  id: string;
  label: string;
  emoji?: string;
  color?: string;
}

interface RegisteredVideo {
  id: string;
  category: string;
  title: string;
  url: string;
  source?: string;
}

interface VideoRegisterModalProps {
  open: boolean;
  categories: VideoCategory[];
  onClose: () => void;
  onRegistered: (video: RegisteredVideo) => void;
}

export default function VideoRegisterModal({
  open,
  categories,
  onClose,
  onRegistered,
}: VideoRegisterModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCategory(null);
    setTitle('');
    setUrl('');
    setError(null);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  // 열릴 때: 포커스 저장 + 첫 필드 포커스 + 스크롤 잠금, ESC/포커스 트랩
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus(), 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      prevFocusRef.current?.focus?.();
    };
  }, [open, handleClose]);

  const canSubmit =
    !!category && title.trim().length > 0 && /^https?:\/\//i.test(url.trim()) && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !category) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/edu/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title: title.trim(), url: url.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? '등록에 실패했어요. 다시 시도해주세요');
        setSubmitting(false);
        return;
      }
      onRegistered(json.video as RegisteredVideo);
      reset();
      onClose();
    } catch {
      setError('연결이 불안정해요. 잠시 후 다시 시도해주세요');
      setSubmitting(false);
    }
  }, [canSubmit, category, title, url, onRegistered, reset, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.vregOverlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.vregDialog}
        role="dialog"
        aria-modal="true"
        aria-label="영상 등록"
      >
        <div className={styles.vregHeader}>
          <h2 className={styles.vregTitle}>영상 등록</h2>
          <button
            type="button"
            className={styles.vregClose}
            onClick={handleClose}
            aria-label="닫기"
            disabled={submitting}
          >
            <X size={22} strokeWidth={2.4} />
          </button>
        </div>

        <div className={styles.vregBody}>
          {/* 1) 영역 선택 (4개) */}
          <div className={styles.vregField}>
            <span className={styles.vregLabel}>어느 영역인가요?</span>
            <div className={styles.vregAreaGrid} role="radiogroup" aria-label="영역 선택">
              {categories.map((cat) => {
                const selected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.vregArea} ${selected ? styles.vregAreaOn : ''} ${cat.color ? styles[`vregArea_${cat.color}`] : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span className={styles.vregAreaEmoji} aria-hidden>{cat.emoji}</span>
                    <span className={styles.vregAreaName}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2) 제목 */}
          <div className={styles.vregField}>
            <label className={styles.vregLabel} htmlFor="vreg-title">
              <Type size={15} strokeWidth={2.2} aria-hidden /> 제목
            </label>
            <input
              id="vreg-title"
              ref={titleInputRef}
              type="text"
              className={styles.vregInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 출고 점검 가이드"
              maxLength={100}
              inputMode="text"
            />
          </div>

          {/* 3) 링크 주소 */}
          <div className={styles.vregField}>
            <label className={styles.vregLabel} htmlFor="vreg-url">
              <Link2 size={15} strokeWidth={2.2} aria-hidden /> 링크 주소
            </label>
            <input
              id="vreg-url"
              type="url"
              className={styles.vregInput}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              maxLength={500}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <span className={styles.vregHint}>유튜브·네이버 카페 등 영상 주소를 붙여넣어 주세요</span>
          </div>

          {error && (
            <div className={styles.vregError} role="alert">
              {error}
            </div>
          )}
        </div>

        <div className={styles.vregFooter}>
          <button
            type="button"
            className={styles.vregSubmit}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            <Upload size={18} strokeWidth={2.2} aria-hidden />
            <span>{submitting ? '올리는 중...' : '영상 올리기'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
