'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Stamp, Trophy, CalendarCheck, Flame } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import styles from './Stamp.module.css';

interface Props {
  onBack: () => void;
}

/** localStorage 저장 형식: { sabun: { 'YYYY-MM-DD': true } } */
const STORAGE_KEY = 'attendance-stamp-v1';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStamps(sabun: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const obj = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return new Set(Object.keys(obj[sabun] ?? {}));
  } catch {
    return new Set();
  }
}

function saveStamp(sabun: string, dayKey: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) as Record<string, Record<string, boolean>> : {};
    if (!obj[sabun]) obj[sabun] = {};
    obj[sabun][dayKey] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

/** 연속 일수 (오늘 또는 어제부터 거꾸로 세기) */
function calcStreak(stamps: Set<string>): number {
  let count = 0;
  const d = new Date();
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (stamps.has(key)) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/** 이번 달 일별 도장 여부 */
function buildMonthGrid(stamps: Set<string>) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();
  const cells: { d: number | null; stamped: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ d: null, stamped: false, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, stamped: stamps.has(key), isToday: d === todayDate });
  }
  return { cells, year, month: month + 1, daysInMonth, stampedThisMonth: cells.filter((c) => c.stamped).length };
}

const MILESTONES = [
  { days: 7,   emoji: '🌱', label: '7일 연속',   msg: '꾸준함의 시작이에요!' },
  { days: 30,  emoji: '🌳', label: '30일 연속',  msg: '한 달째 무사고. 대단해요!' },
  { days: 100, emoji: '👑', label: '100일 연속', msg: '100일 무사고 마스터입니다 👑' },
  { days: 365, emoji: '🏆', label: '365일 연속', msg: '1년 무사고 전설이에요!' },
];

export default function AttendanceStamp({ onBack }: Props) {
  const driver = useDriverStore((s) => s.current);
  const authUser = useAuthStore((s) => s.user);
  const sabun = driver?.s ?? authUser?.sabun ?? 'guest';
  const name = driver?.n ?? authUser?.name ?? '기관사';

  const [stamps, setStamps] = useState<Set<string>>(new Set());
  const [stampedToday, setStampedToday] = useState(false);
  const [celebratingMilestone, setCelebratingMilestone] = useState<typeof MILESTONES[number] | null>(null);

  useEffect(() => {
    const s = loadStamps(sabun);
    setStamps(s);
    setStampedToday(s.has(todayKey()));
  }, [sabun]);

  const streak = useMemo(() => calcStreak(stamps), [stamps]);
  const totalDays = stamps.size;
  const monthGrid = useMemo(() => buildMonthGrid(stamps), [stamps]);

  const handleStamp = useCallback(() => {
    if (stampedToday) return;
    const key = todayKey();
    saveStamp(sabun, key);
    const next = new Set(stamps);
    next.add(key);
    setStamps(next);
    setStampedToday(true);

    // 마일스톤 달성 체크
    const nextStreak = calcStreak(next);
    const reached = MILESTONES.find((m) => m.days === nextStreak);
    if (reached) setCelebratingMilestone(reached);
  }, [stampedToday, sabun, stamps]);

  const nextMilestone = MILESTONES.find((m) => m.days > streak);
  const remaining = nextMilestone ? nextMilestone.days - streak : 0;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>무사고 출근 도장</h1>
      </div>

      <div className={styles.body}>
        <p className={styles.nameLine}>{name}</p>

        {/* 통계 카드 3개 */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Flame size={18} className={styles.statIconStreak} />
            <span className={styles.statValue}>{streak}</span>
            <span className={styles.statLabel}>연속 일</span>
          </div>
          <div className={styles.statCard}>
            <CalendarCheck size={18} className={styles.statIconTotal} />
            <span className={styles.statValue}>{totalDays}</span>
            <span className={styles.statLabel}>총 도장</span>
          </div>
          <div className={styles.statCard}>
            <Trophy size={18} className={styles.statIconNext} />
            <span className={styles.statValue}>{nextMilestone ? remaining : 0}</span>
            <span className={styles.statLabel}>{nextMilestone ? `${nextMilestone.days}일까지` : '모두 달성!'}</span>
          </div>
        </div>

        {/* 오늘 도장 버튼 */}
        <button
          type="button"
          className={`${styles.stampBtn} ${stampedToday ? styles.stampBtnDone : ''}`}
          onClick={handleStamp}
          disabled={stampedToday}
        >
          <Stamp size={28} />
          <span>{stampedToday ? '오늘 도장 완료!' : '오늘 도장 찍기'}</span>
        </button>

        {/* 이번 달 캘린더 */}
        <section className={styles.calendarCard}>
          <h2 className={styles.calendarTitle}>
            {monthGrid.year}년 {monthGrid.month}월
            <span className={styles.calendarCount}> · {monthGrid.stampedThisMonth}/{monthGrid.daysInMonth}일</span>
          </h2>
          <div className={styles.calendarDow}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {monthGrid.cells.map((c, i) => {
              if (c.d === null) return <span key={i} className={styles.calendarCellEmpty} />;
              return (
                <span
                  key={i}
                  className={`${styles.calendarCell} ${c.stamped ? styles.calendarCellStamped : ''} ${c.isToday ? styles.calendarCellToday : ''}`}
                >
                  <span className={styles.calendarCellDay}>{c.d}</span>
                  {c.stamped && <span className={styles.calendarCellStampMark}>도장</span>}
                </span>
              );
            })}
          </div>
        </section>

        {/* 마일스톤 목록 */}
        <section className={styles.milestonesCard}>
          <h2 className={styles.milestonesTitle}>마일스톤</h2>
          <div className={styles.milestonesList}>
            {MILESTONES.map((m) => {
              const achieved = streak >= m.days;
              return (
                <div key={m.days} className={`${styles.milestoneItem} ${achieved ? styles.milestoneAchieved : ''}`}>
                  <span className={styles.milestoneEmoji}>{m.emoji}</span>
                  <div className={styles.milestoneText}>
                    <span className={styles.milestoneLabel}>{m.label}</span>
                    <span className={styles.milestoneMsg}>{m.msg}</span>
                  </div>
                  {achieved && <span className={styles.milestoneCheck}>✓</span>}
                </div>
              );
            })}
          </div>
        </section>

        <p className={styles.footnote}>도장 기록은 이 기기에만 저장돼요</p>
      </div>

      {/* 마일스톤 달성 축하 모달 */}
      {celebratingMilestone && (
        <div className={styles.celebOverlay} role="dialog" aria-modal="true" onClick={() => setCelebratingMilestone(null)}>
          <div className={styles.celebCard}>
            <span className={styles.celebEmoji}>{celebratingMilestone.emoji}</span>
            <h2 className={styles.celebLabel}>{celebratingMilestone.label} 달성!</h2>
            <p className={styles.celebMsg}>{celebratingMilestone.msg}</p>
            <button type="button" className={styles.celebBtn} onClick={() => setCelebratingMilestone(null)}>
              감사합니다
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
