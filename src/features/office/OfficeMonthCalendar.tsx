'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange, MapPin } from 'lucide-react';
import { useOfficeStore, OFFICE_CATEGORIES } from '@/stores/office';
import Modal from '@/components/common/Modal';
import grid from './ScheduleManager.module.css';
import styles from './OfficeMonthCalendar.module.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addMonths(s: string, n: number): string {
  const d = fromISO(s);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return iso(target);
}

/**
 * 내근직 홈 하단에 표시하는 '일정관리' 월간 달력(인라인).
 * 달력 탭과 동일한 월 그리드(일정 미리보기)를 재사용하고,
 * 날짜를 누르면 그 날 일정 목록 팝업이 뜬다.
 */
export default function OfficeMonthCalendar() {
  const schedules = useOfficeStore((s) => s.schedules);
  const todayISO = iso(new Date());
  const [monthAnchor, setMonthAnchor] = useState<string>(todayISO);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [openDate, setOpenDate] = useState<string | null>(null);

  const monthGrid = useMemo(() => {
    const d = fromISO(monthAnchor);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const cells: (string | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let n = 1; n <= daysIn; n++) cells.push(iso(new Date(d.getFullYear(), d.getMonth(), n)));
    return cells;
  }, [monthAnchor]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, typeof schedules>();
    for (const s of schedules) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return m;
  }, [schedules]);

  const openEvents = openDate ? (eventsByDate.get(openDate) ?? []).filter((e) => monthFilter === 'all' || e.category === monthFilter) : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        <CalendarRange size={14} className={styles.labelIcon} />이번 달 일정
      </div>

      <div className={grid.monthCard}>
        <div className={grid.monthNav}>
          <button type="button" className={grid.monthNavBtn} onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))} aria-label="이전 달"><ChevronLeft size={20} /></button>
          <span>{fromISO(monthAnchor).getFullYear()}년 {fromISO(monthAnchor).getMonth() + 1}월</span>
          <button type="button" className={grid.monthNavBtn} onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))} aria-label="다음 달"><ChevronRight size={20} /></button>
        </div>

        {/* 카테고리 범례 필터 */}
        <div className={grid.legend}>
          <button type="button" className={monthFilter === 'all' ? grid.legOn : grid.leg} onClick={() => setMonthFilter('all')}>
            <span className={`${grid.legDot} ${grid.legDotAll}`} />전체
          </button>
          {OFFICE_CATEGORIES.map((c) => (
            <button key={c.key} type="button" className={monthFilter === c.key ? grid.legOn : grid.leg}
              onClick={() => setMonthFilter(monthFilter === c.key ? 'all' : c.key)}>
              <span className={`${grid.legDot} ${grid[`p_${c.key}`]}`} />{c.label}
            </button>
          ))}
        </div>

        <div className={grid.monthDow}>{DOW.map((w, i) => <span key={w} className={i === 0 ? grid.sun : i === 6 ? grid.sat : ''}>{w}</span>)}</div>
        <div className={grid.monthGrid}>
          {monthGrid.map((c, i) => {
            if (c === null) return <span key={`e${i}`} className={grid.mEmpty} />;
            const dd = fromISO(c);
            const dow = dd.getDay();
            const all = eventsByDate.get(c) ?? [];
            const evs = monthFilter === 'all' ? all : all.filter((e) => e.category === monthFilter);
            return (
              <button key={c} type="button"
                className={`${grid.mCell} ${c === openDate ? grid.mSel : ''}`}
                onClick={() => setOpenDate(c)}
                aria-label={`${dd.getMonth() + 1}월 ${dd.getDate()}일${evs.length ? `, 일정 ${evs.length}건` : ''}`}>
                <span className={`${grid.mNum} ${dow === 0 ? grid.sun : dow === 6 ? grid.sat : ''} ${c === todayISO ? grid.mTodayNum : ''}`}>{dd.getDate()}</span>
                <span className={grid.mChips}>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={grid.mChip}>
                      <span className={`${grid.mChipDot} ${grid[`p_${e.category}`]}`} />
                      <span className={grid.mChipTxt}>{e.title}</span>
                    </span>
                  ))}
                  {evs.length > 3 && <span className={grid.mMore}>+{evs.length - 3}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {openDate && (
        <Modal
          open
          onClose={() => setOpenDate(null)}
          title={(() => { const dd = fromISO(openDate); return `${dd.getMonth() + 1}월 ${dd.getDate()}일 일정`; })()}
        >
          {openEvents.length === 0 ? (
            <p className={styles.dayEmpty}>이 날 등록된 일정이 없어요.</p>
          ) : (
            <div className={styles.dayList}>
              {openEvents.map((e) => (
                <div key={e.id} className={styles.dayRow}>
                  <span className={`${styles.dayDot} ${grid[`p_${e.category}`]}`} />
                  <span className={styles.dayTime}>{e.time || '종일'}{e.end ? `~${e.end}` : ''}</span>
                  <span className={styles.dayTitle}>{e.title}</span>
                  {e.place && <span className={styles.dayPlace}><MapPin size={11} /> {e.place}</span>}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
