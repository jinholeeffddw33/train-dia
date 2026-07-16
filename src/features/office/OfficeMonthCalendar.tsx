'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useOfficeStore } from '@/stores/office';
import { isHoliday } from '@/lib/schedule';
import Modal from '@/components/common/Modal';
import dotColor from './ScheduleManager.module.css'; // 카테고리 점 색(p_*)만 재사용 — 크기는 이 파일 것
import styles from './OfficeMonthCalendar.module.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 칸에 찍는 점 최대 개수 — 넘치면 날짜를 눌러 팝업에서 전부 본다 */
const MAX_DOTS = 3;

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
 * 내근직 홈 '이번 달 일정' — 보기 전용 미니 달력.
 * 편집은 일정관리(ScheduleManager) 전체화면이 담당하므로 여기선 한눈에 보기에 집중한다.
 * 일정은 제목 대신 색 점으로 표시 — 칸 폭이 좁아 제목은 어차피 잘려서 못 읽는다.
 * 날짜를 누르면 그 날 일정 전체가 팝업으로 뜬다.
 */
export default function OfficeMonthCalendar() {
  const schedules = useOfficeStore((s) => s.schedules);
  const todayISO = iso(new Date());
  const [monthAnchor, setMonthAnchor] = useState<string>(todayISO);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const monthGrid = useMemo(() => {
    const d = fromISO(monthAnchor);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
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

  const openEvents = openDate ? eventsByDate.get(openDate) ?? [] : [];
  const anchor = fromISO(monthAnchor);

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>이번 달 일정</h3>

      <div className={styles.card}>
        <div className={styles.nav}>
          <button type="button" className={styles.navBtn} onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))} aria-label="이전 달">
            <ChevronLeft size={18} />
          </button>
          <span className={styles.navMonth}>
            {anchor.getFullYear()}년 <em>{anchor.getMonth() + 1}월</em>
          </span>
          <button type="button" className={styles.navBtn} onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))} aria-label="다음 달">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className={styles.dow}>
          {DOW.map((w, i) => (
            <span key={w} className={i === 0 ? styles.sun : i === 6 ? styles.sat : ''}>{w}</span>
          ))}
        </div>

        <div className={styles.grid}>
          {monthGrid.map((c, i) => {
            if (c === null) return <span key={`e${i}`} className={styles.empty} />;
            const dd = fromISO(c);
            const dow = dd.getDay();
            const evs = eventsByDate.get(c) ?? [];
            return (
              <button
                key={c}
                type="button"
                className={`${styles.cell} ${c === openDate ? styles.sel : ''}`}
                onClick={() => setOpenDate(c)}
                aria-label={`${dd.getMonth() + 1}월 ${dd.getDate()}일${evs.length ? `, 일정 ${evs.length}건` : ''}`}
              >
                {/* 공휴일도 일요일과 같은 빨강 — 요일만 보면 제헌절 같은 날이 검게 나온다 */}
                <span className={`${styles.num} ${dow === 0 || isHoliday(dd) ? styles.sun : dow === 6 ? styles.sat : ''} ${c === todayISO ? styles.todayNum : ''}`}>
                  {dd.getDate()}
                </span>
                {evs.length > 0 && (
                  <span className={styles.dots}>
                    {evs.slice(0, MAX_DOTS).map((e) => (
                      <span key={e.id} className={`${styles.dot} ${dotColor[`p_${e.category}`]}`} />
                    ))}
                  </span>
                )}
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
                  <span className={`${styles.dayDot} ${dotColor[`p_${e.category}`]}`} />
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
