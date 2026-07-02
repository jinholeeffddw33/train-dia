'use client';

import { useState, useEffect } from 'react';
import { X, Trophy, XCircle, RefreshCw } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import styles from '../styles/More.module.css';

interface LevelRecord {
  id: string;
  sabun: string;
  name: string;
  level_id: number;
  level_name: string;
  score: number;
  passed: boolean;
  created_at: string;
}

interface LevelRecordsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'var(--dia-green)',
  2: 'var(--dia-blue)',
  3: 'var(--dia-amber)',
  4: 'var(--dia-red)',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

export default function LevelRecordsOverlay({ open, onClose }: LevelRecordsOverlayProps) {
  const [records, setRecords] = useState<LevelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchRecords = () => {
    setLoading(true);
    setError(false);
    fetch('/api/edu/level-records')
      .then(r => {
        if (!r.ok) throw new Error('forbidden');
        return r.json();
      })
      .then((data: LevelRecord[]) => {
        setRecords(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open) fetchRecords();
  }, [open]);

  // ESC 로 닫기
  useEscapeClose(open, onClose);

  if (!open) return null;

  // 기관사별 최고 등급 요약
  const summary = new Map<string, { name: string; maxLevel: number; maxLevelName: string; attempts: number }>();
  records.forEach(r => {
    const existing = summary.get(r.sabun);
    if (!existing) {
      summary.set(r.sabun, {
        name: r.name,
        maxLevel: r.passed ? r.level_id : 0,
        maxLevelName: r.passed ? r.level_name : '-',
        attempts: 1,
      });
    } else {
      existing.attempts += 1;
      if (r.passed && r.level_id > existing.maxLevel) {
        existing.maxLevel = r.level_id;
        existing.maxLevelName = r.level_name;
      }
    }
  });

  const summaryArr = Array.from(summary.entries())
    .map(([sabun, v]) => ({ sabun, ...v }))
    .sort((a, b) => b.maxLevel - a.maxLevel || a.name.localeCompare(b.name));

  return (
    <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="등급도전 현황">
      <div className={styles.overlayHeader}>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
        <h2 className={styles.overlayTitle}>등급도전 현황</h2>
        <button
          type="button"
          className={styles.overlayClose}
          onClick={fetchRecords}
          aria-label="새로고침"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className={styles.overlayBody}>
        {loading && (
          <p className={styles.levelEmpty}>불러오는 중...</p>
        )}

        {error && (
          <p className={styles.levelEmpty}>데이터를 불러올 수 없어요</p>
        )}

        {!loading && !error && records.length === 0 && (
          <p className={styles.levelEmpty}>아직 도전 기록이 없어요</p>
        )}

        {!loading && !error && records.length > 0 && (
          <>
            {/* 기관사별 요약 */}
            <div className={styles.levelSection}>
              <h3 className={styles.levelSectionTitle}>기관사별 현황 ({summaryArr.length}명)</h3>
              <div className={styles.levelSummaryList}>
                {summaryArr.map(s => (
                  <div key={s.sabun} className={styles.levelSummaryCard}>
                    <span className={styles.levelSummaryName}>{s.name}</span>
                    <span
                      className={styles.levelSummaryBadge}
                      /* STYLE-EXCEPTION: 등급별 동적 색상 */
                      style={{ color: s.maxLevel > 0 ? LEVEL_COLORS[s.maxLevel] : 'var(--dia-text-tertiary)' }}
                    >
                      {s.maxLevel > 0 ? `Lv${s.maxLevel} ${s.maxLevelName}` : '미통과'}
                    </span>
                    <span className={styles.levelSummaryAttempts}>{s.attempts}회</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 전체 기록 */}
            <div className={styles.levelSection}>
              <h3 className={styles.levelSectionTitle}>전체 기록 ({records.length}건)</h3>
              <div className={styles.levelRecordList}>
                {records.map(r => (
                  <div key={r.id} className={styles.levelRecordItem}>
                    <div className={styles.levelRecordLeft}>
                      {r.passed ? (
                        <Trophy size={16} color={LEVEL_COLORS[r.level_id]} />
                      ) : (
                        <XCircle size={16} color="var(--dia-text-tertiary)" />
                      )}
                      <span className={styles.levelRecordName}>{r.name}</span>
                    </div>
                    <span
                      className={styles.levelRecordLevel}
                      /* STYLE-EXCEPTION: 등급별 동적 색상 */
                      style={{ color: LEVEL_COLORS[r.level_id] }}
                    >
                      Lv{r.level_id} {r.level_name}
                    </span>
                    <span className={styles.levelRecordScore}>
                      {r.score}점
                    </span>
                    <span className={styles.levelRecordDate}>
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
