'use client';

import { useState } from 'react';
import { X, Lock, Send, CheckCircle } from 'lucide-react';
import styles from '../styles/More.module.css';

interface Props {
  onClose: () => void;
}

export default function FeedbackOverlay({ onClose }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const MAX = 1000;
  const canSubmit = content.trim().length >= 5 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? '제보 전송에 실패했습니다');
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '잠시 후 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.fullOverlay}>
      <div className={styles.overlayHeader}>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
        <h2 className={styles.overlayTitle}>의견 / 버그 제보</h2>
      </div>

      <div className={styles.overlayBody}>
        {done ? (
          /* ── 완료 화면 ── */
          <div className={styles.feedbackDone}>
            <CheckCircle size={48} className={styles.feedbackDoneIcon} />
            <p className={styles.feedbackDoneTitle}>익명으로 전달됐어요</p>
            <p className={styles.feedbackDoneDesc}>소중한 의견 감사합니다. 확인 후 개선에 반영할게요.</p>
            <button type="button" className={styles.feedbackSubmitBtn} onClick={onClose}>
              닫기
            </button>
          </div>
        ) : (
          /* ── 입력 화면 ── */
          <div className={styles.feedbackForm}>
            {/* 익명 보장 안내 */}
            <div className={styles.feedbackAnonBadge}>
              <Lock size={14} />
              <span>이름·사번·기기 정보를 일절 수집하지 않습니다</span>
            </div>

            <p className={styles.feedbackGuide}>
              버그, 오류, 아이디어, 개선 사항 등 무엇이든 자유롭게 작성해주세요.
            </p>

            <div className={styles.feedbackTextWrap}>
              <textarea
                className={styles.feedbackTextarea}
                placeholder="예) 특정 날짜에서 다이아가 잘못 표시됩니다&#10;예) ○○ 기능이 있으면 좋겠어요"
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX))}
                maxLength={MAX}
                rows={6}
                aria-label="제보 내용"
              />
              <span className={styles.feedbackCount}>
                {content.length} / {MAX}
              </span>
            </div>

            {error && <p className={styles.feedbackError}>{error}</p>}

            <button
              type="button"
              className={styles.feedbackSubmitBtn}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <span className={styles.feedbackSpinner} aria-hidden="true" />
              ) : (
                <Send size={16} />
              )}
              {loading ? '전송 중...' : '익명으로 제보하기'}
            </button>

            <p className={styles.feedbackNote}>
              * 답장은 불가하며, 관리자만 확인합니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
