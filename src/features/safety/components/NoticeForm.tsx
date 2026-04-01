'use client';

import { useState, useRef } from 'react';
import { Plus, X, Paperclip } from 'lucide-react';
import { useHazardStore } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import styles from './Hazard.module.css';

type NoticeType = 'rollcall' | 'important';

const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  rollcall: '점호내용',
  important: '중요알림',
};

interface NoticeFormProps {
  onClose: () => void;
}

export default function NoticeForm({ onClose }: NoticeFormProps) {
  const [noticeType, setNoticeType] = useState<NoticeType>('rollcall');
  const [items, setItems] = useState<string[]>(['']);
  const [longText, setLongText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const createReport = useHazardStore((s) => s.createReport);
  const driverName = useDriverStore((s) => (s.myDriver)?.n ?? '');
  const driverSabun = useDriverStore((s) => (s.myDriver)?.s ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const name = authName || driverName;
  const sabun = authSabun || driverSabun;

  const addItem = () => {
    if (items.length >= 10) return;
    setItems([...items, '']);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    setItems(next);
  };

  const handleSubmit = async () => {
    if (noticeType === 'important') {
      if (!longText.trim()) { setError('내용을 입력해주세요'); return; }
    } else {
      const filled = items.filter((s) => s.trim());
      if (filled.length === 0) { setError('최소 1개 항목을 입력해주세요'); return; }
    }
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }

    setSubmitting(true);
    setError('');
    try {
      const desc = noticeType === 'important'
        ? longText.trim()
        : items.filter((s) => s.trim()).map((text, i) => `${i + 1}. ${text.trim()}`).join('\n');
      const filled = noticeType === 'important' ? [longText.trim()] : items.filter((s) => s.trim());

      // location 필드에 분류 저장
      const location = NOTICE_TYPE_LABELS[noticeType];

      // 파일 첨부: 사진 대신 파일을 전송 (없으면 1x1 투명 placeholder)
      let photoFile: File;
      if (file) {
        photoFile = file;
      } else {
        // API에서 photo 필수이므로 1x1 투명 PNG placeholder
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/png'),
        );
        photoFile = new File([blob], 'placeholder.png', { type: 'image/png' });
      }

      await createReport({
        photo: photoFile,
        description: desc,
        location,
        name,
        sabun,
        category: 'inspect',
      });

      // 알림마당 등록 시 전체 푸시 자동 발송
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sabun,
          title: `📋 알림마당 — ${location}`,
          message: filled[0].trim(),
        }),
      }).catch(() => {});

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formWrap}>
      <h2 className={styles.formTitle}>알림마당 등록</h2>

      {/* 분류 선택 */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>분류 <span className={styles.required}>*</span></label>
        <div className={styles.noticeTypeGroup}>
          {(Object.entries(NOTICE_TYPE_LABELS) as [NoticeType, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${styles.noticeTypeBtn} ${noticeType === key ? styles.noticeTypeBtnActive : ''}`}
              onClick={() => setNoticeType(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 내용 입력 — 점호: 번호별 / 중요알림: 자유 텍스트 */}
      {noticeType === 'important' ? (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            내용 <span className={styles.required}>*</span>
            <span className={styles.charCount}>{longText.length}/2000</span>
          </label>
          <textarea
            className={styles.importantTextArea}
            placeholder="중요 알림 내용을 자유롭게 작성하세요"
            value={longText}
            onChange={(e) => setLongText(e.target.value)}
            rows={8}
            maxLength={2000}
          />
        </div>
      ) : (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            내용 <span className={styles.required}>*</span>
            <span className={styles.charCount}>{items.length}/10</span>
          </label>
          <div className={styles.noticeItemList}>
            {items.map((text, i) => (
              <div key={i} className={`${styles.noticeItem} ${i < 2 ? styles.noticeItemHighlight : ''}`}>
                <span className={`${styles.noticeItemNum} ${i < 2 ? styles.noticeItemNumHighlight : ''}`}>
                  {i + 1}
                </span>
                <input
                  type="text"
                  className={styles.noticeItemInput}
                  placeholder={i < 2 ? '강조 항목' : `${i + 1}번 항목`}
                  value={text}
                  onChange={(e) => updateItem(i, e.target.value)}
                  maxLength={200}
                />
                {items.length > 1 && (
                  <button type="button" className={styles.noticeItemDel} onClick={() => removeItem(i)} aria-label="삭제">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {items.length < 10 && (
            <button type="button" className={styles.noticeAddBtn} onClick={addItem}>
              <Plus size={14} /> 항목 추가
            </button>
          )}
        </div>
      )}

      {/* 파일 첨부 */}
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
        disabled={submitting || (noticeType === 'important' ? !longText.trim() : items.every((s) => !s.trim()))}
      >
        {submitting ? '등록 중...' : '등록하기'}
      </button>
    </div>
  );
}
