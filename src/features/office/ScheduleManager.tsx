'use client';

import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check, CalendarDays, MapPin, Repeat, Pencil, Search } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useOfficeStore, OFFICE_CATEGORIES, type OfficeSchedule } from '@/stores/office';
import { isHoliday } from '@/lib/schedule';
import TimeSelect from './TimeSelect';
import styles from './ScheduleManager.module.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function labelKor(s: string): string { const d = fromISO(s); return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})`; }
function addDays(s: string, n: number): string { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); }
/** 반복 일정 날짜 생성 — 시작~종료(포함), 최대 366개 방어 */
function repeatDates(startISO: string, untilISO: string, mode: 'daily' | 'weekly' | 'monthly'): string[] {
  const out: string[] = [];
  let cur = fromISO(startISO);
  const until = fromISO(untilISO);
  let guard = 0;
  while (cur.getTime() <= until.getTime() && guard < 366) {
    out.push(iso(cur));
    if (mode === 'daily') cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    else if (mode === 'weekly') cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
    else cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
    guard++;
  }
  return out;
}
function addMonths(s: string, n: number): string {
  const d = fromISO(s);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return iso(target);
}

/* 주간 뷰는 목록형이라 시간→픽셀 좌표 변환이나 겹침 레인 배치가 필요 없다.
   시간대 겹침 표현은 하루 뷰가 담당한다. */

export default function ScheduleManager({ onClose, startMonth = false, startView = 'day' }: { onClose: () => void; startMonth?: boolean; startView?: 'day' | 'week' | 'list' }) {
  const { schedules, addSchedule, addSchedules, updateSchedule, removeSchedule, removeSeries, todos, toggleTodo } = useOfficeStore();
  const [sel, setSel] = useState<string>(iso(new Date()));
  const [monthAnchor, setMonthAnchor] = useState<string>(iso(new Date())); // 월 달력이 보여줄 달(선택 날짜와 분리)
  const [view, setView] = useState<'day' | 'week' | 'list'>(startView);
  const [monthOpen, setMonthOpen] = useState(startMonth);

  // 등록 시트
  const [addOpen, setAddOpen] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fCat, setFCat] = useState<string>('blue');
  const [fDate, setFDate] = useState(sel);
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fPlace, setFPlace] = useState('');
  const [fMemo, setFMemo] = useState('');
  const [fEndDate, setFEndDate] = useState(''); // 종료 날짜(기본=시작=당일). 시작보다 뒤면 그 기간 자동 등록
  const [fRepeat, setFRepeat] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [editId, setEditId] = useState<string | null>(null); // null=신규 등록, 값=그 일정 수정
  const [sheetDate, setSheetDate] = useState<string | null>(null); // 월 달력에서 누른 날 → 하단 시트
  const [q, setQ] = useState(''); // 일정 검색어(목록 탭)

  // 화면 자체는 항상 등록(자식 시트가 열려도 유지) — !addOpen 게이팅은 히스토리 churn/튕김 유발
  useHistoryBack('schedule-manager', onClose);
  useHistoryBack('schedule-add', () => setAddOpen(false), addOpen);
  useHistoryBack('schedule-day-sheet', () => setSheetDate(null), sheetDate !== null);

  const todayISO = iso(new Date());

  // 선택 주(일~토)
  const weekDays = useMemo(() => {
    const d = fromISO(sel);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }, [sel]);

  const dayEvents = useMemo(
    () => schedules.filter((s) => s.date === sel).sort((a, b) => a.time.localeCompare(b.time)),
    [schedules, sel],
  );
  // 하루 타임라인 = 등록 일정 + 시간 있는 할 일(오늘만 겹쳐 보임). 단일 소스
  const dayItems = useMemo(() => {
    const ev = dayEvents.map((s) => ({ kind: 'sched' as const, id: s.id, time: s.time, end: s.end, title: s.title, place: s.place, category: s.category, done: false, repeatId: s.repeatId, memo: s.memo }));
    if (sel !== todayISO) return ev;
    const td = todos.filter((t) => t.inSchedule ?? !!t.time)
      .map((t) => ({ kind: 'todo' as const, id: t.id, time: t.time || '', end: '', title: t.text, place: '', category: 'amber', done: t.done, repeatId: undefined as string | undefined, memo: undefined as string | undefined }));
    return [...ev, ...td].sort((a, b) => a.time.localeCompare(b.time));
  }, [dayEvents, todos, sel, todayISO]);
  const upcoming = useMemo(
    () => schedules.filter((s) => s.date >= todayISO).slice(0, 20),
    [schedules, todayISO],
  );

  /**
   * 주간 = 요일별 목록. 타임그리드가 아니다.
   * 세로 화면에서 7일 타임그리드는 칸이 너무 좁아(360px 에서 46px) 제목을 못 읽고,
   * 칸 폭을 확보하면 가로 스크롤이 생겨 "한눈에 주 전체" 라는 목적 자체가 깨진다.
   * 시간대 겹침 파악은 하루 뷰가 담당하고, 주간은 "언제 무엇이 있나" 에 집중한다.
   * 시간 없는 종일 일정도 여기서는 정상적으로 보인다(그리드에선 빠져 있었다).
   */
  const weekList = useMemo(() => weekDays.map((d) => {
    const ev = schedules.filter((s) => s.date === d).map((s) => ({
      kind: 'sched' as const, id: s.id, time: s.time, end: s.end,
      title: s.title, place: s.place, category: s.category, done: false, repeatId: s.repeatId,
    }));
    const td = d === todayISO
      ? todos.filter((t) => t.inSchedule ?? !!t.time).map((t) => ({
          kind: 'todo' as const, id: t.id, time: t.time || '', end: '',
          title: t.text, place: '', category: 'amber', done: t.done, repeatId: undefined as string | undefined,
        }))
      : [];
    // 종일(시간 없음)이 맨 위, 그다음 시간순
    const items = [...ev, ...td].sort((a, b) => {
      if (!a.time && b.time) return -1;
      if (a.time && !b.time) return 1;
      return a.time.localeCompare(b.time);
    });
    return { date: d, items };
  }), [weekDays, schedules, todos, todayISO]);
  const weekRange = weekDays.length ? `${fromISO(weekDays[0]).getMonth() + 1}.${fromISO(weekDays[0]).getDate()} – ${fromISO(weekDays[6]).getMonth() + 1}.${fromISO(weekDays[6]).getDate()}` : '';

  // 월 그리드 — 표시 중인 달(monthAnchor) 기준
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
  // 날짜별 일정 목록 — 월 그리드 칸에 제목 미리보기
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

  /** 하단 시트에 띄울 그날 일정 (종일이 먼저, 그다음 시간순) */
  const sheetEvents = useMemo(() => {
    if (!sheetDate) return [];
    return (eventsByDate.get(sheetDate) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
  }, [sheetDate, eventsByDate]);

  /** 목록 탭 — 검색어가 있으면 전체에서 찾고, 없으면 예정 일정 20건 */
  const listItems = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return schedules.filter((s) => s.date >= todayISO).slice(0, 20);
    return schedules.filter((s) =>
      s.title.toLowerCase().includes(kw)
      || s.place.toLowerCase().includes(kw)
      || (s.memo ?? '').toLowerCase().includes(kw),
    );
  }, [schedules, q, todayISO]);

  const openAdd = (date?: string) => {
    const d = date ?? sel;
    setEditId(null);
    setFTitle(''); setFCat('blue'); setFDate(d); setFEndDate(d); setFStart(''); setFEnd(''); setFPlace(''); setFMemo('');
    setFRepeat('daily');
    setAddOpen(true);
  };

  /** 기존 일정 수정 — 시트를 같은 값으로 채워서 연다 */
  const openEdit = (s: OfficeSchedule) => {
    setEditId(s.id);
    setFTitle(s.title); setFCat(s.category); setFDate(s.date); setFEndDate(s.date);
    setFStart(s.time); setFEnd(s.end); setFPlace(s.place); setFMemo(s.memo ?? '');
    setFRepeat('daily');
    setAddOpen(true);
  };

  const submit = () => {
    // 시간은 선택 — 비우면 종일 일정(표시는 '종일')
    if (!fTitle.trim()) return;
    const base = { time: fStart, end: fEnd, title: fTitle.trim(), place: fPlace.trim(), category: fCat, memo: fMemo.trim() || undefined };

    if (editId) {
      // 수정은 그 일정 하나만 (반복 생성 안 함)
      updateSchedule(editId, { date: fDate, ...base });
    } else if (!fEndDate || fEndDate <= fDate) {
      addSchedule({ date: fDate, ...base });
    } else {
      // 종료 날짜가 시작보다 뒤 → 그 기간 동안 선택한 주기로 자동 등록
      const rid = `r${fDate}-${fEndDate}-${fStart}-${fRepeat}-${fTitle.length}`;
      const dates = repeatDates(fDate, fEndDate, fRepeat);
      addSchedules(dates.map((d) => ({ date: d, repeatId: rid, ...base })));
    }
    setAddOpen(false);
    setEditId(null);
    setSel(fDate);
  };

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기"><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>{view === 'week' ? '주별 일정' : view === 'list' ? '일정 목록' : monthOpen ? '월별 일정' : '일별 일정'}</h1>
        <span className={styles.headSpacer} />
      </header>

      {/* 날짜 + 오늘 */}
      <div className={styles.dateRow}>
        <button type="button" className={styles.datePick} onClick={() => { setView('day'); if (!(monthOpen && view === 'day')) setMonthAnchor(sel); setMonthOpen((v) => !v); }}
          aria-expanded={monthOpen && view === 'day'} aria-label={monthOpen && view === 'day' ? '월 달력 접기' : '월 달력 열기'}>
          <span className={styles.dateChip}><CalendarDays size={16} /></span>
          <span className={styles.dateLabel}>{labelKor(sel)}</span>
          <span className={styles.toggleHint}>
            {monthOpen && view === 'day' ? '접기' : '월 달력'}
            <ChevronDown size={14} className={monthOpen && view === 'day' ? styles.chevOpen : styles.chev} />
          </span>
        </button>
        <button type="button" className={styles.todayBtn} onClick={() => { setSel(todayISO); setMonthAnchor(todayISO); }}>오늘</button>
      </div>

      {/* 월 달력 — 칸마다 일정 제목 미리보기 (하루 뷰에서만) */}
      {monthOpen && view === 'day' && (
        <div className={styles.monthCard}>
          <div className={styles.monthNav}>
            <button type="button" className={styles.monthNavBtn} onClick={() => setMonthAnchor(addMonths(monthAnchor, -1))} aria-label="이전 달"><ChevronLeft size={20} /></button>
            <span>{fromISO(monthAnchor).getFullYear()}년 {fromISO(monthAnchor).getMonth() + 1}월</span>
            <button type="button" className={styles.monthNavBtn} onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))} aria-label="다음 달"><ChevronRight size={20} /></button>
          </div>

          <div className={styles.monthDow}>{DOW.map((w, i) => <span key={w} className={i === 0 ? styles.sun : i === 6 ? styles.sat : ''}>{w}</span>)}</div>
          <div className={styles.monthGrid}>
            {monthGrid.map((c, i) => {
              if (c === null) return <span key={`e${i}`} className={styles.mEmpty} />;
              const dd = fromISO(c);
              const dow = dd.getDay();
              const evs = eventsByDate.get(c) ?? [];
              return (
                <button key={c} type="button"
                  className={`${styles.mCell} ${c === sel ? styles.mSel : ''}`}
                  /* 날짜를 누르면 하단 시트로 그날 일정을 바로 보여준다.
                     예전엔 setSel 만 해서 결과가 월 달력(약 668px) 아래로 밀려
                     "눌러도 아무 반응 없음" 으로 보였다. */
                  onClick={() => { setSel(c); setSheetDate(c); }}
                  aria-label={`${dd.getMonth() + 1}월 ${dd.getDate()}일${evs.length ? `, 일정 ${evs.length}건` : ''}`}>
                  {/* 공휴일도 일요일과 같은 빨강 — 요일만 보면 제헌절 같은 날이 검게 나온다 */}
                  <span className={`${styles.mNum} ${dow === 0 || isHoliday(dd) ? styles.sun : dow === 6 ? styles.sat : ''} ${c === todayISO ? styles.mTodayNum : ''}`}>{dd.getDate()}</span>
                  <span className={styles.mChips}>
                    {/* 카테고리는 점이 아니라 제목 바탕색으로 구분 — 좁은 칸에서 점이 먹던 8px 를 제목이 쓴다 */}
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} className={`${styles.mChip} ${styles[`b_${e.category}`]}`} title={e.title}>
                        {e.title}
                      </span>
                    ))}
                    {evs.length > 3 && <span className={styles.mMore}>+{evs.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 주간 스트립 (주간 뷰·월 달력 열림 시엔 숨김 — 그쪽에서 날짜 선택) */}
      {view !== 'week' && !monthOpen && (
      <div className={styles.week}>
        <button type="button" className={styles.weekArrow} onClick={() => setSel(addDays(sel, -7))} aria-label="이전 주"><ChevronLeft size={16} /></button>
        <div className={styles.weekDays}>
          {weekDays.map((d) => {
            const dd = fromISO(d);
            return (
              <button key={d} type="button" className={`${styles.wd} ${d === sel ? styles.wdSel : ''}`} onClick={() => setSel(d)}>
                <span className={`${styles.wdName} ${dd.getDay() === 0 || isHoliday(dd) ? styles.sun : dd.getDay() === 6 ? styles.sat : ''}`}>{DOW[dd.getDay()]}</span>
                <span className={styles.wdNum}>{dd.getDate()}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className={styles.weekArrow} onClick={() => setSel(addDays(sel, 7))} aria-label="다음 주"><ChevronRight size={16} /></button>
      </div>
      )}

      {/* 탭 */}
      <div className={styles.tabs}>
        <button type="button" className={view === 'day' ? styles.tabOn : styles.tab} onClick={() => setView('day')}>하루</button>
        <button type="button" className={view === 'week' ? styles.tabOn : styles.tab} onClick={() => setView('week')}>주간</button>
        <button type="button" className={view === 'list' ? styles.tabOn : styles.tab} onClick={() => setView('list')}>목록</button>
      </div>

      {/* 콘텐츠 — 하루 */}
      {view === 'day' && (
        <div className={styles.timeline}>
          {dayItems.length === 0 && <p className={styles.empty}>이 날 일정이 없어요. 아래 <b>+ 일정 추가</b>로 등록하세요.</p>}
          {dayItems.map((it) => (
            <div key={`${it.kind}-${it.id}`} className={`${styles.item} ${it.done ? styles.itemDone : ''}`}>
              <div className={styles.itemTime}>
                <b>{it.time || '종일'}</b>{it.end && <s>~{it.end}</s>}
              </div>
              <span className={`${styles.pin} ${styles[`p_${it.category}`]}`} />
              <div className={`${styles.ecard} ${styles[`c_${it.category}`]}`}>
                {/* 일정은 탭하면 수정 (할 일은 완료 토글이라 그대로) */}
                <div
                  className={it.kind === 'sched' ? styles.ecBodyTap : styles.ecBody}
                  role={it.kind === 'sched' ? 'button' : undefined}
                  tabIndex={it.kind === 'sched' ? 0 : undefined}
                  onClick={it.kind === 'sched' ? () => { const s = schedules.find((x) => x.id === it.id); if (s) openEdit(s); } : undefined}
                  onKeyDown={it.kind === 'sched' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const s = schedules.find((x) => x.id === it.id); if (s) openEdit(s); } } : undefined}
                >
                  <div className={styles.ecTitle}>
                    <span className={styles.ecTitleText}>{it.title}</span>
                    {it.kind === 'todo' && <span className={styles.ecChip}>할 일</span>}
                    {it.repeatId && <Repeat size={12} className={styles.repMark} aria-label="반복 일정" />}
                  </div>
                  {it.kind === 'sched' && it.place && <div className={styles.ecSub}><MapPin size={11} /> {it.place}</div>}
                  {it.kind === 'sched' && it.memo && <div className={styles.ecMemo}>{it.memo}</div>}
                </div>
                {it.kind === 'sched' ? (
                  <button type="button" className={styles.ecDel}
                    onClick={() => it.repeatId ? removeSeries(it.repeatId) : removeSchedule(it.id)}
                    aria-label={it.repeatId ? '반복 일정 전체 삭제' : '삭제'} title={it.repeatId ? '반복 일정 전체 삭제' : '삭제'}><X size={14} /></button>
                ) : (
                  <button type="button" className={`${styles.ecCheck} ${it.done ? styles.ecCheckOn : ''}`} onClick={() => toggleTodo(it.id)} aria-pressed={it.done} aria-label="완료 토글">
                    {it.done && <Check size={13} strokeWidth={3} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className={styles.addRow} onClick={() => openAdd()}><Plus size={16} /> 일정 추가</button>
        </div>
      )}

      {/* 콘텐츠 — 주간 시간표 */}
      {view === 'week' && (
        <div className={styles.wg}>
          <div className={styles.wgNav}>
            <button type="button" className={styles.weekArrow} onClick={() => setSel(addDays(sel, -7))} aria-label="이전 주"><ChevronLeft size={16} /></button>
            <span className={styles.wgRange}>{weekRange}</span>
            <button type="button" className={styles.weekArrow} onClick={() => setSel(addDays(sel, 7))} aria-label="다음 주"><ChevronRight size={16} /></button>
          </div>
          {/* 요일별 섹션 목록 — 세로 스크롤만. 날짜 머리글을 누르면 그날 하루 뷰로 간다. */}
          <div className={styles.wlBody}>
            {weekList.map(({ date, items }) => {
              const dd = fromISO(date);
              const isToday = date === todayISO;
              const dowCls = dd.getDay() === 0 || isHoliday(dd) ? styles.sun : dd.getDay() === 6 ? styles.sat : '';
              return (
                <section key={date} className={`${styles.wlDay} ${isToday ? styles.wlDayToday : ''}`}>
                  <button type="button" className={styles.wlHead}
                    onClick={() => { setSel(date); setView('day'); }}
                    aria-label={`${dd.getMonth() + 1}월 ${dd.getDate()}일 하루 일정 보기`}>
                    <span className={`${styles.wlDow} ${dowCls}`}>{DOW[dd.getDay()]}</span>
                    <span className={`${styles.wlDate} ${dowCls}`}>{dd.getMonth() + 1}.{dd.getDate()}</span>
                    {isToday && <span className={styles.wlToday}>오늘</span>}
                    {/* 빈 날은 머리글 한 줄로만 — 7일 중 여러 날이 비면 빈 줄이 화면을 잡아먹는다 */}
                    <span className={`${styles.wlCount} ${items.length ? '' : styles.wlCountEmpty}`}>
                      {items.length ? `${items.length}건` : '일정 없음'}
                    </span>
                    <ChevronRight size={14} className={styles.wlGo} aria-hidden />
                  </button>

                  {items.length > 0 && (
                    <ul className={styles.wlList}>
                      {items.map((it) => (
                        <li key={`${it.kind}-${it.id}`} className={`${styles.wlItem} ${it.done ? styles.wlItemDone : ''}`}>
                          <span className={styles.wlTime}>
                            <b>{it.time || '종일'}</b>
                            {it.end && <s>~{it.end}</s>}
                          </span>
                          <span className={`${styles.wlBar} ${styles[`p_${it.category}`]}`} aria-hidden />
                          <button type="button" className={styles.wlMain}
                            onClick={() => {
                              // 일정은 바로 수정, 할 일은 그날 하루 뷰로(거기서 완료 토글)
                              if (it.kind === 'sched') { const s = schedules.find((x) => x.id === it.id); if (s) { openEdit(s); return; } }
                              setSel(date); setView('day');
                            }}>
                            <span className={styles.wlTitle}>{it.title}</span>
                            {it.kind === 'todo' && <span className={styles.wlChip}>할 일</span>}
                            {it.repeatId && <Repeat size={11} className={styles.repMark} aria-label="반복 일정" />}
                            {it.place && <span className={styles.wlPlace}><MapPin size={10} /> {it.place}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* 콘텐츠 — 목록 */}
      {view === 'list' && (
        <div className={styles.list}>
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} aria-hidden />
            <input className={styles.searchInput} type="search" value={q} placeholder="제목·장소·내용 검색"
              onChange={(e) => setQ(e.target.value)} aria-label="일정 검색" />
            {q && (
              <button type="button" className={styles.searchClear} onClick={() => setQ('')} aria-label="검색어 지우기">
                <X size={14} />
              </button>
            )}
          </div>
          {listItems.length === 0 && (
            <p className={styles.empty}>{q.trim() ? `'${q.trim()}' 검색 결과가 없어요.` : '예정된 일정이 없어요.'}</p>
          )}
          {listItems.map((s) => (
            <button key={s.id} type="button" className={styles.listItem} onClick={() => openEdit(s)}>
              <span className={styles.liDate}>{labelKor(s.date).slice(5)}</span>
              <span className={`${styles.pin} ${styles[`p_${s.category}`]}`} />
              <span className={styles.liTime}>{s.time || '종일'}</span>
              <span className={styles.liTitle}>{s.title}</span>
              {s.place && <span className={styles.liPlace}>{s.place}</span>}
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button type="button" className={styles.fab} onClick={() => openAdd()} aria-label="일정 추가"><Plus size={24} /></button>

      {/* 날짜 탭 → 하단 시트 (그날 일정을 달력 아래로 스크롤하지 않고 바로 확인) */}
      {sheetDate && (
        <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label="그날 일정"
          onClick={(e) => { if (e.target === e.currentTarget) setSheetDate(null); }}>
          <div className={styles.sheet}>
            <div className={styles.grab} />
            <div className={styles.sheetHead}>
              <button type="button" className={styles.sheetX} onClick={() => setSheetDate(null)} aria-label="닫기"><X size={20} /></button>
              <b>{labelKor(sheetDate).slice(5)}</b>
              <button type="button" className={styles.sheetSave} onClick={() => { const d = sheetDate; setSheetDate(null); openAdd(d); }}>추가</button>
            </div>

            <div className={styles.daySheet}>
              {sheetEvents.length === 0 ? (
                <p className={styles.empty}>이 날 일정이 없어요. 위 <b>추가</b>로 등록하세요.</p>
              ) : (
                sheetEvents.map((s) => (
                  <div key={s.id} className={styles.dsRow}>
                    <button type="button" className={styles.dsMain}
                      onClick={() => { setSheetDate(null); openEdit(s); }}
                      aria-label={`${s.title} 수정`}>
                      <span className={`${styles.pin} ${styles[`p_${s.category}`]}`} />
                      <span className={styles.dsTime}>{s.time || '종일'}{s.end ? `~${s.end}` : ''}</span>
                      <span className={styles.dsBody}>
                        <span className={styles.dsTitle}>
                          {s.title}
                          {s.repeatId && <Repeat size={11} className={styles.repMark} aria-label="반복 일정" />}
                        </span>
                        {s.place && <span className={styles.dsPlace}><MapPin size={10} /> {s.place}</span>}
                      </span>
                      <Pencil size={14} className={styles.dsEdit} aria-hidden />
                    </button>
                    <button type="button" className={styles.ecDel}
                      onClick={() => s.repeatId ? removeSeries(s.repeatId) : removeSchedule(s.id)}
                      aria-label={s.repeatId ? '반복 일정 전체 삭제' : '삭제'}><X size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 등록 바텀시트 */}
      {addOpen && (
        <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label={editId ? '일정 수정' : '일정 등록'}
          onClick={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className={styles.sheet}>
            <div className={styles.grab} />
            <div className={styles.sheetHead}>
              <button type="button" className={styles.sheetX} onClick={() => setAddOpen(false)} aria-label="취소"><X size={20} /></button>
              <b>{editId ? '일정 수정' : '일정 등록'}</b>
              <button type="button" className={styles.sheetSave} onClick={submit}>저장</button>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>제목</label>
              <input className={styles.fInput} type="text" value={fTitle} autoFocus placeholder="일정 제목"
                onChange={(e) => setFTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>카테고리</label>
              <div className={styles.catPick}>
                {OFFICE_CATEGORIES.map((c) => (
                  <button key={c.key} type="button"
                    className={`${styles.cp} ${styles[`p_${c.key}`]} ${fCat === c.key ? styles.cpSel : ''}`}
                    onClick={() => setFCat(c.key)} aria-label={c.label} title={c.label} />
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>시작 날짜</label>
              <input className={styles.fInput} type="date" value={fDate}
                onChange={(e) => { const v = e.target.value; setFDate(v); if (fEndDate < v) setFEndDate(v); }} />
            </div>

            {/* 반복은 새로 만들 때만 — 수정은 그 일정 하나만 바꾼다 */}
            {!editId && (
              <div className={styles.field}>
                <label className={styles.fLabel}>반복 종료 날짜</label>
                <input className={styles.fInput} type="date" value={fEndDate} min={fDate}
                  onChange={(e) => setFEndDate(e.target.value)} />
                {fEndDate > fDate && (
                  <div className={styles.repPick}>
                    {([['daily', '매일'], ['weekly', '매주'], ['monthly', '매월']] as const).map(([k, label]) => (
                      <button key={k} type="button"
                        className={fRepeat === k ? styles.repOn : styles.repBtn}
                        onClick={() => setFRepeat(k)} aria-pressed={fRepeat === k}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <p className={styles.repHint}>
                  {fEndDate > fDate
                    ? `${fDate} ~ ${fEndDate} ${fRepeat === 'daily' ? '매일' : fRepeat === 'weekly' ? '매주 같은 요일' : '매월 같은 날'} 자동 등록돼요`
                    : '당일 일정 · 종료 날짜를 뒤로 정하면 그 기간 반복됩니다'}
                </p>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.fLabel}>시간</label>
              <div className={styles.two}>
                <TimeSelect value={fStart} onChange={setFStart} ariaLabel="시작" />
                <span className={styles.tilde}>~</span>
                <TimeSelect value={fEnd} onChange={setFEnd} ariaLabel="종료(선택)" />
              </div>
              <p className={styles.repHint}>
                {fStart ? '시간을 비우면 종일 일정이 돼요' : '시간을 비워두면 종일 일정으로 등록됩니다'}
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>장소</label>
              <input className={styles.fInput} type="text" value={fPlace} placeholder="장소(선택)"
                onChange={(e) => setFPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>내용</label>
              <textarea className={styles.fTextarea} value={fMemo} placeholder="간단한 내용(선택)" rows={2} maxLength={200}
                onChange={(e) => setFMemo(e.target.value)} />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
