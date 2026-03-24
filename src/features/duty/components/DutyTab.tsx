'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { P } from '@/data/cycle';
import { getDia, getType, getSchedule, isHoliday } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import type { Person, Schedule } from '@/lib/types';
import styles from '../styles/Duty.module.css';

/** 주간 다이아 1~44 */
const DAY_DIAS = Array.from({ length: 44 }, (_, i) => String(i + 1));
/** 주간 대기 대1~대10 */
const DAY_STANDBY = Array.from({ length: 10 }, (_, i) => `대${i + 1}`);
/** 야간 다이아 62~91 */
const NIGHT_DIAS = Array.from({ length: 30 }, (_, i) => String(i + 62));
/** 야간 대기 대61~대66 */
const NIGHT_STANDBY = Array.from({ length: 6 }, (_, i) => `대${i + 61}`);

const ALL_WORKING_DIAS = [...DAY_DIAS, ...DAY_STANDBY, ...NIGHT_DIAS, ...NIGHT_STANDBY];

type FilterType = 'all' | 'day' | 'night' | 'standby';

interface DiaEntry {
  dia: string;
  driver: Person | null;
  schedule: Schedule | null;
  type: 'day' | 'night' | 'standby' | 'rest';
}

const TYPE_LABELS: Record<string, string> = {
  day: '주간',
  night: '야간',
  standby: '대기',
};

export default function DutyTab() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedDia, setExpandedDia] = useState<string | null>(null);

  // 역방향 조회: 다이아 → 기관사
  const entries = useMemo(() => {
    const diaToDriver = new Map<string, Person>();
    for (const person of P) {
      const dia = getDia(person, date);
      const type = getType(dia);
      if (type !== 'rest') {
        diaToDriver.set(dia, person);
      }
    }

    return ALL_WORKING_DIAS.map((dia): DiaEntry => {
      const driver = diaToDriver.get(dia) || null;
      const schedule = getSchedule(dia, date);
      const type = getType(dia);
      return { dia, driver, schedule, type };
    });
  }, [date]);

  // 필터
  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'standby') return entries.filter((e) => e.type === 'standby');
    return entries.filter((e) => e.type === filter);
  }, [entries, filter]);

  // 날짜 이동
  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d);
  };
  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d);
  };
  const goToday = () => {
    const d = new Date();
    setDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  };

  const isHol = isHoliday(date);
  const dow = DOW[date.getDay()];
  const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

  // 카운트
  const dayCnt = entries.filter((e) => e.type === 'day').length;
  const nightCnt = entries.filter((e) => e.type === 'night').length;
  const standbyCnt = entries.filter((e) => e.type === 'standby').length;

  return (
    <div className={styles.container}>
      {/* 날짜 선택 */}
      <div className={styles.dateSelector}>
        <button type="button" onClick={prevDay} className={styles.dateArrow} aria-label="이전 날짜">
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={goToday} className={styles.dateDisplay}>
          <span className={styles.dateText}>{dateStr}</span>
          <span className={`${styles.dateDow} ${isHol ? styles.dateHoliday : ''}`}>
            ({dow}) {isHol ? '· 휴일' : '· 평일'}
          </span>
        </button>
        <button type="button" onClick={nextDay} className={styles.dateArrow} aria-label="다음 날짜">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 필터 탭 */}
      <div className={styles.filterTabs}>
        {([
          { key: 'all' as FilterType, label: `전체 ${entries.length}` },
          { key: 'day' as FilterType, label: `주간 ${dayCnt}` },
          { key: 'night' as FilterType, label: `야간 ${nightCnt}` },
          { key: 'standby' as FilterType, label: `대기 ${standbyCnt}` },
        ]).map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.filterTab} ${filter === f.key ? styles.filterTabActive : ''}`}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 다이아 목록 */}
      <div className={styles.diaList}>
        {filtered.map((entry) => (
          <DiaCard
            key={entry.dia}
            entry={entry}
            expanded={expandedDia === entry.dia}
            onToggle={() => setExpandedDia(expandedDia === entry.dia ? null : entry.dia)}
          />
        ))}
      </div>
    </div>
  );
}

/** 개별 다이아 카드 */
function DiaCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: DiaEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { dia, driver, schedule, type } = entry;
  const typeLabel = TYPE_LABELS[type] || '';

  return (
    <div className={`${styles.diaCard} ${expanded ? styles.diaCardExpanded : ''}`}>
      {/* 카드 헤더 (클릭 가능) */}
      <div
        className={styles.diaCardHeader}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <span className={`${styles.diaBadge} ${styles[`diaBadge_${type}`]}`}>{dia}</span>
        <span className={driver ? styles.diaDriver : `${styles.diaDriver} ${styles.vacancy}`}>
          {driver?.n || '결원'}
        </span>
        <span className={`${styles.diaType} ${styles[`diaType_${type}`]}`}>{typeLabel}</span>
        {schedule && (
          <span className={styles.diaTime}>{schedule.s}~{schedule.e}</span>
        )}
      </div>

      {/* 확장: 행로 상세 */}
      {expanded && schedule && (
        <div className={styles.diaDetail}>
          {/* 구간별 열차 정보 */}
          {schedule.g && schedule.g.length > 0 && (
            <div className={styles.segments}>
              {schedule.g.map((seg, i) => {
                const routeParts = schedule.m && !schedule.m.includes('충당여부') && !schedule.m.includes('대휴')
                  ? schedule.m.split(',').map(p => p.replace(/\s*\([^)]*\)/g, '').trim())
                  : [];
                return (
                <div key={i} className={styles.segment}>
                  <div className={styles.segHeader}>
                    <span className={styles.segLabel}>
                      {i + 1}근무{routeParts[i] && <> : {routeParts[i]}</>}
                    </span>
                    <span className={styles.segTime}>{seg.d} → {seg.a}</span>
                  </div>
                  <div className={styles.segTrains}>
                    {(seg.n || []).map((train, j) => (
                      <span key={j}>
                        {j > 0 && <span className={styles.trainArrow}> → </span>}
                        <span className={styles.trainBubble}>{train}</span>
                      </span>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* 대기/스탠바이 메모 */}
          {!schedule.g && schedule.m && (
            <div className={styles.routeDesc}>{schedule.m}</div>
          )}
        </div>
      )}
    </div>
  );
}
