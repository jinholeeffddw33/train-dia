'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Camera, Calendar } from 'lucide-react';
import { DOW } from '@/lib/constants';
import MonthDatePicker from './MonthDatePicker';
import styles from './StandbyCoverage.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
interface Props {
  sabun: string;
  name: string;
  onClose: () => void;
  onSuccess: () => void;
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD → "6월 21일 (일)" */
function formatKDate(str: string): string {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${DOW[dt.getDay()]})`;
}

export default function StandbyCoverageForm({ sabun, name, onClose, onSuccess }: Props) {
  // 추천(기본 선택): 내일 — 대기충당은 주로 전일 업로드
  const recommendedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateToStr(d);
  }, []);
  const [targetDate, setTargetDate] = useState(recommendedDate);
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
    acquireScrollLock();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
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
    <div
      className={styles.formOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="대기충당현황 등록"
      onClick={(e) => {
        // 배경(dim)탭 닫기 — 카드 안 클릭은 통과
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className={styles.formCard}>
        <div className={styles.formHead}>
          <h2 className={styles.formTitle}>대기충당현황 등록</h2>
          <button type="button" className={styles.formClose} onClick={onClose} aria-label="닫기">
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.formField}>
            <span className={styles.formLabel}>
              <Calendar size={14} strokeWidth={2.4} /> 해당 날짜
              <span className={styles.formSelectedDate}>{formatKDate(targetDate)}</span>
            </span>
            <MonthDatePicker
              value={targetDate}
              onChange={setTargetDate}
              recommended={recommendedDate}
            />
          </div>

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
                className={`z-glass-pill ${styles.photoPicker}`}
                data-press
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
          <button type="button" className={`z-glass-pill ${styles.formBtnSecondary}`} data-press onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            type="button"
            className={`z-cta ${styles.formBtnPrimary}`}
            data-press
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
