'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Search, TrainFront, SearchX } from 'lucide-react';
import Modal from '@/components/common/Modal';
import DiaChartModal from '@/components/layout/DiaChartModal';
import { useTrainStore } from '@/stores/train';
import {
  buildTrainDiaMap,
  lookupTrain,
  timetableDayKey,
  TIMETABLE_DAY_LABEL,
  type Line5Timetable,
  type TrainSide,
} from '@/lib/schedule';
import styles from '../styles/Line5.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 맡은 구간을 사람 말로 — 기관사는 답십리에서 바뀐다 */
const SIDE_LABEL: Record<TrainSide, string> = {
  full: '전 구간',
  west: '답십리 ↔ 방화 방면',
  east: '답십리 ↔ 하남·마천 방면',
};

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** <input type="date"> 값 — 로컬 날짜 그대로(toISOString 은 UTC 라 하루 밀린다) */
function toInputValue(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromInputValue(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
}

/** 공식 시간표 — 시트를 처음 열 때 한 번만 받는다 */
let timetableCache: Line5Timetable | null = null;

/**
 * 열번 조회 — 열차번호를 넣으면 그날 그 열번을 누가 모는지, 지금은 누가 몰고 있는지.
 *
 * 한 열번은 답십리에서 기관사가 바뀐다. 그래서 «한 사람» 이 아니라 «구간별 사람» 을 보여준다.
 * 없는 번호와 영등포 열번은 공식 시간표로 가른다 — 아무 번호에나 영등포라고 하지 않는다.
 */
export default function TrainDriverSearch({ open, onClose }: Props) {
  const data = useTrainStore((s) => s.data);
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [input, setInput] = useState('');
  const [query, setQuery] = useState<number | null>(null);
  const [badInput, setBadInput] = useState(false);
  const [chart, setChart] = useState<{ name: string; dia: string; date: Date } | null>(null);
  const [timetable, setTimetable] = useState<Line5Timetable | null>(timetableCache);

  useEffect(() => {
    if (!open || timetableCache) return;
    let alive = true;
    fetch('/data/line5-trains.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Line5Timetable | null) => {
        if (!d || !alive) return;
        timetableCache = d;
        setTimetable(d);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  const isToday = sameDay(date, new Date());

  const result = useMemo(
    () => (query === null ? null : lookupTrain(query, date, timetable)),
    [query, date, timetable],
  );

  /** 지금 이 열번이 선로 위에 있는가, 있다면 누가 몰고 있는가 — 오늘만 */
  const live = useMemo(() => {
    if (query === null || !isToday || result?.status === 'none') return null;
    const key = String(query);
    const t = data.find((x) => String(x.trainNo) === key);
    if (!t) return { running: false as const };
    const livePos = new Map(data.map((x) => [String(x.trainNo), { station: x.statnNm, dir: x.updnLine }]));
    // 5호선 실시간 목록과 같은 계산(답십리 위치 기반 교대)을 그대로 쓴다 — 두 화면이 다른 이름을 말하면 안 된다
    const info = buildTrainDiaMap(new Date(), livePos).get(key);
    return {
      running: true as const,
      name: info?.name ?? '영등포 기관사',
      ours: !!info,
      dia: info?.dia ?? null,
      diaDate: info?.date ?? null,
      station: t.statnNm.replace(/역$/, ''),
      dir: t.updnLine,
    };
  }, [query, isToday, data, result]);

  const run = () => {
    const v = input.trim();
    if (!/^\d{4}$/.test(v)) {
      setBadInput(true);
      return;
    }
    setBadInput(false);
    setQuery(Number(v));
  };

  const shift = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
  };

  const info = result && (result.status === 'ours' || result.status === 'yeongdeungpo') ? result.info : null;

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <Modal open={open} onClose={onClose} title="열번 조회">
        <div className={styles.tdsWrap}>
          {/* 조회 조건 — 날짜와 열차번호를 한 카드에 */}
          <div className={`z-glass-surface ${styles.tdsForm}`}>
            <div className={styles.tdsDateRow}>
              <button
                type="button"
                className={`z-glass-pill ${styles.tdsStep}`}
                onClick={() => shift(-1)}
                aria-label="전날"
                data-press
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <label className={styles.tdsDateBox}>
                <span className={styles.tdsDateText}>{dateLabel(date)}</span>
                {isToday ? (
                  <span className={styles.tdsTodayMark}>오늘</span>
                ) : (
                  <span className={styles.tdsDayKind}>{TIMETABLE_DAY_LABEL[timetableDayKey(date)]}</span>
                )}
                <input
                  type="date"
                  className={styles.tdsDateInput}
                  value={toInputValue(date)}
                  onChange={(e) => {
                    const d = fromInputValue(e.target.value);
                    if (d) setDate(d);
                  }}
                  aria-label="날짜 고르기"
                />
              </label>
              <button
                type="button"
                className={`z-glass-pill ${styles.tdsStep}`}
                onClick={() => shift(1)}
                aria-label="다음날"
                data-press
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
            {!isToday && (
              <button
                type="button"
                className={`z-glass-pill ${styles.tdsBackToday}`}
                onClick={() => setDate(startOfDay(new Date()))}
                data-press
              >
                오늘로
              </button>
            )}

            <div className={styles.tdsInputRow}>
              <input
                className={styles.tdsInput}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setBadInput(false);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="열차번호 4자리"
                aria-label="열차번호"
                aria-invalid={badInput}
              />
              <button type="button" className={`z-cta ${styles.tdsGo}`} onClick={run} data-press>
                <Search size={18} aria-hidden />
                조회
              </button>
            </div>
            {badInput && <p className={styles.tdsHintBad}>열차번호 네 자리를 넣어 주세요</p>}
          </div>

          {result && query !== null && (
            <>
              {/* 열번 머리 — 번호 · 시발→종착 · 답십리 통과 */}
              {result.status !== 'none' && result.status !== 'unknown' && (
                <div className={styles.tdsTrainHead}>
                  <span className={styles.tdsTrainIcon}><TrainFront size={20} aria-hidden /></span>
                  <span className={styles.tdsTrainNo}>{query}</span>
                  {info && (
                    <span className={styles.tdsRoute}>
                      {info.o} <span className={styles.tdsRouteArrow} aria-hidden>→</span> {info.d}
                    </span>
                  )}
                  {info?.dap && <span className={styles.tdsDap}>답십리 {info.dap}</span>}
                </div>
              )}

              {/* 없는 열번 */}
              {result.status === 'none' && (
                <div className={`z-glass-surface ${styles.tdsStatus}`}>
                  <span className={styles.tdsStatusIcon}><SearchX size={22} aria-hidden /></span>
                  <span className={styles.tdsStatusBody}>
                    <span className={styles.tdsStatusTitle}>없는 열번이에요</span>
                    <span className={styles.tdsStatusSub}>{dateLabel(date)} 시간표에 {query} 열번이 없어요</span>
                  </span>
                </div>
              )}

              {/* 시간표를 못 받아 가를 수 없음 */}
              {result.status === 'unknown' && (
                <div className={`z-glass-surface ${styles.tdsStatus}`}>
                  <span className={styles.tdsStatusBody}>
                    <span className={styles.tdsStatusTitle}>확인하지 못했어요</span>
                    <span className={styles.tdsStatusSub}>시간표를 불러오지 못해 영등포 열번인지 알 수 없어요</span>
                  </span>
                </div>
              )}

              {/* 지금 운행 중 — 오늘일 때만 */}
              {live && (
                <section className={styles.tdsSection}>
                  <h3 className={styles.tdsSectionTitle}>지금 운행 중</h3>
                  {live.running ? (
                    <div className={`z-glass-surface ${styles.tdsNow}`}>
                      <span className={styles.tdsNowDot} aria-hidden />
                      {live.ours && live.dia ? (
                        <button
                          type="button"
                          className={styles.tdsNameLink}
                          onClick={() => setChart({ name: live.name, dia: live.dia!, date: live.diaDate ?? date })}
                        >
                          {live.name}
                        </button>
                      ) : (
                        <span className={live.ours ? styles.tdsName : styles.tdsNameOther}>{live.name}</span>
                      )}
                      {/* 지금 어느 역에서 어느 쪽으로 — 실시간 목록과 같은 색(상행 초록·하행 빨강) */}
                      <span className={styles.tdsNowWhere}>
                        <span className={styles.tdsNowStation}>{live.station}</span>
                        <span
                          className={`${styles.tdsDirBadge} ${
                            live.dir === '상행' ? styles.tdsDirUp : live.dir === '하행' ? styles.tdsDirDown : ''
                          }`}
                        >
                          {live.dir === '상행' ? '▲ ' : live.dir === '하행' ? '▼ ' : ''}
                          {live.dir}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <p className={styles.tdsMuted}>지금은 선로에 없는 열번이에요</p>
                  )}
                </section>
              )}

              {/* 영등포 열번 — 시간표에 있는데 답십리 기관사가 한 구간도 안 맡는다 */}
              {result.status === 'yeongdeungpo' && (
                <div className={`z-glass-surface ${styles.tdsStatus} ${styles.tdsStatusOther}`}>
                  <span className={`${styles.tdsStatusIcon} ${styles.tdsStatusIconOther}`}>
                    <TrainFront size={22} aria-hidden />
                  </span>
                  <span className={styles.tdsStatusBody}>
                    <span className={styles.tdsStatusTitle}>영등포 열번이에요</span>
                  </span>
                </div>
              )}

              {/* 답십리 기관사가 모는 열번 — 구간별 사람 */}
              {result.status === 'ours' && (
                <section className={styles.tdsSection}>
                  <h3 className={styles.tdsSectionTitle}>{dateLabel(date)} 운행</h3>
                  <ul className={styles.tdsList}>
                    {result.rows.map((r, i) => {
                      const isNow = !!live?.running && live.name === r.name;
                      return (
                        <li
                          key={`${r.name}-${r.side}-${i}`}
                          className={`z-glass-surface ${styles.tdsRow} ${r.ours ? '' : styles.tdsRowOther} ${isNow ? styles.tdsRowNow : ''}`}
                        >
                          <span className={styles.tdsTime}>
                            {r.from && r.to ? (
                              <>
                                <span>{r.from}</span>
                                <span className={styles.tdsTimeTo}>{r.to}</span>
                              </>
                            ) : (
                              <span className={styles.tdsTimeNone}>—</span>
                            )}
                          </span>
                          <span className={styles.tdsWho}>
                            {r.ours && r.dia && r.diaDate ? (
                              <button
                                type="button"
                                className={styles.tdsNameLink}
                                onClick={() => setChart({ name: r.name, dia: r.dia!, date: r.diaDate! })}
                              >
                                {r.name}
                              </button>
                            ) : (
                              <span className={r.ours ? styles.tdsName : styles.tdsNameOther}>{r.name}</span>
                            )}
                            {isNow && <span className={styles.tdsNowBadge}>지금</span>}
                          </span>
                          <span className={`${styles.tdsSide} ${styles[`tdsSide_${r.side}`]}`}>
                            {SIDE_LABEL[r.side]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </Modal>

      <DiaChartModal
        open={chart !== null}
        dia={chart?.dia ?? null}
        date={chart?.date ?? date}
        diaLabel={chart ? `${chart.name} 기관사` : undefined}
        compact
        onClose={() => setChart(null)}
      />
    </>,
    document.body,
  );
}
