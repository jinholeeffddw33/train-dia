'use client';

import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check, CalendarDays, MapPin, Trash2 } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useOfficeStore, OFFICE_CATEGORIES } from '@/stores/office';
import TimeSelect from './TimeSelect';
import styles from './ScheduleManager.module.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function labelKor(s: string): string { const d = fromISO(s); return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})`; }
function addDays(s: string, n: number): string { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); }

/* ── 주간 시간표 뷰 ── */
const HOUR_PX = 56; // ScheduleManager.module.css 의 --wg-hour(56px) 과 동일해야 함
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface WEvt { id: string; kind: 'sched' | 'todo'; title: string; category: string; startM: number; endM: number; done: boolean; lane: number; cols: number; }

/** 하루치 이벤트를 겹침 없이 레인(열)에 배치 — 겹치는 묶음은 열 수(cols)를 공유해 폭 분할 */
function layoutDay(evs: Omit<WEvt, 'lane' | 'cols'>[]): WEvt[] {
  const sorted = [...evs].sort((a, b) => a.startM - b.startM || a.endM - b.endM);
  const laneEnd: number[] = [];
  const out: WEvt[] = sorted.map((e) => {
    let lane = 0;
    while (lane < laneEnd.length && laneEnd[lane] > e.startM) lane++;
    laneEnd[lane] = e.endM;
    return { ...e, lane, cols: 1 };
  });
  let i = 0;
  while (i < out.length) {
    let clusterEnd = out[i].endM, maxLane = out[i].lane, k = i + 1;
    while (k < out.length && out[k].startM < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, out[k].endM);
      maxLane = Math.max(maxLane, out[k].lane);
      k++;
    }
    for (let t = i; t < k; t++) out[t].cols = maxLane + 1;
    i = k;
  }
  return out;
}

export default function ScheduleManager({ onClose, startMonth = false }: { onClose: () => void; startMonth?: boolean }) {
  const { schedules, addSchedule, removeSchedule, todos, toggleTodo } = useOfficeStore();
  const [sel, setSel] = useState<string>(iso(new Date()));
  const [view, setView] = useState<'day' | 'week' | 'list'>('day');
  const [monthOpen, setMonthOpen] = useState(startMonth);

  // 등록 시트
  const [addOpen, setAddOpen] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fCat, setFCat] = useState<string>('blue');
  const [fDate, setFDate] = useState(sel);
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fPlace, setFPlace] = useState('');

  useHistoryBack('schedule-add', () => setAddOpen(false), addOpen);
  useHistoryBack('schedule-manager', onClose, !addOpen);

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
    const ev = dayEvents.map((s) => ({ kind: 'sched' as const, id: s.id, time: s.time, end: s.end, title: s.title, place: s.place, category: s.category, done: false }));
    if (sel !== todayISO) return ev;
    const td = todos.filter((t) => t.time).map((t) => ({ kind: 'todo' as const, id: t.id, time: t.time, end: '', title: t.text, place: '', category: 'amber', done: t.done }));
    return [...ev, ...td].sort((a, b) => a.time.localeCompare(b.time));
  }, [dayEvents, todos, sel, todayISO]);
  const upcoming = useMemo(
    () => schedules.filter((s) => s.date >= todayISO).slice(0, 20),
    [schedules, todayISO],
  );

  // 주간 시간표 — 요일별 이벤트 배치 + 표시 시간 범위
  const week = useMemo(() => {
    const perDay = weekDays.map((d) => {
      const evs: Omit<WEvt, 'lane' | 'cols'>[] = schedules.filter((s) => s.date === d).map((s) => ({
        id: s.id, kind: 'sched' as const, title: s.title, category: s.category,
        startM: toMin(s.time), endM: s.end ? Math.max(toMin(s.end), toMin(s.time) + 30) : toMin(s.time) + 30, done: false,
      }));
      if (d === todayISO) {
        todos.forEach((t) => { if (t.time) evs.push({ id: t.id, kind: 'todo' as const, title: t.text, category: 'amber', startM: toMin(t.time), endM: toMin(t.time) + 30, done: t.done }); });
      }
      return layoutDay(evs);
    });
    let minM = 8 * 60, maxM = 19 * 60;
    perDay.forEach((day) => day.forEach((e) => { minM = Math.min(minM, e.startM); maxM = Math.max(maxM, e.endM); }));
    return { perDay, startHour: Math.max(0, Math.floor(minM / 60)), endHour: Math.min(24, Math.ceil(maxM / 60)) };
  }, [weekDays, schedules, todos, todayISO]);
  const hours = useMemo(() => Array.from({ length: week.endHour - week.startHour }, (_, i) => week.startHour + i), [week]);
  const gridH = (week.endHour - week.startHour) * HOUR_PX;

  // 현재 시각 선(1분마다 갱신)
  const [nowM, setNowM] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    const id = window.setInterval(() => { const d = new Date(); setNowM(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => window.clearInterval(id);
  }, []);
  const showNow = weekDays.includes(todayISO) && nowM >= week.startHour * 60 && nowM <= week.endHour * 60;
  const nowTop = ((nowM - week.startHour * 60) / 60) * HOUR_PX;
  const weekRange = weekDays.length ? `${fromISO(weekDays[0]).getMonth() + 1}.${fromISO(weekDays[0]).getDate()} – ${fromISO(weekDays[6]).getMonth() + 1}.${fromISO(weekDays[6]).getDate()}` : '';

  // 월 그리드(점프용)
  const monthGrid = useMemo(() => {
    const d = fromISO(sel);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const daysIn = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const cells: (string | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let n = 1; n <= daysIn; n++) cells.push(iso(new Date(d.getFullYear(), d.getMonth(), n)));
    return cells;
  }, [sel]);
  // 날짜별 일정 개수 — 월 그리드에서 바쁜/한가한 날 점 개수로 표시
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of schedules) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    return m;
  }, [schedules]);

  const openAdd = () => {
    setFTitle(''); setFCat('blue'); setFDate(sel); setFStart(''); setFEnd(''); setFPlace('');
    setAddOpen(true);
  };
  const submit = () => {
    if (!fTitle.trim() || !fStart) return;
    addSchedule({ date: fDate, time: fStart, end: fEnd, title: fTitle.trim(), place: fPlace.trim(), category: fCat });
    setAddOpen(false);
    setSel(fDate);
  };

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기"><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>일정 관리</h1>
        <span className={styles.headSpacer} />
      </header>

      {/* 날짜 + 오늘 */}
      <div className={styles.dateRow}>
        <button type="button" className={styles.datePick} onClick={() => setMonthOpen((v) => !v)}
          aria-expanded={monthOpen} aria-label={monthOpen ? '월 달력 접기' : '월 달력 열기'}>
          <span className={styles.dateChip}><CalendarDays size={16} /></span>
          <span className={styles.dateLabel}>{labelKor(sel)}</span>
          <span className={styles.toggleHint}>
            {monthOpen ? '접기' : '월 달력'}
            <ChevronDown size={14} className={monthOpen ? styles.chevOpen : styles.chev} />
          </span>
        </button>
        <button type="button" className={styles.todayBtn} onClick={() => { setSel(todayISO); setMonthOpen(false); }}>오늘</button>
      </div>

      {/* 월 그리드(점프) */}
      {monthOpen && (
        <div className={styles.monthCard}>
          <div className={styles.monthNav}>
            <button type="button" onClick={() => setSel(addDays(sel, -30))} aria-label="이전 달"><ChevronLeft size={18} /></button>
            <span>{fromISO(sel).getFullYear()}년 {fromISO(sel).getMonth() + 1}월</span>
            <button type="button" onClick={() => setSel(addDays(sel, 30))} aria-label="다음 달"><ChevronRight size={18} /></button>
          </div>
          <div className={styles.monthDow}>{DOW.map((w, i) => <span key={w} className={i === 0 ? styles.sun : i === 6 ? styles.sat : ''}>{w}</span>)}</div>
          <div className={styles.monthGrid}>
            {monthGrid.map((c, i) => {
              if (c === null) return <span key={`e${i}`} />;
              const cnt = countByDate.get(c) ?? 0;
              return (
                <button key={c} type="button"
                  className={`${styles.mCell} ${c === sel ? styles.mSel : ''} ${c === todayISO ? styles.mToday : ''}`}
                  onClick={() => setSel(c)}
                  aria-label={`${fromISO(c).getMonth() + 1}월 ${fromISO(c).getDate()}일${cnt ? `, 일정 ${cnt}건` : ''}`}>
                  {fromISO(c).getDate()}
                  {cnt > 0 && (
                    <span className={styles.mDots} aria-hidden>
                      {Array.from({ length: Math.min(cnt, 3) }).map((_, k) => <span key={k} className={styles.mDot} />)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 주간 스트립 (주간 시간표 뷰에선 자체 헤더가 대신함) */}
      {view !== 'week' && (
      <div className={styles.week}>
        <button type="button" className={styles.weekArrow} onClick={() => setSel(addDays(sel, -7))} aria-label="이전 주"><ChevronLeft size={16} /></button>
        <div className={styles.weekDays}>
          {weekDays.map((d) => {
            const dd = fromISO(d);
            return (
              <button key={d} type="button" className={`${styles.wd} ${d === sel ? styles.wdSel : ''}`} onClick={() => setSel(d)}>
                <span className={`${styles.wdName} ${dd.getDay() === 0 ? styles.sun : dd.getDay() === 6 ? styles.sat : ''}`}>{DOW[dd.getDay()]}</span>
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
                <b>{it.time}</b>{it.end && <s>~{it.end}</s>}
              </div>
              <span className={`${styles.pin} ${styles[`p_${it.category}`]}`} />
              <div className={`${styles.ecard} ${styles[`c_${it.category}`]}`}>
                <div className={styles.ecBody}>
                  <div className={styles.ecTitle}>
                    <span className={styles.ecTitleText}>{it.title}</span>
                    {it.kind === 'todo' && <span className={styles.ecChip}>할 일</span>}
                  </div>
                  {it.kind === 'sched' && it.place && <div className={styles.ecSub}><MapPin size={11} /> {it.place}</div>}
                </div>
                {it.kind === 'sched' ? (
                  <button type="button" className={styles.ecDel} onClick={() => removeSchedule(it.id)} aria-label="삭제"><X size={14} /></button>
                ) : (
                  <button type="button" className={`${styles.ecCheck} ${it.done ? styles.ecCheckOn : ''}`} onClick={() => toggleTodo(it.id)} aria-pressed={it.done} aria-label="완료 토글">
                    {it.done && <Check size={13} strokeWidth={3} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className={styles.addRow} onClick={openAdd}><Plus size={16} /> 일정 추가</button>
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
          <div className={styles.wgHead}>
            <span className={styles.wgGutter} />
            {weekDays.map((d) => {
              const dd = fromISO(d);
              return (
                <button key={d} type="button" className={`${styles.wgDayBtn} ${d === sel ? styles.wgDaySel : ''}`} onClick={() => setSel(d)}>
                  <span className={`${styles.wgDow} ${dd.getDay() === 0 ? styles.sun : dd.getDay() === 6 ? styles.sat : ''}`}>{DOW[dd.getDay()]}</span>
                  <span className={`${styles.wgDayNum} ${d === todayISO ? styles.wgToday : ''}`}>{dd.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.wgScroll}>
            {/* STYLE-EXCEPTION: 시간축 높이는 이벤트 개수에 따른 동적 런타임 값 */}
            <div className={styles.wgGrid} style={{ height: gridH }}>
              <div className={styles.wgGutterCol}>
                {hours.map((h) => <div key={h} className={styles.wgHour}><span>{String(h).padStart(2, '0')}:00</span></div>)}
              </div>
              <div className={styles.wgCols}>
                {week.perDay.map((day, ci) => (
                  <div key={weekDays[ci]} className={`${styles.wgCol} ${weekDays[ci] === todayISO ? styles.wgColToday : ''}`}>
                    {day.map((e) => {
                      const top = ((e.startM - week.startHour * 60) / 60) * HOUR_PX;
                      const h = Math.max(((e.endM - e.startM) / 60) * HOUR_PX, 24);
                      const w = 100 / e.cols;
                      return (
                        <button key={`${e.kind}-${e.id}`} type="button"
                          className={`${styles.wgEvt} ${styles[`c_${e.category}`]} ${e.done ? styles.wgEvtDone : ''}`}
                          /* STYLE-EXCEPTION: 시간대 위치·크기·레인 폭은 동적 런타임 값 */
                          style={{ top, height: h, left: `${e.lane * w}%`, width: `calc(${w}% - 3px)` }}
                          onClick={() => { setSel(weekDays[ci]); setView('day'); }}>
                          <span className={styles.wgEvtTime}>{fmtMin(e.startM)}</span>
                          <span className={styles.wgEvtTitle}>{e.title}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {showNow && (
                  /* STYLE-EXCEPTION: 현재 시각 위치는 동적 런타임 값 */
                  <div className={styles.wgNow} style={{ top: nowTop }} aria-hidden><span className={styles.wgNowDot} /></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 콘텐츠 — 목록 */}
      {view === 'list' && (
        <div className={styles.list}>
          {upcoming.length === 0 && <p className={styles.empty}>예정된 일정이 없어요.</p>}
          {upcoming.map((s) => (
            <button key={s.id} type="button" className={styles.listItem} onClick={() => { setSel(s.date); setView('day'); }}>
              <span className={styles.liDate}>{labelKor(s.date).slice(5)}</span>
              <span className={`${styles.pin} ${styles[`p_${s.category}`]}`} />
              <span className={styles.liTime}>{s.time}</span>
              <span className={styles.liTitle}>{s.title}</span>
              {s.place && <span className={styles.liPlace}>{s.place}</span>}
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button type="button" className={styles.fab} onClick={openAdd} aria-label="일정 추가"><Plus size={24} /></button>

      {/* 등록 바텀시트 */}
      {addOpen && (
        <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label="일정 등록"
          onClick={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className={styles.sheet}>
            <div className={styles.grab} />
            <div className={styles.sheetHead}>
              <button type="button" className={styles.sheetX} onClick={() => setAddOpen(false)} aria-label="취소"><X size={20} /></button>
              <b>일정 등록</b>
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
              <label className={styles.fLabel}>날짜</label>
              <input className={styles.fInput} type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>시간</label>
              <div className={styles.two}>
                <TimeSelect value={fStart} onChange={setFStart} ariaLabel="시작" />
                <span className={styles.tilde}>~</span>
                <TimeSelect value={fEnd} onChange={setFEnd} ariaLabel="종료(선택)" />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel}>장소</label>
              <input className={styles.fInput} type="text" value={fPlace} placeholder="장소(선택)"
                onChange={(e) => setFPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            </div>

            <p className={styles.soon}><Trash2 size={12} /> 반복·미리 알림은 다음 단계에서 추가돼요.</p>
          </div>
        </div>
      )}
    </div>
  );
}
