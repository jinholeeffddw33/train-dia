'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Users, Trophy } from 'lucide-react';
import LoadingDots from '@/components/common/LoadingDots';
import styles from './Integrity.module.css';

interface ResultRow {
  sabun: string;
  name: string;
  score: number;
  total: number;
  createdAt: string;
}

interface Results {
  headcount: number;
  submitted: number;
  average: number;
  total: number;
  rows: ResultRow[];
  perQuestion: { no: number; correct: number; rate: number }[];
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 관리자 전용 결과 — 참여율 · 점수 · 문항별 정답률.
 *
 * 응시자에게는 자기 점수도 안 보이므로, 이 화면이 대회의 유일한 결과 창구다.
 * 서버(/api/integrity/results)가 role='admin' 으로 막고 있어 화면 숨김에만 기대지 않는다.
 */
export default function IntegrityResults() {
  const [data, setData] = useState<Results | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const r = await fetch('/api/integrity/results', { cache: 'no-store' });
      if (!r.ok) throw new Error('results');
      setData(await r.json());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <div className={styles.iqCenter}>
        <LoadingDots />
        <p className={styles.iqCenterText}>결과를 불러오는 중</p>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div className={styles.iqCenter}>
        <AlertTriangle size={28} strokeWidth={2.2} aria-hidden />
        <p className={styles.iqCenterText}>결과를 불러오지 못했어요</p>
        <button type="button" className={`z-glass-pill ${styles.iqRetry}`} onClick={load} data-press>
          다시 시도
        </button>
      </div>
    );
  }

  const rate = data.headcount ? Math.round((data.submitted / data.headcount) * 100) : 0;

  return (
    <div className={styles.iqResults}>
      <div className={styles.iqStatRow}>
        <div className={`z-glass-surface ${styles.iqStat}`}>
          <Users size={18} strokeWidth={2.3} aria-hidden className={styles.iqStatIcon} />
          <span className={styles.iqStatValue}>{rate}%</span>
          <span className={styles.iqStatLabel}>참여율 {data.submitted}/{data.headcount}명</span>
        </div>
        <div className={`z-glass-surface ${styles.iqStat}`}>
          <Trophy size={18} strokeWidth={2.3} aria-hidden className={styles.iqStatIcon} />
          <span className={styles.iqStatValue}>{data.average}점</span>
          <span className={styles.iqStatLabel}>평균 ({data.total}점 만점)</span>
        </div>
      </div>

      <h4 className={styles.iqResultTitle}>점수 순위</h4>
      {data.rows.length === 0 ? (
        <p className={styles.iqCenterText}>아직 응시한 사람이 없어요</p>
      ) : (
        <ol className={styles.iqRankList}>
          {data.rows.map((r, i) => (
            <li key={r.sabun} className={`z-glass-surface ${styles.iqRank}`}>
              <span className={styles.iqRankNo}>{i + 1}</span>
              <span className={styles.iqRankName}>{r.name}</span>
              <span className={styles.iqRankDay}>{dayLabel(r.createdAt)}</span>
              <span className={styles.iqRankScore}>
                {r.score}<span className={styles.iqRankOf}>/{r.total}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <h4 className={styles.iqResultTitle}>문항별 정답률</h4>
      <ul className={styles.iqQRateList}>
        {data.perQuestion.map((p) => (
          <li key={p.no} className={styles.iqQRate}>
            <span className={styles.iqQRateNo}>{p.no}번</span>
            <span className={styles.iqQRateBar} aria-hidden>
              {/* STYLE-EXCEPTION: 막대 길이는 응답에서 오는 런타임 값이라 CSS 로 정할 수 없다 */}
              <span className={styles.iqQRateFill} style={{ width: `${p.rate}%` }} />
            </span>
            <span className={styles.iqQRateValue}>{p.rate}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
