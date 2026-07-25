'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Bell, Moon, Sun, ChevronRight, Plus, X, Check,
  ListChecks, CalendarClock, StickyNote, CalendarRange,
  TrainFront, GraduationCap, Shield, Heart, ClipboardCheck, UtensilsCrossed, Coffee,
  Settings, History, CalendarDays, Newspaper,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { getUserRole } from '@/lib/auth';
import { useThemeStore } from '@/stores/theme';
import { useOfficeStore, isOverdue } from '@/stores/office';
import { APP_VERSION } from '@/lib/constants';
import { COPYRIGHT_NOTICE } from '@/lib/provenance';
import type { WorldId } from '@/components/layout/WorldHub';
import ScheduleManager from './ScheduleManager';
import NoteManager from './NoteManager';
import TaskBoard from './TaskBoard';
import TimeSelect from './TimeSelect';
import WeeklyMenu from '@/features/life/menu/WeeklyMenu';
import NewsOverlay from './NewsOverlay';
import styles from './OfficeDashboard.module.css';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function todayLabel(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}. ${mm}. ${dd} (${DOW[d.getDay()]})`;
}
// 월드허브와 동일한 시간대별 부제
function getSubtitle(): string {
  const h = new Date().getHours();
  if (h < 6) return '편안한 밤 되세요 🌙';
  if (h < 12) return '오늘도 안전운행 하세요!';
  if (h < 18) return '오후도 화이팅 🚇';
  return '오늘도 고생 많으셨어요';
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WORLD_ICONS: { id: WorldId; label: string; Icon: typeof TrainFront; tone: string }[] = [
  { id: 'duty',   label: '근무',   Icon: TrainFront,    tone: 'blue' },
  { id: 'edu',    label: '교육',   Icon: GraduationCap, tone: 'green' },
  { id: 'safety', label: '안전',   Icon: Shield,        tone: 'amber' },
  { id: 'life',   label: '라이프', Icon: Heart,         tone: 'pink' },
];

export default function OfficeDashboard({ onEnter, onOpenHub, onOpenSettings }: { onEnter: (w: WorldId) => void; onOpenHub?: () => void; onOpenSettings?: () => void }) {
  const authUser = useAuthStore((s) => s.user);
  const name = authUser?.name ?? '';
  const role = getUserRole(authUser?.sabun);
  const { theme, toggle: toggleTheme } = useThemeStore();

  const {
    todos, schedules, notes,
    addTodo, toggleTodo, removeTodo, pullToToday,
    addSchedule, removeSchedule,
    addNote, removeNote,
  } = useOfficeStore();

  // 일정관리 / 메모 전체 화면
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedStartMonth, setSchedStartMonth] = useState(false); // 캘린더 보기 → 월 그리드 펼침
  const [schedStartView, setSchedStartView] = useState<'day' | 'week'>('day'); // 진입 경로별 초기 뷰
  const [noteMgrOpen, setNoteMgrOpen] = useState(false);
  const [taskBoardOpen, setTaskBoardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  // 인라인 추가 폼 토글 (2열 카드라 기본 접힘)
  const [todoAddOpen, setTodoAddOpen] = useState(false);
  const [schedAddOpen, setSchedAddOpen] = useState(false);

  const [todoText, setTodoText] = useState('');
  const [todoTime, setTodoTime] = useState('');
  const [todoUrgent, setTodoUrgent] = useState(false);
  const [schTime, setSchTime] = useState('');
  const [schTitle, setSchTitle] = useState('');
  const [schPlace, setSchPlace] = useState('');
  const [noteText, setNoteText] = useState('');

  const todoRef = useRef<HTMLElement>(null);
  const schedRef = useRef<HTMLElement>(null);
  const memoRef = useRef<HTMLElement>(null);
  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 오늘 할 일 / 밀린 일 분리 — 날짜가 없으면(옛 데이터) 오늘 것으로 본다
  const { todayTodos, overdueTodos } = useMemo(() => {
    const t = todayISO();
    return {
      todayTodos: todos.filter((x) => !isOverdue(x, t)),
      overdueTodos: todos.filter((x) => isOverdue(x, t)),
    };
  }, [todos]);

  // 진행률은 '오늘 할 일' 기준 — 전체 누적 기준이면 날이 갈수록 의미가 없어진다
  const { done, total, pct } = useMemo(() => {
    const t = todayTodos.length;
    const d = todayTodos.filter((x) => x.done).length;
    return { done: d, total: t, pct: t === 0 ? 0 : Math.round((d / t) * 100) };
  }, [todayTodos]);

  const submitTodo = () => {
    if (!todoText.trim()) return;
    addTodo({ text: todoText.trim(), time: todoTime, urgent: todoUrgent });
    setTodoText(''); setTodoTime(''); setTodoUrgent(false); setTodoAddOpen(false);
  };
  const submitSchedule = () => {
    if (!schTitle.trim() || !schTime) return;
    addSchedule({ date: todayISO(), time: schTime, title: schTitle.trim(), place: schPlace.trim() });
    setSchTime(''); setSchTitle(''); setSchPlace(''); setSchedAddOpen(false);
  };
  const todaySchedules = useMemo(
    () => schedules.filter((s) => s.date === todayISO()),
    [schedules],
  );
  // 오늘의 일정 = 등록 일정 + '일정에 추가'한 할 일(종일이면 시간 '' → 맨 위). 단일 소스
  const todayTimeline = useMemo(() => {
    const sched = todaySchedules.map((s) => ({ kind: 'sched' as const, id: s.id, time: s.time, title: s.title, place: s.place, done: false }));
    const inSched = todos.filter((t) => t.inSchedule ?? !!t.time)
      .map((t) => ({ kind: 'todo' as const, id: t.id, time: t.time || '', title: t.text, place: '', done: t.done }));
    return [...sched, ...inSched].sort((a, b) => a.time.localeCompare(b.time));
  }, [todaySchedules, todos]);
  const submitNote = () => {
    if (!noteText.trim()) return;
    addNote({ body: noteText.trim() });
    setNoteText('');
  };

  const quickIcons = [
    { key: 'cal',   label: '일정관리',    tone: 'blue',   Icon: CalendarRange, onClick: () => { setSchedStartView('day'); setSchedStartMonth(true); setScheduleOpen(true); } },
    { key: 'todo',  label: '오늘의 할일', tone: 'blue',   Icon: ListChecks,    onClick: () => setTaskBoardOpen(true) },
    { key: 'sched', label: '이번주 일정', tone: 'purple', Icon: CalendarClock, onClick: () => { setSchedStartView('week'); setSchedStartMonth(false); setScheduleOpen(true); } },
    { key: 'memo',  label: '메모',        tone: 'green',  Icon: StickyNote,    onClick: () => setNoteMgrOpen(true) },
  ];

  return (
    <div className={styles.dash}>
      {/* ── 인사말(좌) + [아이콘 + 날짜 카드](우) — 시안 배치 ── */}
      <div className={styles.headerRow}>
        <div className={styles.greetBlock}>
          <p className={styles.greeting}>안녕하세요,</p>
          <h1 className={styles.hubTitle}>{name ? `${name} ${role}` : '답십리 승무사업소'} 👋</h1>
          {name && <p className={styles.office}>답십리 승무사업소</p>}
          <p className={styles.hubSubtitle}>{getSubtitle()}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.topBar}>
            <button type="button" className={styles.iconBtn} onClick={toggleTheme}
              aria-label={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
              {theme === 'dark' ? <Moon size={20} strokeWidth={2.2} /> : <Sun size={20} strokeWidth={2.2} />}
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => onOpenSettings?.()} aria-label="설정 열기">
              <Settings size={20} strokeWidth={2.2} />
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => onEnter('safety')} aria-label="알림">
              <Bell size={20} strokeWidth={2.2} />
            </button>
          </div>
          <button type="button" className={styles.dateCard} onClick={() => onOpenHub?.()} data-press
            aria-label="기관사 화면으로 이동">
            <span className={styles.dateTop}>
              <CalendarDays size={16} strokeWidth={2.4} />
              <span className={styles.dateText}>{todayLabel()}</span>
            </span>
            <span className={styles.dateGo}>기관사 일정 보기 <ChevronRight size={13} /></span>
          </button>
        </div>
      </div>

      {/* ── 세로: 오늘의 할 일 → 오늘의 일정 (모바일 가독성 우선) ── */}
      <div className={styles.stackCol}>
        {/* 할 일 */}
        <section ref={todoRef} className={styles.miniCard}>
          <div className={styles.miniHead}>
            <span className={`${styles.headIcon} ${styles.headIconTodo}`}><ListChecks size={20} /></span>
            <div className={styles.headText}>
              <h2 className={styles.miniTitle}>오늘의 할 일</h2>
              <span className={styles.headSub}>
                {todos.length === 0 ? '할 일 없음' : `${todayTodos.filter((t) => !t.done).length}개 남음`}
              </span>
            </div>
            <button type="button" className={styles.addMini} onClick={() => setTodoAddOpen((v) => !v)} aria-label="할 일 추가">
              <Plus size={16} />
            </button>
          </div>
          {todoAddOpen && (
            <div className={styles.addForm}>
              <input className={styles.formText} type="text" placeholder="할 일" value={todoText} autoFocus
                onChange={(e) => setTodoText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitTodo(); }} aria-label="할 일 내용" />
              <div className={styles.formRow}>
                <TimeSelect value={todoTime} onChange={setTodoTime} ariaLabel="마감시각" />
                <button type="button" className={`${styles.urgentToggle} ${todoUrgent ? styles.urgentOn : ''}`}
                  onClick={() => setTodoUrgent((v) => !v)} aria-pressed={todoUrgent}>긴급</button>
                <button type="button" className={styles.formSave} onClick={submitTodo}>추가</button>
              </div>
            </div>
          )}
          <ul className={styles.miniList}>
            {todayTodos.map((t) => (
              <li key={t.id} className={`${styles.todoItem} ${t.done ? styles.todoDone : ''}`}>
                <button type="button" className={styles.checkBox} onClick={() => toggleTodo(t.id)} aria-pressed={t.done} aria-label="완료 토글">
                  {t.done && <Check size={12} strokeWidth={3} />}
                </button>
                <span className={styles.todoText}>{t.text}</span>
                {t.urgent && !t.done && <span className={styles.urgentBadge}>긴급</span>}
                {t.time && <span className={styles.itemTime}>{t.time}</span>}
                <button type="button" className={styles.delBtn} onClick={() => removeTodo(t.id)} aria-label="삭제"><X size={13} /></button>
              </li>
            ))}

            {/* 밀린 일 — 어제 이전에 만들었는데 아직 안 끝난 것. '오늘로' 누르면 오늘 할 일로 옮겨진다 */}
            {overdueTodos.length > 0 && (
              <li className={styles.overdueHead}>
                <History size={13} /> 밀린 일 {overdueTodos.length}
              </li>
            )}
            {overdueTodos.map((t) => (
              <li key={t.id} className={`${styles.todoItem} ${styles.overdueItem}`}>
                <button type="button" className={styles.checkBox} onClick={() => toggleTodo(t.id)} aria-pressed={t.done} aria-label="완료 토글">
                  {t.done && <Check size={12} strokeWidth={3} />}
                </button>
                <span className={styles.todoText}>{t.text}</span>
                <button type="button" className={styles.pullBtn} onClick={() => pullToToday(t.id)} aria-label="오늘 할 일로 옮기기">오늘로</button>
                <button type="button" className={styles.delBtn} onClick={() => removeTodo(t.id)} aria-label="삭제"><X size={13} /></button>
              </li>
            ))}
          </ul>
        </section>

        {/* 일정 */}
        <section ref={schedRef} className={styles.miniCard}>
          <div className={styles.miniHead}>
            <span className={`${styles.headIcon} ${styles.headIconSched}`}><CalendarClock size={20} /></span>
            <div className={styles.headText}>
              <h2 className={styles.miniTitle}>오늘의 일정</h2>
              <span className={styles.headSub}>
                {todayTimeline.length === 0 ? '일정 없음' : `${todayTimeline.length}개`}
              </span>
            </div>
            <button type="button" className={styles.addMini} onClick={() => setSchedAddOpen((v) => !v)} aria-label="일정 추가">
              <Plus size={16} />
            </button>
          </div>
          {schedAddOpen && (
            <div className={styles.addForm}>
              <input className={styles.formText} type="text" placeholder="일정 제목" value={schTitle} autoFocus
                onChange={(e) => setSchTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSchedule(); }} aria-label="일정 제목" />
              <input className={styles.formText} type="text" placeholder="장소(선택)" value={schPlace}
                onChange={(e) => setSchPlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSchedule(); }} aria-label="장소" />
              <div className={styles.formRow}>
                <TimeSelect value={schTime} onChange={setSchTime} ariaLabel="시각" />
                <button type="button" className={styles.formSave} onClick={submitSchedule}>추가</button>
              </div>
            </div>
          )}
          <ul className={styles.miniList}>
            {todayTimeline.map((it) => (
              <li key={`${it.kind}-${it.id}`} className={`${styles.schedItem} ${it.done ? styles.schedDone : ''}`}>
                <span className={styles.schedTime}>{it.time || '종일'}</span>
                <span className={it.kind === 'todo' ? styles.schedDotTodo : styles.schedDot} aria-hidden />
                <div className={styles.schedBody}>
                  <span className={styles.schedTitleRow}>
                    <span className={styles.schedTitle}>{it.title}</span>
                    {it.kind === 'todo' && <span className={styles.todoChip}>할 일</span>}
                  </span>
                  {it.kind === 'sched' && it.place && <span className={styles.schedPlace}>{it.place}</span>}
                </div>
                {it.kind === 'sched' ? (
                  <button type="button" className={styles.delBtn} onClick={() => removeSchedule(it.id)} aria-label="삭제"><X size={13} /></button>
                ) : (
                  <button type="button" className={`${styles.checkBox} ${styles.schedCheck}`} onClick={() => toggleTodo(it.id)} aria-pressed={it.done} aria-label="완료 토글">
                    {it.done && <Check size={12} strokeWidth={3} />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── 빠른 메모 ── */}
      <section ref={memoRef} className={styles.card}>
        <div className={styles.cardHead}>
          <span className={`${styles.headIcon} ${styles.headIconMemo}`}><StickyNote size={20} /></span>
          <h2 className={styles.cardTitle}>빠른 메모</h2>
        </div>
        <div className={styles.memoAdd}>
          <input className={styles.textInput} type="text" placeholder="기억할 내용을 적어두세요"
            value={noteText} onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNote(); }} aria-label="메모" />
          <button type="button" className={styles.saveBtn} onClick={submitNote}>저장</button>
        </div>
        <ul className={styles.noteList}>
          {notes.slice(0, 4).map((n) => (
            <li key={n.id} className={styles.noteItem}>
              <span className={styles.noteText}>{n.title ? `${n.title} — ${n.body}` : n.body}</span>
              <button type="button" className={styles.delBtn} onClick={() => removeNote(n.id)} aria-label="삭제"><X size={14} /></button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 아이콘 2줄 ── */}
      <nav className={styles.iconGrid} aria-label="바로가기">
        {quickIcons.map((q) => (
          <button key={q.key} type="button" className={`${styles.gridBtn} ${styles[`tone_${q.tone}`]}`} onClick={q.onClick} data-press>
            <span className={styles.gridIcon}><q.Icon size={26} strokeWidth={2.1} /></span>
            <span className={styles.gridLabel}>{q.label}</span>
          </button>
        ))}
        {WORLD_ICONS.map((w) => (
          <button key={w.id} type="button" className={`${styles.gridBtn} ${styles[`tone_${w.tone}`]}`}
            onClick={() => window.setTimeout(() => onEnter(w.id), 60)} data-press aria-label={w.label}>
            <span className={styles.gridIcon}><w.Icon size={26} strokeWidth={2.1} /></span>
            <span className={styles.gridLabel}>{w.label}</span>
          </button>
        ))}
      </nav>

      {/* ── 2열: 진행률 | 자주 보는 기능 ── */}
      <div className={styles.twoCol}>
        <section className={styles.miniCard}>
          <div className={styles.miniHead}><h2 className={styles.miniTitle}>업무 진행률</h2></div>
          <div className={styles.progressRow}>
            <div className={styles.ringWrap}>
              <svg viewBox="0 0 72 72" className={styles.ring} role="img" aria-label={`진행률 ${pct}%`}>
                <circle className={styles.ringBg} cx="36" cy="36" r="30" />
                <circle className={styles.ringFg} cx="36" cy="36" r="30"
                  strokeDasharray={188.5} strokeDashoffset={188.5 * (1 - pct / 100)} transform="rotate(-90 36 36)" />
              </svg>
              <span className={styles.ringPct}>{pct}%</span>
            </div>
            <dl className={styles.progressStats}>
              <div><dt>완료</dt><dd className={styles.stDone}>{done}</dd></div>
              <div><dt>미완료</dt><dd className={styles.stLeft}>{total - done}</dd></div>
            </dl>
          </div>
          <button type="button" className={styles.detailBtn} onClick={() => setTaskBoardOpen(true)}>
            자세히 보기 <ChevronRight size={13} />
          </button>
        </section>

        <section className={styles.miniCard}>
          <div className={styles.miniHead}><h2 className={styles.miniTitle}>자주 보는 기능</h2></div>
          <div className={styles.shortcutCol}>
            <button type="button" className={styles.shortcut} onClick={() => setMenuOpen(true)} data-press>
              <UtensilsCrossed size={15} /> 이번주 식당메뉴
            </button>
            <button type="button" className={styles.shortcut} onClick={() => onEnter('standby')} data-press>
              <ClipboardCheck size={15} /> 대기충당확인
            </button>
            <a className={styles.shortcut} href="https://cafe.naver.com/smrthink" target="_blank" rel="noopener noreferrer" data-press>
              <Coffee size={15} /> 카페 바로가기
            </a>
          </div>
        </section>
      </div>

      {/* ── 오늘의 헤드라인 뉴스 (진입 카드) ── */}
      <button type="button" className={styles.newsCard} onClick={() => setNewsOpen(true)} data-press>
        <span className={styles.newsIcon}><Newspaper size={22} strokeWidth={2} /></span>
        <span className={styles.newsText}>
          <strong>오늘의 헤드라인 뉴스</strong>
          <span>매일 주요 뉴스를 한눈에 확인하세요</span>
        </span>
        <ChevronRight size={18} className={styles.newsArrow} aria-hidden />
      </button>

      <div className={styles.footer}>
        <span className={styles.footerBrand}>Train DIA</span>
        <span className={styles.footerVersion}>{APP_VERSION}</span>
        <span className={styles.footerCopyright}>{COPYRIGHT_NOTICE}</span>
      </div>

      {/* 일정관리 전체 화면 */}
      {scheduleOpen && (
        <div className={styles.schedOverlay}>
          <ScheduleManager onClose={() => setScheduleOpen(false)} startMonth={schedStartMonth} startView={schedStartView} />
        </div>
      )}
      {/* 메모 전체 화면 */}
      {noteMgrOpen && (
        <div className={styles.schedOverlay}>
          <NoteManager onClose={() => setNoteMgrOpen(false)} />
        </div>
      )}
      {/* 오늘의 할 일 전체보기 */}
      {taskBoardOpen && (
        <div className={styles.schedOverlay}>
          <TaskBoard onBack={() => setTaskBoardOpen(false)} />
        </div>
      )}
      {/* 이번주 식당메뉴 */}
      {menuOpen && (
        <div className={styles.schedOverlay}>
          <WeeklyMenu onBack={() => setMenuOpen(false)} />
        </div>
      )}
      {/* 오늘의 헤드라인 뉴스 */}
      {newsOpen && (
        <div className={styles.schedOverlay}>
          <NewsOverlay onBack={() => setNewsOpen(false)} />
        </div>
      )}
    </div>
  );
}
