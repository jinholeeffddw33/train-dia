'use client';

import { useState, useRef } from 'react';
import { useHazardStore } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import styles from './Hazard.module.css';

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      const scale = img.width > MAX ? MAX / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          resolve(new File([blob!], 'photo.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82,
      );
    };
    img.src = url;
  });
}

interface HazardFormProps {
  onClose: () => void;
  category?: 'hazard' | 'action' | 'inspect';
  title?: string;
}

const CATEGORY_TITLES: Record<string, string> = {
  hazard: '위험요소 등록',
  action: '조치 등록',
  inspect: '점검 등록',
};

export default function HazardForm({ onClose, category = 'hazard', title }: HazardFormProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const createReport = useHazardStore((s) => s.createReport);
  const name = useDriverStore((s) => (s.myDriver ?? s.current)?.n ?? '');
  const sabun = useDriverStore((s) => (s.myDriver ?? s.current)?.s ?? '');

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  const handleSubmit = async () => {
    if (!photo) { setError('사진을 선택해주세요'); return; }
    if (!description.trim()) { setError('설명을 입력해주세요'); return; }
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }

    setSubmitting(true);
    setError('');
    try {
      await createReport({ photo, description: description.trim(), location: location.trim(), name, sabun, category });
      if (preview) URL.revokeObjectURL(preview);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formWrap}>
      <h2 className={styles.formTitle}>{title ?? CATEGORY_TITLES[category] ?? '등록'}</h2>

      {/* 사진 선택 */}
      <div
        className={`${styles.photoPickerArea} ${preview ? styles.photoPickerAreaFilled : ''}`}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="사진 선택"
      >
        {preview ? (
          <img src={preview} alt="선택된 사진" className={styles.photoPreview} />
        ) : (
          <>
            <span className={styles.photoPickerIcon}>📷</span>
            <span className={styles.photoPickerLabel}>사진 촬영 / 선택</span>
            <span className={styles.photoPickerHint}>탭하여 사진을 추가하세요</span>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handlePhotoChange}
        aria-label="사진 파일 선택"
      />

      {/* 위치 (선택) */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="hazard-location">위치 (선택)</label>
        <input
          id="hazard-location"
          type="text"
          className={styles.textInput}
          placeholder="예: 신답 → 용두 구간, 4번 선로"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
        />
      </div>

      {/* 설명 (필수) */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="hazard-desc">
          설명 <span className={styles.required}>*</span>
        </label>
        <textarea
          id="hazard-desc"
          className={styles.textArea}
          placeholder="위험요소에 대해 간단히 설명해주세요"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <span className={styles.charCount}>{description.length}/500</span>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting || !photo || !description.trim()}
      >
        {submitting ? '등록 중...' : '등록하기'}
      </button>
    </div>
  );
}
