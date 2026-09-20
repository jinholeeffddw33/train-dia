'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, Check } from 'lucide-react';
import LoadingDots from '@/components/common/LoadingDots';
import styles from '../styles/RollCall.module.css';

interface ReadRow {
  name: string;
  dia: string;
  /** 출근 시각 'HH:MM' */
  start: string | null;
  /** 읽은 시각(ISO) — 아직 안 읽었으면 null */
  readAt: string | null;
}

interface ReadStatus {
  date: string;
  workerCount: number;
  readCount: number;
  rows: ReadRow[];
}

function toMinutes(hhmm: string | null): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 출근까지 남은 시간 — 「2시간 10분 뒤」 */
function untilLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}분 뒤`;
  if (m === 0) return `${h}시간 뒤`;
  return `${h}시간 ${m}분 뒤`;
}

/**
 * 점호 읽음 확인 — 관리자만.
 *
 * 그날 근무자를 **출근 시각 순**(= 다이아 순)으로 세우고, 지금 시각에 기준선을 긋는다.
 * 선 위는 이미 출근한 사람 — 여기 빨간 줄이 있으면 점호 사항을 못 보고 나간 사람이다.
 * 선 아래는 아직 출근 전 — 몇 시간 뒤에 나오는지 옆에 적는다.
 */
export default function RollCallReads({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<ReadStatus | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const load = useCallback(async () => {
    setState('loading');
    try {
      const r = await fetch('/api/rollcall/reads', { cache: 'no-store' });
      if (!r.ok) throw new Error('reads');
      setData(await r.json());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 기준선은 시계와 함께 내려간다 — 열어 둔 채 점호가 진행돼도 눈금이 맞는다
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const nowLabel = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`;

  /** 기준선이 들어갈 자리 — 출근 시각이 지금을 넘어서는 첫 줄 */
  const lineAt = useMemo(() => {
    if (!data) return -1;
    const i = data.rows.findIndex((r) => toMinutes(r.start) > nowMin);
    return i;
  }, [data, nowMin]);

  const lateUnread = useMemo(
    () => (data ? data.rows.filter((r) => !r.readAt && toMinutes(r.start) <= nowMin).length : 0),
    [data, nowMin],
  );

  const percent = data?.workerCount ? Math.round((data.readCount / data.workerCount) * 100) : 0;

  return (
    <div className={styles.rcWrap}>
      <div className={styles.rcReadsTop}>
        <button type="button" className={styles.rcBackBtn} onClick={onBack} aria-label="점호 사항으로">
          <ArrowLeft size={20} />
        </button>
        <h3 className={styles.rcReadsTitle}>읽음 확인</h3>
        <span className={styles.rcNowChip}>지금 {nowLabel}</span>
      </div>

      {state === 'loading' && !data && (
        <div className={styles.rcCenter}>
          <LoadingDots />
          <p className={styles.rcCenterText}>불러오는 중</p>
        </div>
      )}

      {state === 'error' && !data && (
        <div className={styles.rcCenter}>
          <AlertTriangle size={26} strokeWidth={2.2} aria-hidden />
          <p className={styles.rcCenterText}>읽음 현황을 불러오지 못했어요</p>
          <button type="button" className={`z-glass-pill ${styles.rcRetry}`} onClick={load} data-press>
            다시 시도
          </button>
        </div>
      )}

      {data && (
        <>
          <p className={styles.rcReadsCount}>
            오늘 근무자 <strong>{data.workerCount}</strong>명 중{' '}
            <strong className={styles.rcReadsDone}>{data.readCount}</strong>명 읽음
          </p>
          <div className={styles.rcBar} aria-hidden>
            {/* STYLE-EXCEPTION: 읽은 비율은 런타임 값이라 CSS 로 정할 수 없다 */}
            <span className={styles.rcBarFill} style={{ width: `${percent}%` }} />
          </div>
          {lateUnread > 0 && (
            <p className={styles.rcLateWarn}>
              <AlertTriangle size={15} aria-hidden />
              출근 시각이 지났는데 안 읽은 사람 <strong>{lateUnread}</strong>명
            </p>
          )}

          <ul className={styles.rcReadList}>
            {data.rows.map((r, i) => {
              const startMin = toMinutes(r.start);
              const before = startMin > nowMin;
              const read = !!r.readAt;
              const late = !read && !before;
              return (
                <li key={`${r.name}-${r.dia}`}>
                  {i === lineAt && (
                    <div className={styles.rcNowLine} aria-hidden>
                      <span className={styles.rcNowLineLabel}>지금 {nowLabel}</span>
                    </div>
                  )}
                  <div
                    className={`${styles.rcReadRow} ${read ? styles.rcRowRead : late ? styles.rcRowLate : styles.rcRowWaiting}`}
                  >
                    <span className={styles.rcReadMark} aria-hidden>
                      {read ? <Check size={15} strokeWidth={3} /> : '·'}
                    </span>
                    <span className={styles.rcReadName}>{r.name}</span>
                    <span className={styles.rcReadDia}>{r.dia}</span>
                    <span className={styles.rcReadStart}>{r.start ?? '—'}</span>
                    <span className={styles.rcReadState}>
                      {read
                        ? `읽음 ${hhmm(r.readAt!)}`
                        : before
                          ? untilLabel(startMin - nowMin)
                          : '안 읽음'}
                    </span>
                  </div>
                </li>
              );
            })}
            {lineAt === -1 && data.rows.length > 0 && (
              <li>
                <div className={styles.rcNowLine} aria-hidden>
                  <span className={styles.rcNowLineLabel}>지금 {nowLabel}</span>
                </div>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
