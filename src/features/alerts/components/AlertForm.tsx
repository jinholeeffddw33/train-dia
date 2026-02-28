'use client';

import { useState } from 'react';
import { useAlertStore } from '@/stores/alert';
import { LINE5_MAIN, LINE5_MACHEON, LINE5_HANAM } from '@/data/line5';
import styles from '../styles/Alerts.module.css';

const ALL_STATIONS = [...LINE5_MAIN, ...LINE5_MACHEON, ...LINE5_HANAM];

export default function AlertForm({ onClose }: { onClose: () => void }) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [station, setStation] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'high' | 'medium' | 'low'>('medium');
  const [stationSearch, setStationSearch] = useState('');

  const filteredStations = stationSearch
    ? ALL_STATIONS.filter((s) => s.includes(stationSearch))
    : ALL_STATIONS;

  const handleSubmit = () => {
    if (!station || !message.trim()) return;

    addAlert({
      id: `local-${Date.now()}`,
      station,
      message: message.trim(),
      severity,
      created_at: new Date().toISOString(),
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
              {s === 'high' ? '긴급' : s === 'medium' ? '주의' : '참고'}
            </button>
          ))}
        </div>
      </div>

      {/* 역 선택 */}
      <div className={styles.formSection}>
        <label className={styles.formLabel}>역</label>
        {station ? (
          <div className={styles.selectedStation}>
            <span>{station}</span>
            <button type="button" className={styles.clearStation} onClick={() => setStation('')}>
              변경
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="역 이름 검색..."
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              aria-label="역 이름 검색"
            />
            <div className={styles.stationGrid}>
              {filteredStations.slice(0, 20).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.stationChip}
                  onClick={() => { setStation(s); setStationSearch(''); }}
                >
                  {s}
                </button>
              ))}
              {filteredStations.length > 20 && (
                <span className={styles.moreHint}>+{filteredStations.length - 20}개</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* 메시지 */}
      <div className={styles.formSection}>
        <label className={styles.formLabel}>상황 설명</label>
        <textarea
          className={styles.messageInput}
          rows={3}
          placeholder="어떤 상황인지 알려주세요..."
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
        disabled={!station || !message.trim()}
      >
        등록할게요
      </button>
    </div>
  );
}
