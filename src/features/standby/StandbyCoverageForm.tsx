'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Camera, Calendar } from 'lucide-react';
import styles from './StandbyCoverage.module.css';

interface Props {
  sabun: string;
  name: string;
  onClose: () => void;
  onSuccess: () => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StandbyCoverageForm({ sabun, name, onClose, onSuccess }: Props) {
  const [targetDate, setTargetDate] = useState(todayStr());
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
    if (!photo) {
      setError('사진을 선택해주세요.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('targetDate', targetDate);
      fd.append('sabun', sabun);
      fd.append('name', name);
      fd.append('photo', photo);
      const res = await fetch('/api/standby-coverage', { method: 'POST', body: fd });
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
  }, [photo, targetDate, sabun, name, onSuccess]);

  return (
    <div className={styles.formOverlay} role="dialog" aria-modal="true">
      <div className={styles.formCard}>
        <div className={styles.formHead}>
          <h2 className={styles.formTitle}>대기충당현황 등록</h2>
          <button type="button" className={styles.formClose} onClick={onClose} aria-label="닫기">
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        <div className={styles.formBody}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>
              <Calendar size={14} strokeWidth={2.4} /> 해당 날짜
            </span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={styles.formDateInput}
              max={todayStr()}
            />
          </label>

          <div className={styles.formField}>
            <span className={styles.formLabel}>
              <Camera size={14} strokeWidth={2.4} /> 대기충당기록부 사진
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
              <button
                type="button"
                className={styles.photoPicker}
                onClick={() => fileInputRef.current?.click()}
              >
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

          {error && <p className={styles.formError}>{error}</p>}
        </div>

        <div className={styles.formFoot}>
          <button type="button" className={styles.formBtnSecondary} onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className={styles.formBtnPrimary}
            onClick={handleSubmit}
            disabled={submitting || !photo}
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
