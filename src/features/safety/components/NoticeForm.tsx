'use client';

import { useState, useRef } from 'react';
import { X, Paperclip } from 'lucide-react';
import { useHazardStore } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import styles from './Hazard.module.css';

/** 이미지 리사이즈 (최대 1280px, 품질 0.82) */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      const scale = Math.max(img.width, img.height) > MAX ? MAX / Math.max(img.width, img.height) : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        0.82,
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

interface NoticeFormProps {
  onClose: () => void;
}

export default function NoticeForm({ onClose }: NoticeFormProps) {
  const [titleText, setTitleText] = useState('');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createReport = useHazardStore((s) => s.createReport);
  const driverName = useDriverStore((s) => (s.myDriver)?.n ?? '');
  const driverSabun = useDriverStore((s) => (s.myDriver)?.s ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const name = authName || driverName;
  const sabun = authSabun || driverSabun;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    const compressed = await compressImage(f);
    setPhoto(compressed);
    setPhotoPreview(URL.createObjectURL(compressed));
  };

  const handleSubmit = async () => {
    if (!titleText.trim()) { setError('제목을 입력해주세요'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요'); return; }
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }

    setSubmitting(true);
    setError('');
    try {
      const desc = `${titleText.trim()}\n${content.trim()}`;

      // 사진 우선, 그 외 일반 첨부파일
      let photoFile: File | null = null;
      if (photo) {
        photoFile = photo;
      } else if (file) {
        photoFile = file.type.startsWith('image/') ? await compressImage(file) : file;
      }

      await createReport({
        photo: photoFile,
        description: desc,
        location: '',
        name,
        sabun,
        category: 'inspect',
      });

      // 공지사항 등록 시 전체 푸시 자동 발송
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sabun,
          title: '📋 공지사항',
          message: titleText.trim(),
        }),
      }).catch(() => {});

      if (photoPreview) URL.revokeObjectURL(photoPreview);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formWrap}>
      <h2 className={styles.formTitle}>공지사항 등록</h2>

      {/* 사진 (선택) */}
      <div className={styles.fieldGroup}>
        <div
          className={`${styles.photoPickerArea} ${photoPreview ? styles.photoPickerAreaFilled : ''}`}
          onClick={() => photoRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && photoRef.current?.click()}
          aria-label="사진 선택"
        >
          {photoPreview ? (
            <img src={photoPreview} alt="선택된 사진" className={styles.photoPreview} />
          ) : (
            <>
              <span className={styles.photoPickerIcon}>📷</span>
              <span className={styles.photoPickerLabel}>사진 촬영 / 선택 (선택)</span>
              <span className={styles.photoPickerHint}>탭하여 사진을 추가하세요</span>
            </>
          )}
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handlePhotoChange}
          aria-label="사진 파일 선택"
        />
      </div>

      {/* 제목 (필수) */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="notice-title">
          제목 <span className={styles.required}>*</span>
        </label>
        <input
          id="notice-title"
          type="text"
          className={styles.textInput}
          placeholder="제목을 입력해주세요"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          maxLength={60}
        />
      </div>

      {/* 내용 (필수) — 단일 textarea */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="notice-content">
          내용 <span className={styles.required}>*</span>
        </label>
        <textarea
          id="notice-content"
          className={styles.textArea}
          placeholder="내용을 입력해주세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          maxLength={2000}
        />
        <span className={styles.charCount}>{content.length}/2000</span>
      </div>

      {/* 일반 파일 첨부 (선택) — 이미지가 아닌 PDF·문서 등 */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>파일 첨부 (선택)</label>
        <button
          type="button"
          className={styles.filePickerBtn}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={16} />
          <span>{file ? file.name : '파일 선택'}</span>
          {file && (
            <span
              className={styles.fileRemove}
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              role="button"
              aria-label="파일 제거"
            >
              <X size={14} />
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          className={styles.hiddenInput}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </div>

      {/* 작성자 표시 */}
      <div className={styles.noticeAuthorInfo}>
        ✏️ <strong>{name}</strong> 이름으로 등록됩니다
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? '등록 중...' : '등록하기'}
      </button>
    </div>
  );
}
