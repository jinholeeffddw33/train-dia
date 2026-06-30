'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Camera, Link as LinkIcon } from 'lucide-react';
import styles from './SafetyTips.module.css';

interface Props {
  sabun: string;
  name: string;
  onClose: () => void;
  onSuccess: () => void;
}

type ContentType = 'video' | 'image';

export default function SafetyTipsForm({ sabun, name, onClose, onSuccess }: Props) {
  const [contentType, setContentType] = useState<ContentType>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

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

  const handleSubmit = useCallback(async () => {
    if (!sabun || !name) {
      setError('사용자 정보가 없어요. 로그인 후 다시 시도해주세요.');
      return;
    }
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (contentType === 'video' && !videoUrl.trim()) {
      setError('동영상 URL을 입력해주세요.');
      return;
    }
    if (contentType === 'image' && !photo) {
      setError('사진을 선택해주세요.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('contentType', contentType);
      fd.append('sabun', sabun);
      fd.append('name', name);
      if (contentType === 'video') fd.append('videoUrl', videoUrl);
      if (contentType === 'image' && photo) fd.append('photo', photo);
      const res = await fetch('/api/safety/tips', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || '등록에 실패했어요');
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch {
      setError('네트워크 오류. 다시 시도해주세요');
      setSubmitting(false);
    }
  }, [title, description, contentType, videoUrl, photo, sabun, name, onSuccess]);

  return (
    <div className={styles.formOverlay} role="dialog" aria-modal="true">
      <div className={styles.formCard}>
        <div className={styles.formHead}>
          <h2 className={styles.formTitle}>안전상식 등록</h2>
          <button type="button" className={styles.formClose} onClick={onClose} aria-label="닫기">
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        <div className={styles.formBody}>
          {/* 콘텐츠 유형 선택 */}
          <div className={styles.formField}>
            <span className={styles.formLabel}>유형</span>
            <div className={styles.typeToggle} role="radiogroup" aria-label="콘텐츠 유형">
              <button
                type="button"
                role="radio"
                aria-checked={contentType === 'video'}
                className={`${styles.typeBtn} ${contentType === 'video' ? styles.typeBtnActive : ''}`}
                onClick={() => setContentType('video')}
              >
                🎬 동영상 (YouTube 링크)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={contentType === 'image'}
                className={`${styles.typeBtn} ${contentType === 'image' ? styles.typeBtnActive : ''}`}
                onClick={() => setContentType('image')}
              >
                🖼️ 사진 업로드
              </button>
            </div>
          </div>

          {/* 제목 */}
          <label className={styles.formField}>
            <span className={styles.formLabel}>제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="예: 리튬 배터리 화재 생존 가이드"
              className={styles.formInput}
            />
          </label>

          {/* 유형별 입력 */}
          {contentType === 'video' ? (
            <label className={styles.formField}>
              <span className={styles.formLabel}>
                <LinkIcon size={14} strokeWidth={2.4} /> 동영상 URL (YouTube)
              </span>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className={styles.formInput}
              />
            </label>
          ) : (
            <div className={styles.formField}>
              <span className={styles.formLabel}>
                <Camera size={14} strokeWidth={2.4} /> 사진
              </span>
              {preview ? (
                <div className={styles.previewWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="미리보기" className={styles.previewImg} />
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => setPhoto(null)}
                    aria-label="사진 제거"
                  >
                    <X size={16} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.photoPicker} onClick={() => fileInputRef.current?.click()}>
                  <Camera size={28} strokeWidth={2} />
                  <span>사진 선택</span>
                  <span className={styles.photoHint}>JPG/PNG · 10MB 이하</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(f);
                }}
              />
            </div>
          )}

          {/* 설명 (선택) */}
          <label className={styles.formField}>
            <span className={styles.formLabel}>설명 (선택)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="간단한 설명·핵심 요점을 적어주세요"
              className={styles.formTextarea}
            />
          </label>

          {error && <p className={styles.formError}>{error}</p>}
        </div>

        <div className={styles.formFoot}>
          <button type="button" className={styles.formBtnSecondary} onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button type="button" className={styles.formBtnPrimary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
