'use client';

import { useState } from 'react';
import { useAlertStore } from '@/stores/alert';
import { useDriverStore } from '@/stores/driver';
import { LINE5_MAIN, LINE5_MACHEON, LINE5_HANAM } from '@/data/line5';
import styles from '../styles/Alerts.module.css';

const ALL_STATIONS = [...LINE5_MAIN, ...LINE5_MACHEON, ...LINE5_HANAM];

type StationField = 'from' | 'to';
type Direction = 'both' | 'up' | 'down';

const DIRECTION_OPTIONS: { value: Direction; label: string; icon: string }[] = [
  { value: 'both', label: '상하선', icon: '⇅' },
  { value: 'up', label: '상선', icon: '↑' },
  { value: 'down', label: '하선', icon: '↓' },
];

export default function AlertForm({ onClose }: { onClose: () => void }) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const driverName = useDriverStore((s) => s.current?.n ?? '');
  const [stationFrom, setStationFrom] = useState('');
  const [stationTo, setStationTo] = useState('');
  const [direction, setDirection] = useState<Direction>('both');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'high' | 'medium' | 'low'>('medium');
  const [stationSearch, setStationSearch] = useState('');
  const [activeField, setActiveField] = useState<StationField | null>(null);

  const isInfo = severity === 'low';

  const filteredStations = stationSearch
    ? ALL_STATIONS.filter((s) => s.includes(stationSearch))
    : ALL_STATIONS;

  const handleStationSelect = (name: string) => {
    if (activeField === 'from') {
      setStationFrom(name);
      setStationSearch('');
      if (!stationTo) {
        setActiveField('to');
      } else {
        setActiveField(null);
      }
    } else if (activeField === 'to') {
      setStationTo(name);
      setStationSearch('');
      setActiveField(null);
    }
  };

  const canSubmit = isInfo
    ? message.trim().length > 0
    : stationFrom && stationTo && message.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await addAlert({
      stationFrom: isInfo ? '' : stationFrom,
      stationTo: isInfo ? '' : stationTo,
      direction: isInfo ? '' : direction,
      message: message.trim(),
      severity,
      authorName: driverName,
    });

    onClose();
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>장애 등록</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      {/* 심각도 선택 */}
      <div className={styles.formSection}>
        <label className={styles.formLabel}>심각도</label>
        <div className={styles.severitySelect}>
          {(['high', 'medium', 'low'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.severityOption} ${severity === s ? styles[`severityOption_${s}`] : ''}`}
              onClick={() => setSeverity(s)}
            >
              {s === 'high' ? '긴급' : s === 'medium' ? '이례사항' : '참고'}
            </button>
          ))}
        </div>
      </div>

      {/* 구간 + 방향 (긴급/이례사항만) */}
      {!isInfo && (
        <>
          <div className={styles.formSection}>
            <label className={styles.formLabel}>구간</label>
            <div className={styles.sectionSelect}>
              {/* 시작역 */}
              <div className={styles.sectionRow}>
                <span className={styles.sectionLabel}>시작역</span>
                {stationFrom ? (
                  <div className={styles.selectedStation}>
                    <span>{stationFrom}</span>
                    <button
                      type="button"
                      className={styles.clearStation}
                      onClick={() => { setStationFrom(''); setActiveField('from'); }}
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${styles.stationSelectBtn} ${activeField === 'from' ? styles.stationSelectBtnActive : ''}`}
                    onClick={() => setActiveField(activeField === 'from' ? null : 'from')}
                  >
                    역 선택
                  </button>
                )}
              </div>

              <div className={styles.sectionArrow}>→</div>

              {/* 끝역 */}
              <div className={styles.sectionRow}>
                <span className={styles.sectionLabel}>끝역</span>
                {stationTo ? (
                  <div className={styles.selectedStation}>
                    <span>{stationTo}</span>
                    <button
                      type="button"
                      className={styles.clearStation}
                      onClick={() => { setStationTo(''); setActiveField('to'); }}
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${styles.stationSelectBtn} ${activeField === 'to' ? styles.stationSelectBtnActive : ''}`}
                    onClick={() => setActiveField(activeField === 'to' ? null : 'to')}
                  >
                    역 선택
                  </button>
                )}
              </div>
            </div>

            {activeField && (
              <div className={styles.stationPanel}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={`${activeField === 'from' ? '시작' : '끝'}역 검색...`}
                  value={stationSearch}
                  onChange={(e) => setStationSearch(e.target.value)}
                  aria-label={`${activeField === 'from' ? '시작' : '끝'}역 검색`}
                />
                <div className={styles.stationGrid}>
                  {filteredStations.slice(0, 20).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={styles.stationChip}
                      onClick={() => handleStationSelect(s)}
                    >
                      {s}
                    </button>
                  ))}
                  {filteredStations.length > 20 && (
                    <span className={styles.moreHint}>+{filteredStations.length - 20}개</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 방향 선택 */}
          <div className={styles.formSection}>
            <label className={styles.formLabel}>방향</label>
            <div className={styles.directionSelect}>
              {DIRECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.directionOption} ${direction === opt.value ? styles.directionOptionActive : ''}`}
                  onClick={() => setDirection(opt.value)}
                >
                  <span className={styles.directionIcon}>{opt.icon}</span>
                  <span className={styles.directionLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 메시지 */}
      <div className={styles.formSection}>
        <label className={styles.formLabel}>상황 설명</label>
        <textarea
          className={styles.messageInput}
          rows={3}
          placeholder={isInfo ? '참고할 내용을 알려주세요...' : '어떤 상황인지 알려주세요...'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          aria-label="장애 상황 설명"
        />
        <span className={styles.charCount}>{message.length}/200</span>
      </div>

      {/* 등록 버튼 */}
      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        등록할게요
      </button>
    </div>
  );
}
