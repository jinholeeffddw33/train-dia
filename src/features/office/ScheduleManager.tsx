'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Check, CalendarDays, MapPin, Trash2 } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useOfficeStore, OFFICE_CATEGORIES } from '@/stores/office';
import styles from './ScheduleManager.module.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function labelKor(s: string): string { const d = fromISO(s); return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})`; }
function addDays(s: string, n: number): string { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); }

export default function ScheduleManager({ onClose, startMonth = false }: { onClose: () => void; startMonth?: boolean }) {
  const { schedules, addSchedule, removeSchedule, todos, toggleTodo } = useOfficeStore();
  const [sel, setSel] = useState<string>(iso(new Date()));
  const [view, setView] = useState<'day' | 'list'>('day');
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
  const hasEvent = useMemo(() => new Set(schedules.map((s) => s.date)), [schedules]);

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
        <button type="button" className={styles.datePick} onClick={() => setMonthOpen((v) => !v)}>
          <span className={styles.dateChip}><CalendarDays size={16} /></span>
          <span className={styles.dateLabel}>{labelKor(sel)}</span>
          <ChevronRight size={15} className={monthOpen ? styles.chevOpen : styles.chev} />
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
            {monthGrid.map((c, i) => c === null
              ? <span key={`e${i}`} />
              : (
                <button key={c} type="button"
                  className={`${styles.mCell} ${c === sel ? styles.mSel : ''} ${c === todayISO ? styles.mToday : ''}`}
                  onClick={() => { setSel(c); setMonthOpen(false); }}>
                  {fromISO(c).getDate()}
                  {hasEvent.has(c) && <span className={styles.mDot} />}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 주간 스트립 */}
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

      {/* 탭 */}
      <div className={styles.tabs}>
        <button type="button" className={view === 'day' ? styles.tabOn : styles.tab} onClick={() => setView('day')}>하루 일정</button>
        <button type="button" className={view === 'list' ? styles.tabOn : styles.tab} onClick={() => setView('list')}>목록 보기</button>
      </div>

      {/* 콘텐츠 */}
      {view === 'day' ? (
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
      ) : (
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
                <input className={styles.fInput} type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} step={600} aria-label="시작(10분 단위)" />
                <span className={styles.tilde}>~</span>
                <input className={styles.fInput} type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} step={600} aria-label="종료(선택, 10분 단위)" />
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
