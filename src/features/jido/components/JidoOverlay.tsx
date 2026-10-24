'use client';

/**
 * 지도승무 — 소장·부소장·부장 전용.
 *
 * 기준(승무원지도운용내규 제69조 · 사업소 운영)
 *   - 모든 기관사: 분기에 1회 이상
 *   - 중점관리대상자: 지정 기간 동안 월 1회 이상
 * 횟수는 «기관사가 받은 횟수» — 담당부장이 아닌 지도요원이 탔어도 그 기관사의 횟수로 센다.
 *
 * 탭: 내 담당 · 전체 현황 · 지도요원 · 기록하기(그날그날 넣기 + 실적 엑셀 올리기)
 *
 * 이름 옆 색 표시 = 출입문 민원 7단계(«출입문 민원 분석 보고서» ① 출입문 기준). 심각부터·민원 많은 순으로 놓는다.
 * 부장은 자기 담당만, 소장·부소장·지도부장 3명은 전체를 본다 — 범위는 서버(/api/jido/complaints)가 자른다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, RotateCw, ChevronLeft, ChevronRight, ChevronDown, Check, AlertTriangle,
  Upload, Trash2, Search, UserCheck, FileSpreadsheet,
} from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useAuthStore } from '@/stores/auth';
import { getRoster } from '@/data/cycle';
import { isChief, isViceChief } from '@/lib/auth';
import type { JidoRide, JidoRosterEntry } from '../lib/jidoTypes';
import {
  buildStatus, groupByManager, guideCounts, focusShort, quarterOf, quarterLabel, quarterRange, shiftQuarter,
  type DriverStatus, type Quarter,
} from '../lib/jidoStats';
import type { JidoParseResult } from '../lib/parseJidoExcel';
import {
  compareByComplaint, topTypes, type JidoComplaint, type JidoComplaintResponse,
} from '../lib/jidoComplaint';
import { STAGE_NAME, STAGE_ACTION, TYPE_TIPS, type Stage } from '@/features/myinfo/lib/complaintStages';
import styles from './JidoOverlay.module.css';

type Tab = 'mine' | 'all' | 'guides' | 'record';
const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: '내 담당' },
  { id: 'all', label: '전체 현황' },
  { id: 'guides', label: '지도요원' },
  { id: 'record', label: '기록하기' },
];

/** 담당부장 보여 주는 차례 — 사업소 실적표와 같은 순서(지도·지도1·지도2·계획1~8) */
const MANAGER_ORDER = ['유승용', '이현구', '이선길', '장진수', '김진완', '김창환', '최승곤', '김봉철', '이병홍', '김재범', '조재홍'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const ym = (iso: string) => (iso ? `${iso.slice(2, 4)}.${Number(iso.slice(5, 7))}` : '');

type ComplaintMap = Map<string, JidoComplaint>;
const EMPTY_MAP: ComplaintMap = new Map();
const TYPE_LABEL = new Map(TYPE_TIPS.map((x) => [x.key, x.label]));
const STAGES_DESC: Stage[] = [7, 6, 5, 4, 3, 2, 1];

/** 심각부터·민원 많은 순 — 같으면 원래 순서 유지 */
function sortByComplaint<T extends { sabun: string }>(rows: T[], cm: ComplaintMap): T[] {
  if (cm.size === 0) return rows;
  return rows.map((r, i) => ({ r, i }))
    .sort((a, b) => compareByComplaint(cm.get(a.r.sabun), cm.get(b.r.sabun)) || a.i - b.i)
    .map((x) => x.r);
}
const monthLabel = (ym: string) => `${Number(ym.slice(5, 7))}월`;

export default function JidoOverlay({ onBack }: { onBack: () => void }) {
  useHistoryBack('jido-overlay', onBack);
  const me = useAuthStore((s) => s.user);
  const today = todayISO();
  const [quarter, setQuarter] = useState<Quarter>(() => quarterOf(today));
  const current = quarterOf(today);
  const isCurrentQ = quarter.year === current.year && quarter.q === current.q;

  const [rides, setRides] = useState<JidoRide[]>([]);
  const [roster, setRoster] = useState<JidoRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /* 지금 화면에 깔린 자료가 어느 분기 것인가. 기록을 넣은 뒤 다시 불러올 때는 화면을 비우지 않는다 —
     비우면 «기록했어요» 안내와 입력 칸이 통째로 사라졌다 깜박인다. 분기를 바꿀 때만 비운다. */
  const [loadedKey, setLoadedKey] = useState('');
  const qKey = quarterLabel(quarter);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { from, to } = quarterRange(quarter);
    try {
      const res = await fetch(`/api/jido?from=${from}&to=${to}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || '지도승무 기록을 불러올 수 없어요');
      setRides(json.rides ?? []);
      setRoster(json.roster ?? []);
      setLoadedKey(quarterLabel(quarter));
    } catch (e) {
      setError(e instanceof Error ? e.message : '지도승무 기록을 불러올 수 없어요');
    } finally {
      setLoading(false);
    }
  }, [quarter]);
  useEffect(() => { load(); }, [load]);

  // 출입문 민원 단계 — 지도승무 기록과 따로 받는다(못 받아도 지도승무 화면은 그대로 쓴다)
  const [complaints, setComplaints] = useState<{ map: ComplaintMap; scope: 'all' | 'mine'; from: string; to: string } | null>(null);
  const [cError, setCError] = useState('');
  const loadComplaints = useCallback(async () => {
    setCError('');
    try {
      const res = await fetch('/api/jido/complaints');
      const json = (await res.json().catch(() => ({}))) as Partial<JidoComplaintResponse> & { message?: string };
      if (!res.ok) throw new Error(json.message || '출입문 민원 단계를 불러오지 못했어요');
      setComplaints({
        map: new Map((json.people ?? []).map((p) => [p.sabun, p])),
        scope: json.scope ?? 'mine',
        from: json.periodFrom ?? '',
        to: json.periodTo ?? '',
      });
    } catch (e) {
      setCError(e instanceof Error ? e.message : '출입문 민원 단계를 불러오지 못했어요');
    }
  }, []);
  useEffect(() => { loadComplaints(); }, [loadComplaints]);
  const cm: ComplaintMap = complaints?.map ?? EMPTY_MAP;
  const reloadAll = () => { load(); loadComplaints(); };

  // 지금 명부의 기관사(결원·내근 자리 제외) — 새로 들어온 기관사도 바로 잡힌다
  const drivers = useMemo(
    () => getRoster(new Date()).filter((p) => !/^결원/.test(p.n) && p.d !== '내근' && p.s).map((p) => ({ s: p.s!, n: p.n })),
    [],
  );
  const rosterMap = useMemo(() => new Map(roster.map((r) => [r.driverSabun, r])), [roster]);
  const status = useMemo(
    () => buildStatus(drivers, rosterMap, rides, quarter, today),
    [drivers, rosterMap, rides, quarter, today],
  );
  const groups = useMemo(() => groupByManager(status, MANAGER_ORDER), [status]);
  const myName = me?.name ?? '';
  const myGroup = groups.find((g) => g.manager === myName) ?? null;

  const [tab, setTab] = useState<Tab>('mine');
  // 담당 기관사가 없는 분(소장·부소장)은 전체 현황부터
  const didPickTab = useRef(false);
  useEffect(() => {
    if (loading || didPickTab.current) return;
    didPickTab.current = true;
    if (!myGroup) setTab('all');
  }, [loading, myGroup]);

  const showSpinner = loading && loadedKey !== qKey;
  const done = status.filter((s) => s.done).length;
  const focusMissing = status.filter((s) => s.focus && focusShort(s.focus.months)).length;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.iconBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.title}>지도승무</h2>
        <button type="button" className={styles.iconBtn} onClick={reloadAll} aria-label="새로고침" disabled={loading}>
          <RotateCw size={18} strokeWidth={2.2} />
        </button>
      </header>

      <div className={styles.body}>
        {/* 분기 고르기 */}
        <div className={styles.quarterRow}>
          <button type="button" className={styles.qBtn} onClick={() => setQuarter((q) => shiftQuarter(q, -1))} aria-label="이전 분기">
            <ChevronLeft size={20} />
          </button>
          <span className={styles.qLabel}>{quarterLabel(quarter)}</span>
          <button type="button" className={styles.qBtn} onClick={() => setQuarter((q) => shiftQuarter(q, 1))}
            aria-label="다음 분기" disabled={isCurrentQ}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 한눈에 */}
        {!showSpinner && !error && (
          <section className={styles.summary} aria-label="이번 분기 요약">
            <div className={styles.sumItem}>
              <span className={styles.sumNum}>{done}<small>/{status.length}</small></span>
              <span className={styles.sumLabel}>분기 1회 완료</span>
            </div>
            <div className={styles.sumItem}>
              <span className={`${styles.sumNum} ${status.length - done > 0 ? styles.numWarn : ''}`}>{status.length - done}</span>
              <span className={styles.sumLabel}>아직 안 탄 기관사</span>
            </div>
            <div className={styles.sumItem}>
              <span className={`${styles.sumNum} ${focusMissing > 0 ? styles.numBad : ''}`}>{focusMissing}</span>
              {/* 지난 분기는 «미달», 이번 분기는 달이 아직 안 끝났을 수 있어 «아직» */}
              <span className={styles.sumLabel}>{isCurrentQ ? '중점관리 이번 달 아직' : '중점관리 월 1회 미달'}</span>
            </div>
          </section>
        )}

        <div className={styles.tabs} role="tablist" aria-label="지도승무 보기">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
              className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {showSpinner ? (
          <div className={styles.state} role="status">
            <RotateCw size={28} className={styles.spin} aria-hidden />
            <p className={styles.stateText}>지도승무 기록을 불러오는 중…</p>
          </div>
        ) : error ? (
          <div className={styles.state}>
            <AlertTriangle size={32} className={styles.stateIcon} aria-hidden />
            <p className={styles.stateText}>{error}</p>
            <button type="button" className={styles.primaryBtn} onClick={load}><RotateCw size={16} /> 다시 불러오기</button>
          </div>
        ) : tab === 'mine' ? (
          myGroup ? (
            <MineTab group={myGroup} quarter={quarter} cm={cm} period={complaints} cError={cError} onRetry={loadComplaints} />
          ) : (
            <div className={styles.state}>
              <UserCheck size={32} className={styles.stateIcon} aria-hidden />
              <p className={styles.stateText}>담당 기관사가 지정되어 있지 않아요.</p>
              <p className={styles.stateSub}>«전체 현황»에서 모든 기관사를 볼 수 있어요. 담당 배정은 실적 엑셀을 올리면 함께 들어가요.</p>
            </div>
          )
        ) : tab === 'all' ? (
          <AllTab groups={groups} cm={cm} showAll={complaints?.scope === 'all'} period={complaints} />
        ) : tab === 'guides' ? (
          <GuideTab rides={rides} quarter={quarter} />
        ) : (
          <RecordTab
            drivers={drivers}
            rides={rides}
            meSabun={me?.sabun ?? ''}
            canDeleteAll={me?.role === 'admin' || isChief(me?.sabun ?? '') || isViceChief(me?.sabun ?? '')}
            onChanged={load}
          />
        )}
      </div>
    </div>
  );
}

/* ── 내 담당 ── */
function MineTab({ group, quarter, cm, period, cError, onRetry }: {
  group: ReturnType<typeof groupByManager>[number];
  quarter: Quarter;
  cm: ComplaintMap;
  period: { from: string; to: string } | null;
  cError: string;
  onRetry: () => void;
}) {
  const [onlyTodo, setOnlyTodo] = useState(false);
  const base = onlyTodo ? group.rows.filter((r) => !r.done || (r.focus && focusShort(r.focus.months))) : group.rows;
  const rows = sortByComplaint(base, cm);
  return (
    <>
      <div className={styles.groupHead}>
        <span className={styles.groupTitle}>{group.manager} 부장님 담당 {group.total}명</span>
        <Progress done={group.done} total={group.total} />
      </div>
      <StageSummary rows={group.rows} cm={cm} period={period} cError={cError} onRetry={onRetry} />
      <FilterToggle on={onlyTodo} onChange={setOnlyTodo} />
      <DriverList rows={rows} quarter={quarter} cm={cm} />
    </>
  );
}

/* ── 출입문 민원 한눈에 — 단계별 인원(심각부터). 색 = 이름 옆 표시와 같은 색 ── */
function StageSummary({ rows, cm, period, cError, onRetry }: {
  rows: { sabun: string }[];
  cm: ComplaintMap;
  period: { from: string; to: string } | null;
  cError: string;
  onRetry: () => void;
}) {
  if (cError) {
    return (
      <div className={styles.cpBox} role="status">
        <p className={styles.cpNote}>{cError}</p>
        <button type="button" className={styles.linkBtn} onClick={onRetry}>다시 불러오기</button>
      </div>
    );
  }
  if (!period) return null;
  const counts = new Map<Stage, number>();
  let none = 0;
  for (const r of rows) {
    const c = cm.get(r.sabun);
    if (c) counts.set(c.doorStage, (counts.get(c.doorStage) ?? 0) + 1);
    else none += 1;
  }
  const care = STAGES_DESC.filter((s) => s >= 5).reduce((n, s) => n + (counts.get(s) ?? 0), 0);
  return (
    <section className={styles.cpBox} aria-label="출입문 민원 단계">
      <p className={styles.cpTitle}>
        출입문 민원 단계
        {care > 0 && <span className={styles.cpCare}>경계 이상 {care}명</span>}
      </p>
      <StageScale counts={counts} />
      <p className={styles.cpNote}>
        {period.from && `${ym(period.from)}~${ym(period.to)} · `}출입문 사건 수 기준 7단계 · 심각한 기관사부터 보여요
        {none > 0 && ` · 민원 자료 없음 ${none}명(새로 온 기관사)`}
      </p>
    </section>
  );
}

/**
 * 7단계 눈금 한 줄 — 왼쪽 매우 우수 → 오른쪽 심각(내 정보 사다리와 같은 방향).
 * counts 를 주면 단계별 인원을, current 를 주면 그 단계만 진하게 칠해 «어디쯤인지» 보여 준다.
 */
function StageScale({ counts, current }: { counts?: Map<Stage, number>; current?: Stage }) {
  const order = [...STAGES_DESC].reverse();
  return (
    <ol className={styles.scale} aria-label={current ? `7단계 중 ${current}단계 ${STAGE_NAME[current]}` : '7단계 인원'}>
      {order.map((s) => {
        const n = counts?.get(s) ?? 0;
        const on = current === s;
        const dim = counts ? n === 0 : current !== undefined && !on;
        return (
          <li key={s} className={`${styles.scaleSeg} ${styles[`stage${s}`]} ${on ? styles.scaleOn : ''} ${dim ? styles.scaleDim : ''}`}
            aria-current={on ? 'true' : undefined}>
            <span className={styles.scaleName}>{STAGE_NAME[s]}</span>
            {counts && <span className={styles.scaleNum}>{n > 0 ? `${n}명` : '–'}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ── 전체 현황 ── */
function AllTab({ groups, cm, showAll, period }: {
  groups: ReturnType<typeof groupByManager>;
  cm: ComplaintMap;
  /** 소장·부소장·지도부장 3명 — 전체 기관사의 민원 단계를 본다 */
  showAll: boolean;
  period: { from: string; to: string } | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [view, setView] = useState<'manager' | 'stage'>('manager');
  const keep = (r: DriverStatus) => !onlyTodo || !r.done || !!(r.focus && focusShort(r.focus.months));
  const everyone = useMemo(
    () => sortByComplaint(groups.flatMap((g) => g.rows.map((r) => ({ ...r, manager: g.manager }))), cm),
    [groups, cm],
  );
  return (
    <>
      {showAll && (
        <div className={styles.filterRow} role="group" aria-label="전체 현황 보는 방법">
          <button type="button" className={`${styles.chip} ${view === 'manager' ? styles.chipOn : ''}`}
            onClick={() => setView('manager')} aria-pressed={view === 'manager'}>부장별</button>
          <button type="button" className={`${styles.chip} ${view === 'stage' ? styles.chipOn : ''}`}
            onClick={() => setView('stage')} aria-pressed={view === 'stage'}>민원 심각 순</button>
        </div>
      )}
      <FilterToggle on={onlyTodo} onChange={setOnlyTodo} />
      {showAll && view === 'stage' ? (
        <>
          <StageSummary rows={everyone} cm={cm} period={period} cError="" onRetry={() => {}} />
          <DriverList rows={everyone.filter(keep)} cm={cm} showManager />
        </>
      ) : (
        <ul className={styles.groupList}>
          {groups.map((g) => {
            const isOpen = open === g.manager;
            const rows = sortByComplaint(g.rows.filter(keep), cm);
            const care = showAll ? g.rows.filter((r) => (cm.get(r.sabun)?.doorStage ?? 0) >= 5).length : 0;
            return (
              <li key={g.manager} className={styles.groupCard}>
                <button type="button" className={styles.groupBtn} aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : g.manager)}>
                  <span className={styles.groupName}>{g.manager === '담당 미지정' ? g.manager : `${g.manager} 부장`}</span>
                  <span className={styles.groupMeta}>
                    {g.done}/{g.total}명
                    {g.focusMissing > 0 && <span className={styles.badgeBad}>중점 {g.focusMissing}</span>}
                    {care > 0 && <span className={styles.cpCare}>민원 경계↑ {care}</span>}
                  </span>
                  <ChevronDown size={18} className={isOpen ? styles.chevOpen : styles.chev} aria-hidden />
                  <Progress done={g.done} total={g.total} />
                </button>
                {isOpen && (rows.length > 0
                  ? <DriverList rows={rows} cm={cm} />
                  : <p className={styles.emptyLine}>모두 채웠어요 👍</p>)}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* ── 지도요원별 ── */
function GuideTab({ rides, quarter }: { rides: JidoRide[]; quarter: Quarter }) {
  const list = guideCounts(rides, quarter);
  const max = Math.max(1, ...list.map((x) => x.count));
  const total = list.reduce((s, x) => s + x.count, 0);
  if (list.length === 0) {
    return (
      <div className={styles.state}>
        <UserCheck size={32} className={styles.stateIcon} aria-hidden />
        <p className={styles.stateText}>이 분기에는 아직 기록이 없어요.</p>
        <p className={styles.stateSub}>«기록하기»에서 넣거나 실적 엑셀을 올려 주세요.</p>
      </div>
    );
  }
  return (
    <>
      <p className={styles.note}>{quarterLabel(quarter)} 지도승무 모두 {total}회</p>
      <ul className={styles.guideList}>
        {list.map((g) => (
          <li key={g.guide} className={styles.guideRow}>
            <span className={styles.guideName}>{g.guide}</span>
            <span className={styles.guideBar}>
              {/* STYLE-EXCEPTION: 횟수에 따라 막대 길이가 달라진다(런타임 값) */}
              <span className={styles.guideFill} style={{ width: `${(g.count / max) * 100}%` }} />
            </span>
            <span className={styles.guideNum}>{g.count}회</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── 기록하기 ── */
function RecordTab({ drivers, rides, meSabun, canDeleteAll, onChanged }: {
  drivers: { s: string; n: string }[];
  rides: JidoRide[];
  meSabun: string;
  canDeleteAll: boolean;
  onChanged: () => void;
}) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ s: string; n: string } | null>(null);
  const [trainNo, setTrainNo] = useState('');
  const [formation, setFormation] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const matches = useMemo(() => {
    const q = query.replace(/\s+/g, '');
    if (!q || picked) return [];
    return drivers.filter((d) => d.n.includes(q) || d.s.startsWith(q)).slice(0, 8);
  }, [query, drivers, picked]);

  const submit = async () => {
    if (!picked || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/jido/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, driverSabun: picked.s, driverName: picked.n, trainNo: trainNo.trim(), formation: formation.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || '저장하지 못했어요. 다시 시도해주세요');
      setMsg({ ok: true, text: `${picked.n} 기관사 ${md(date)} 지도승무를 기록했어요` });
      setPicked(null); setQuery(''); setTrainNo(''); setFormation('');
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '저장하지 못했어요' });
    } finally {
      setSaving(false);
    }
  };

  const mine = rides.filter((r) => r.createdBy === meSabun || r.guideSabun === meSabun).slice(0, 30);
  // 지우기는 한 번 더 묻는다(창을 띄우지 않고 그 줄에서)
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const remove = async (r: JidoRide) => {
    setConfirmId(null);
    const res = await fetch(`/api/jido/rides?id=${r.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: json.message || '지우지 못했어요' }); return; }
    onChanged();
  };

  return (
    <>
      <section className={styles.formCard} aria-label="지도승무 기록하기">
        <h3 className={styles.formTitle}>오늘 지도승무한 기관사</h3>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>날짜</span>
          <input type="date" className={styles.input} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>기관사</span>
          {picked ? (
            <div className={styles.pickedRow}>
              <span className={styles.pickedName}>{picked.n}</span>
              <button type="button" className={styles.linkBtn} onClick={() => { setPicked(null); setQuery(''); }}>다시 고르기</button>
            </div>
          ) : (
            <div className={styles.searchWrap}>
              <Search size={18} className={styles.searchIcon} aria-hidden />
              <input type="search" className={`${styles.input} ${styles.searchInput}`} value={query}
                onChange={(e) => setQuery(e.target.value)} placeholder="이름 또는 사번" aria-label="기관사 이름 또는 사번"
                autoComplete="off" />
            </div>
          )}
          {matches.length > 0 && (
            <ul className={styles.suggest} role="listbox" aria-label="기관사 찾기 결과">
              {matches.map((d) => (
                <li key={d.s}>
                  <button type="button" role="option" aria-selected={false} className={styles.suggestBtn}
                    onClick={() => { setPicked(d); setQuery(''); }}>
                    <span>{d.n}</span><span className={styles.suggestSabun}>{d.s}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.twoCol}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>열차번호 (선택)</span>
            <input inputMode="numeric" className={styles.input} value={trainNo} maxLength={10}
              onChange={(e) => setTrainNo(e.target.value.replace(/\D/g, ''))} placeholder="5072" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>편성 (선택)</span>
            <input inputMode="numeric" className={styles.input} value={formation} maxLength={10}
              onChange={(e) => setFormation(e.target.value.replace(/\D/g, ''))} placeholder="527" />
          </label>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={submit} disabled={!picked || saving}>
          <Check size={18} /> {saving ? '저장하는 중…' : '지도승무 기록하기'}
        </button>
        {msg && <p className={msg.ok ? styles.msgOk : styles.msgBad} role="status">{msg.text}</p>}
        <p className={styles.hint}>담당이 아닌 기관사를 지도해도 그 기관사의 횟수로 올라가요.</p>
      </section>

      <ExcelUpload onDone={onChanged} />

      <h3 className={styles.sectionTitle}>내가 넣은 기록 (이 분기)</h3>
      {mine.length === 0 ? (
        <p className={styles.emptyLine}>아직 없어요.</p>
      ) : (
        <ul className={styles.rideList}>
          {mine.map((r) => (
            <li key={r.id} className={styles.rideRow}>
              <span className={styles.rideDate}>{md(r.date)}</span>
              <span className={styles.rideName}>{r.driverName}</span>
              <span className={styles.rideTrain}>{r.trainNo ? `${r.trainNo}열차` : ''}</span>
              {(canDeleteAll || r.createdBy === meSabun || r.guideSabun === meSabun) && (confirmId === r.id ? (
                <span className={styles.confirmRow}>
                  <button type="button" className={styles.confirmDel} onClick={() => remove(r)}>지우기</button>
                  <button type="button" className={styles.confirmCancel} onClick={() => setConfirmId(null)}>취소</button>
                </span>
              ) : (
                <button type="button" className={styles.delBtn} onClick={() => setConfirmId(r.id)} aria-label={`${r.driverName} 기록 지우기`}>
                  <Trash2 size={16} />
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ── 실적 엑셀 올리기 ── */
function ExcelUpload({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ name: string; result: JidoParseResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    setParsed(null);
    setBusy(true);
    try {
      // 엑셀 읽기 도구는 크다 — 올릴 때만 불러온다
      const XLSX = await import('xlsx');
      const { parseJidoWorkbook } = await import('../lib/parseJidoExcel');
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const result = parseJidoWorkbook(wb, XLSX.utils as never);
      if (result.rides.length === 0 && result.roster.length === 0) {
        setMsg({ ok: false, text: '이 파일에서 지도승무 기록을 찾지 못했어요. 사업소 «지도승무 실적» 엑셀인지 확인해주세요' });
      } else {
        setParsed({ name: file.name, result });
      }
    } catch {
      setMsg({ ok: false, text: '파일을 읽지 못했어요. 엑셀 파일(.xlsx, .xlsm)인지 확인해주세요' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const send = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/jido/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rides: parsed.result.rides, roster: parsed.result.roster }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || '올리지 못했어요. 다시 시도해주세요');
      const extra = [json.managers ? `담당부장 ${json.managers}명` : '', json.focus ? `중점관리 ${json.focus}명` : ''].filter(Boolean).join(' · ');
      setMsg({ ok: true, text: `새 기록 ${json.added}건을 더했어요 (이미 있던 ${json.skipped}건은 건너뜀)${extra ? ` · ${extra} 반영` : ''}` });
      setParsed(null);
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '올리지 못했어요' });
    } finally {
      setBusy(false);
    }
  };

  const range = parsed && parsed.result.rides.length > 0
    ? (() => { const ds = parsed.result.rides.map((r) => r.date).sort(); return `${ds[0]} ~ ${ds[ds.length - 1]}`; })()
    : '';

  return (
    <section className={styles.formCard} aria-label="실적 엑셀 올리기">
      <h3 className={styles.formTitle}><FileSpreadsheet size={18} aria-hidden /> 실적 엑셀 올리기</h3>
      <p className={styles.hint}>사업소 «지도승무 실적» 파일을 그대로 올리면 돼요. 이미 들어 있는 기록은 건너뛰니, 그때까지 모은 파일을 몇 번이고 다시 올려도 겹치지 않아요.</p>
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className={styles.fileInput}
        onChange={(e) => pick(e.target.files?.[0])} aria-label="실적 엑셀 파일 고르기" />
      {!parsed && (
        <button type="button" className={styles.secondaryBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={18} /> {busy ? '읽는 중…' : '엑셀 파일 고르기'}
        </button>
      )}
      {parsed && (
        <div className={styles.preview}>
          <p className={styles.previewName}>{parsed.name}</p>
          <ul className={styles.previewList}>
            {parsed.result.sources.map((s) => <li key={s}>{s}</li>)}
          </ul>
          {range && <p className={styles.previewMeta}>기록 {parsed.result.rides.length}건 · {range}</p>}
          <div className={styles.btnRow}>
            <button type="button" className={styles.primaryBtn} onClick={send} disabled={busy}>
              <Upload size={18} /> {busy ? '올리는 중…' : '이대로 올리기'}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setParsed(null)} disabled={busy}>취소</button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? styles.msgOk : styles.msgBad} role="status">{msg.text}</p>}
    </section>
  );
}

/* ── 공통 조각 ── */
function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
      aria-label={`${total}명 중 ${done}명 완료`}>
      {/* STYLE-EXCEPTION: 완료 비율(런타임 값) */}
      <span className={pct === 100 ? styles.progressFillDone : styles.progressFill} style={{ width: `${pct}%` }} />
    </span>
  );
}

function FilterToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.filterRow}>
      <button type="button" className={`${styles.chip} ${!on ? styles.chipOn : ''}`} onClick={() => onChange(false)} aria-pressed={!on}>모두</button>
      <button type="button" className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={() => onChange(true)} aria-pressed={on}>아직 안 탄 기관사</button>
    </div>
  );
}

/** 이름 옆 색 표시 — «심각 10건»(출입문 사건 수) */
function StageChip({ c }: { c: JidoComplaint }) {
  return (
    <span className={`${styles.stageChip} ${styles[`stage${c.doorStage}`]}`}
      aria-label={`출입문 민원 ${c.doorStage}단계 ${STAGE_NAME[c.doorStage]}, 출입문 사건 ${c.doorEvents}건`}>
      {STAGE_NAME[c.doorStage]}
      {c.doorEvents > 0 && <span className={styles.stageChipNum}>{c.doorEvents}건</span>}
    </span>
  );
}

/** 펼쳤을 때 — 민원 요약과 조치 제안(보고서 5-2쪽) */
function ComplaintDetail({ c }: { c: JidoComplaint }) {
  const types = topTypes(c.types);
  return (
    <div className={`${styles.cpDetail} ${styles[`stage${c.doorStage}`]}`}>
      <p className={styles.cpDetailHead}>
        출입문 민원 {c.doorStage}단계 · {STAGE_NAME[c.doorStage]}
        {c.mgmt && <span className={styles.cpMgmt}>{c.mgmt}</span>}
      </p>
      <StageScale current={c.doorStage} />
      <p className={styles.detailLine}>
        출입문 사건 <strong>{c.doorEvents}건</strong> · 전체 불만 {c.allEvents}건
        {c.injury > 0 && ` · 부상 호소 ${c.injury}건`}
        {c.praise > 0 && ` · 칭찬 ${c.praise}건`}
      </p>
      {types.length > 0 && (
        <p className={styles.detailLine}>많은 유형: {types.map((x) => `${TYPE_LABEL.get(x.key) ?? x.key} ${x.count}`).join(' · ')}</p>
      )}
      {c.mainStations && <p className={styles.detailLine}>주요 역: {c.mainStations}</p>}
      {c.mainTimes && <p className={styles.detailLine}>주요 시간대: {c.mainTimes}</p>}
      {c.otherComplaints && <p className={styles.detailLine}>출입문 외 불만: {c.otherComplaints}</p>}
      <p className={styles.cpAction}>조치(제안): {STAGE_ACTION[c.doorStage]}</p>
    </div>
  );
}

function DriverList({ rows, quarter, cm = EMPTY_MAP, showManager = false }: {
  rows: (DriverStatus & { manager?: string | null })[];
  quarter?: Quarter;
  cm?: ComplaintMap;
  showManager?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0) return <p className={styles.emptyLine}>모두 채웠어요 👍</p>;
  return (
    <ul className={styles.driverList}>
      {rows.map((r) => {
        const isOpen = open === r.sabun;
        const short = r.focus ? focusShort(r.focus.months) : false;
        const c = cm.get(r.sabun);
        const alert = c && c.doorStage >= 5 ? `${styles.driverAlert} ${styles[`stage${c.doorStage}`]}` : '';
        return (
          <li key={r.sabun} className={`${styles.driverItem} ${alert}`}>
            <button type="button" className={styles.driverBtn} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.sabun)}>
              <span className={styles.driverMain}>
                <span className={styles.driverName}>{r.name}</span>
                {c && <StageChip c={c} />}
                {r.focus && <span className={short ? styles.badgeBad : styles.badgeFocus}>중점</span>}
              </span>
              <span className={r.done ? styles.stateDone : styles.stateTodo}>
                {r.done ? <><Check size={14} aria-hidden /> {r.count}회</> : '미실시'}
              </span>
              <span className={styles.driverSub}>
                {showManager && r.manager ? `${r.manager === '담당 미지정' ? r.manager : `${r.manager} 부장`} · ` : ''}
                {r.lastDate ? `최근 ${md(r.lastDate)} · ${r.lastGuide}` : quarter ? `${quarterLabel(quarter)} 기록 없음` : '기록 없음'}
              </span>
              {r.focus && (
                <span className={styles.monthRow} aria-label="중점관리 월별 횟수">
                  {r.focus.months.map((m) => (
                    <span key={m.ym} className={!m.required ? styles.monthOff : m.count > 0 ? styles.monthOk : m.missed ? styles.monthBad : styles.monthTodo}>
                      {monthLabel(m.ym)} {m.required ? `${m.count}회` : '–'}
                    </span>
                  ))}
                </span>
              )}
            </button>
            {isOpen && (
              <div className={styles.driverDetail}>
                {c && <ComplaintDetail c={c} />}
                {r.focus && <p className={styles.detailLine}>중점관리: {r.focus.reason} ({r.focus.from} ~ {r.focus.to})</p>}
                {r.rides.length === 0 ? (
                  <p className={styles.detailLine}>이 분기 지도승무 기록이 없어요.</p>
                ) : (
                  <ul className={styles.detailList}>
                    {r.rides.map((x) => (
                      <li key={x.id}>
                        {md(x.date)} · {x.guideName}
                        {x.trainNo ? ` · ${x.trainNo}열차` : ''}
                        {x.fromStation && x.toStation ? ` · ${x.fromStation.replace(/\(.*?\)/g, '')} → ${x.toStation.replace(/\(.*?\)/g, '')}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
