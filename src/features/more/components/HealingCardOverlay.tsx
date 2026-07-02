'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useHealingCardStore, type HealingCardEntry } from '@/stores/healingCard';
import styles from '../styles/HealingCard.module.css';
import moreStyles from '../styles/More.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 금액 포맷 (1,000 단위 콤마) */
function formatMoney(n: number): string {
  return n.toLocaleString('ko-KR');
}

export default function HealingCardOverlay({ open, onClose }: Props) {
  const { limit, entries, setLimit, addEntry, removeEntry, checkMonthlyReset, totalUsed, remaining } = useHealingCardStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showLimitEdit, setShowLimitEdit] = useState(false);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 월 초기화 체크
  useEffect(() => {
    if (open) checkMonthlyReset();
  }, [open, checkMonthlyReset]);

  // ESC 로 닫기
  useEscapeClose(open, onClose);

  if (!open) return null;

  const used = totalUsed();
  const remain = remaining();
  const usagePercent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  const handleAddEntry = () => {
    const parsed = parseInt(amount.replace(/,/g, ''));
    if (!parsed || parsed <= 0) return;
    addEntry(parsed, memo.trim() || '사용');
    setAmount('');
    setMemo('');
    setShowAddForm(false);
  };

  const handleLimitSave = () => {
    const parsed = parseInt(newLimit.replace(/,/g, ''));
    if (!parsed || parsed <= 0) return;
    setLimit(parsed);
    setShowLimitEdit(false);
    setNewLimit('');
  };

  const handleDeleteEntry = (id: string) => {
    if (deleteConfirmId === id) {
      removeEntry(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  // 금액 입력 포맷팅
  const handleAmountChange = (value: string, setter: (v: string) => void) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits === '') { setter(''); return; }
    setter(parseInt(digits).toLocaleString('ko-KR'));
  };

  const currentMonthLabel = (() => {
    const d = new Date();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  })();

  return (
    <div className={moreStyles.fullOverlay} role="dialog" aria-modal="true" aria-label="힐링카드 잔액">
      <div className={moreStyles.overlayHeader}>
        <button
          type="button"
          className={moreStyles.overlayClose}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={22} />
        </button>
        <h2 className={moreStyles.overlayTitle}>힐링카드 잔액</h2>
      </div>

      <div className={styles.body}>
        {/* 잔액 카드 */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceHeader}>
            <span className={styles.balanceMonth}>{currentMonthLabel}</span>
            <button
              type="button"
              className={styles.limitEditBtn}
              onClick={() => { setShowLimitEdit(!showLimitEdit); setNewLimit(String(limit)); }}
              aria-label="한도 변경"
            >
              <Settings size={16} />
            </button>
          </div>
          <div className={styles.balanceAmount}>
            <span className={styles.balanceLabel}>잔액</span>
            <span className={remain < 0 ? styles.balanceNegative : styles.balanceValue}>
              {formatMoney(remain)}원
            </span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              /* STYLE-EXCEPTION: 동적 퍼센트 값 */
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className={styles.balanceDetail}>
            <span>사용 {formatMoney(used)}원</span>
            <span>한도 {formatMoney(limit)}원</span>
          </div>
        </div>

        {/* 한도 변경 폼 */}
        {showLimitEdit && (
          <div className={styles.formCard}>
            <label className={styles.formLabel}>월 한도 금액</label>
            <div className={styles.formRow}>
              <input
                type="text"
                inputMode="numeric"
                className={styles.formInput}
                placeholder="300,000"
                value={newLimit}
                onChange={(e) => handleAmountChange(e.target.value, setNewLimit)}
              />
              <span className={styles.formUnit}>원</span>
              <button
                type="button"
                className={`z-cta ${styles.formSubmit}`}
                data-press
                onClick={handleLimitSave}
              >
                저장
              </button>
            </div>
          </div>
        )}

        {/* 사용 기록 추가 버튼 */}
        {!showAddForm ? (
          <button
            type="button"
            className={`z-cta ${styles.addBtn}`}
            data-press
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={18} />
            사용 기록 추가
          </button>
        ) : (
          <div className={styles.formCard}>
            <label className={styles.formLabel}>사용 금액</label>
            <div className={styles.formRow}>
              <input
                type="text"
                inputMode="numeric"
                className={styles.formInput}
                placeholder="15,000"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value, setAmount)}
                autoFocus
              />
              <span className={styles.formUnit}>원</span>
            </div>
            <label className={styles.formLabel}>사용처 (선택)</label>
            <input
              type="text"
              className={styles.formInput}
              placeholder="점심, 커피 등"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.formCancel}
                onClick={() => { setShowAddForm(false); setAmount(''); setMemo(''); }}
              >
                취소
              </button>
              <button
                type="button"
                className={`z-cta ${styles.formSubmit}`}
                data-press
                onClick={handleAddEntry}
                disabled={!amount}
              >
                추가
              </button>
            </div>
          </div>
        )}

        {/* 사용 내역 */}
        <div className={styles.historySection}>
          <h3 className={styles.historyTitle}>사용 내역</h3>
          {entries.length === 0 ? (
            <p className={styles.historyEmpty}>이번 달 사용 내역이 없어요</p>
          ) : (
            <div className={styles.historyList}>
              {[...entries].reverse().map((entry) => (
                <div key={entry.id} className={styles.historyItem}>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyMemo}>{entry.memo}</span>
                    <span className={styles.historyDate}>{entry.date}</span>
                  </div>
                  <div className={styles.historyRight}>
                    <span className={styles.historyAmount}>-{formatMoney(entry.amount)}원</span>
                    <button
                      type="button"
                      className={`${styles.historyDelete} ${deleteConfirmId === entry.id ? styles.historyDeleteConfirm : ''}`}
                      onClick={() => handleDeleteEntry(entry.id)}
                      aria-label={deleteConfirmId === entry.id ? '삭제 확인' : '삭제'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className={styles.resetNotice}>매달 말일 자정에 자동 초기화돼요</p>
      </div>
    </div>
  );
}
