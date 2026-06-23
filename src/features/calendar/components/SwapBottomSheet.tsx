'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useSwapStore } from '@/stores/swap';
import { getDia, getType, getSchedule, getLabel, getDiaDisplay } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import styles from '../styles/Calendar.module.css';

interface SwapBottomSheetProps {
  dateStr: string;
  onClose: () => void;
}

export default function SwapBottomSheet({ dateStr, onClose }: SwapBottomSheetProps) {
  const driver = useDriverStore((s) => s.current);
  const { getSwap, setSwap, removeSwap } = useSwapStore();
  const [inputDia, setInputDia] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 닫기 = 아래로 슬라이드 + dim 페이드 → 끝난 뒤 onClose (Modal SSOT 와 동일 거동).
  const requestClose = useCallback(() => {
    setClosing((prev) => {
      if (prev) return prev;
      closeTimer.current = setTimeout(() => onClose(), 330);
      return true;
    });
  }, [onClose]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dow = DOW[date.getDay()];

  // 현재 교번 (원래 교번)
  const originalDia = driver ? getDia(driver, date) : '';
  const originalType = getType(originalDia);
  const originalDisplay = getDiaDisplay(originalDia);

  // 기존 변경이 있으면 로드
  const existingSwap = getSwap(dateStr);

  useEffect(() => {
    if (existingSwap) {
      setInputDia(existingSwap.dia);
    }
  }, [existingSwap]);

  // 입력된 교번의 프리뷰
  const previewDia = inputDia.trim();
  const previewType = previewDia ? getType(previewDia) : null;
  const previewLabel = previewDia ? getLabel(previewDia) : '';
  const previewSchedule = previewDia ? getSchedule(previewDia, date) : null;

  // 유효성: 빈 값 아님 + 원래 교번과 다름
  const isValid = previewDia !== '' && previewDia !== originalDia;

  // 포커스 트랩 + ESC
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  // 바깥 클릭
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      requestClose();
    }
  }, [requestClose]);

  const handleSave = () => {
    if (!isValid || !driver) return;
    setSwap(dateStr, previewDia, driver.I);
    requestClose();
  };

  const handleRemove = () => {
    removeSwap(dateStr);
    requestClose();
  };

  const typeColorClass = (type: string | null) => {
    if (!type) return '';
    return styles[`swapType_${type}`] || '';
  };

  return (
    <div
      className={styles.swapOverlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="교번 변경"
    >
      <div className={`${styles.swapDim} ${closing ? styles.swapDimClosing : ''}`} aria-hidden />
      <div className={`${styles.swapSheet} ${closing ? styles.swapSheetClosing : ''}`} ref={sheetRef}>
        {/* 핸들바 */}
        <div className={styles.swapHandle} />

        {/* 헤더 */}
        <div className={styles.swapHeader}>
          <span className={styles.swapTitle}>교번 변경</span>
          <span className={styles.swapDate}>{month}월 {day}일 ({dow})</span>
        </div>

        {/* 현재 교번 */}
        <div className={styles.swapCurrentRow}>
          <span className={styles.swapCurrentLabel}>현재 교번</span>
          <span className={`${styles.swapCurrentBadge} ${styles[`detailType_${originalType}`]}`}>
            {originalDisplay}
          </span>
        </div>

        {/* 입력 */}
        <div className={styles.swapInputGroup}>
          <label className={styles.swapInputLabel} htmlFor="swap-dia-input">
            변경할 교번 번호
          </label>
          <input
            id="swap-dia-input"
            ref={inputRef}
            type="text"
            className={styles.swapInput}
            placeholder="예: 5, 대1, 78"
            value={inputDia}
            onChange={(e) => setInputDia(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid) handleSave();
            }}
            autoComplete="off"
          />
        </div>

        {/* 프리뷰 */}
        {previewDia && (
          <div className={styles.swapPreview}>
            <div className={styles.swapPreviewHeader}>
              <span className={`${styles.swapPreviewBadge} ${typeColorClass(previewType)}`}>
                {previewDia}
              </span>
              <span className={styles.swapPreviewLabel}>{previewLabel}</span>
            </div>
            {previewSchedule && previewSchedule.s && (
              <div className={styles.swapPreviewTimes}>
                <div className={styles.swapPreviewTimeItem}>
                  <span className={styles.swapPreviewTimeLabel}>출근</span>
                  <span className={styles.swapPreviewTimeValue}>{previewSchedule.s}</span>
                </div>
                <div className={styles.swapPreviewTimeItem}>
                  <span className={styles.swapPreviewTimeLabel}>퇴근</span>
                  <span className={styles.swapPreviewTimeValue}>{previewSchedule.e}</span>
                </div>
              </div>
            )}
            {!previewSchedule && previewType === 'rest' && (
              <p className={styles.swapPreviewRest}>근무 없음 (휴무/비번)</p>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className={styles.swapActions}>
          {existingSwap && (
            <button
              type="button"
              className={`z-glass-pill ${styles.swapRemoveBtn}`}
              onClick={handleRemove}
            >
              원래대로
            </button>
          )}
          <button
            type="button"
            className={styles.swapSaveBtn}
            onClick={handleSave}
            disabled={!isValid}
          >
            변경하기
          </button>
        </div>
      </div>
    </div>
  );
}
