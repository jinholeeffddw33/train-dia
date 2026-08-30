'use client';

/**
 * 명부 관리 (관리자 모드)
 *
 * 인원이 바뀔 때 배포 없이 여기서 넣는다. 시행일을 정해 두면 그 날 자동으로 반영된다.
 *
 * 화면 흐름 — 사람을 누르고, 묻는 것에 차례로 답한다
 *   ① 전 직원을 가나다순으로 (기관사 / 내근 / 인턴 세 묶음)
 *   ② 사람을 누르면 → 근무형태를 고른다
 *   ③ 내근 계열이면 → 직급을 고른다 (기관사·인턴은 직급을 쓰지 않으므로 건너뛴다)
 *   ④ 기관사가 되면 → 비어 있는 결원 자리를 고른다
 *      기관사에서 빠지면 → 그 자리가 몇 번 결원이 될지 고른다
 *   ⑤ 시행일을 정하고 넣는다
 *
 * 안전장치 (잘못 넣으면 175명의 근무표가 틀어진다)
 *   · 자리·결원번호를 «고르게만» 한다 — 손으로 치지 않으므로 없는 값을 짚을 수 없다
 *   · 넣기 전에 «누가 무엇이 되는지»를 문장으로 다시 보여준다
 *   · 이미 쓰이는 사번·결원번호는 서버가 막는다
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Search, CalendarClock, Trash2, AlertTriangle, Check, Plus, UserPlus } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { showToast } from '@/components/common/Toast';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { getRoster, P } from '@/data/cycle';
import { syncRosterChanges } from '@/lib/rosterSync';
import { officeUsers, internUsers, rankOf, dutyOf } from '@/lib/auth';
import {
  WORK_TYPE_LABEL, RANK_LABEL, RANK_ORDER, DUTY_LABEL, DUTY_ORDER, activeWorkTypes, isAway,
  type Duty, type RosterChange, type StaffRank, type WorkType,
} from '@/data/rosterChanges';
import type { Person } from '@/lib/types';
import styles from '../styles/More.module.css';

/** 지금 어느 묶음 사람인가 — away = 휴직·병가·공로연수 */
type Group = 'driver' | 'office' | 'intern' | 'away';

interface Member {
  n: string;
  s: string;
  group: Group;
  /** 기관사면 그 자리(P.I) */
  I?: string;
  rank: StaffRank | null;
  duty: Duty | null;
  /** away 묶음에서 무엇으로 쉬는 중인지 */
  away?: WorkType;
  /** 새로 넣는 사람 — 아직 어느 명단에도 없다 */
  isNew?: boolean;
}

const GROUP_LABEL: Record<Group, string> = {
  driver: '기관사', office: '내근', intern: '인턴', away: '휴직 · 병가 · 공로연수',
};

/** 두 단 배치 — 왼쪽 기관사, 오른쪽 내근 → 인턴 → 쉬는 사람(맨 아래) */
const COLUMNS: [string, Group[]][] = [
  ['left', ['driver']],
  ['right', ['office', 'intern', 'away']],
];

/**
 * 고를 수 있는 근무형태.
 *
 * «내근» 이 없는 이유 — 뭉뚱그린 내근 대신 «업무» 를 고르게 한다(업무를 고르면 곧 내근이다).
 * «인턴» 이 없는 이유 — 이미 직원인 사람이 인턴으로 되돌아갈 수는 없다.
 */
const OFFICE_CHIP = 'office' as const;
/** 기관사인 사람에게 보여줄 선택지 */
const LEAVING: WorkType[] = ['office', 'leave', 'sick', 'service', 'resign'];
/** 기관사가 아닌 사람에게 보여줄 선택지 — 기관사로 갈 수 있다 */
const JOINING: WorkType[] = ['driver', 'office', 'leave', 'sick', 'service', 'resign'];
/** 새로 입사한 사람 — 인턴으로 시작하는 경우가 대부분이다 */
const NEW_HIRE: WorkType[] = ['intern', 'driver', 'office'];

/** 칩에 쓸 이름 — 내근은 «업무» 라고 보여준다 */
function chipLabel(w: WorkType): string {
  return w === OFFICE_CHIP ? '업무' : WORK_TYPE_LABEL[w];
}

/** 예약 한 줄을 사람 말로 — 내근이면 «내근» 이 아니라 실제 업무 이름을 쓴다 */
function changeLabel(c: RosterChange): string {
  return c.work === 'office' && c.duty ? DUTY_LABEL[c.duty] : WORK_TYPE_LABEL[c.work];
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 올해면 «8월 30일», 해가 다르면 «2027년 12월 31일» */
function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  const head = y === todayKST().slice(0, 4) ? '' : `${y}년 `;
  return `${head}${parseInt(m)}월 ${parseInt(day)}일`;
}

/** 마지막 글자의 받침 — 0 이면 없음, 8 이면 ㄹ. 한글이 아니면 null */
function jongOf(word: string): number | null {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code < 0 || code > 11171 ? null : code % 28;
}

/** 이름 뒤 «로/으로» — 받침이 없거나 ㄹ 이면 «로» */
function ro(word: string): string {
  const j = jongOf(word);
  return j === null || j === 0 || j === 8 ? '로' : '으로';
}

/** 이름 뒤 «은/는» */
function eun(word: string): string {
  const j = jongOf(word);
  return j === null || j === 0 ? '는' : '은';
}

/** 이름 뒤 «을/를» */
function eul(word: string): string {
  const j = jongOf(word);
  return j === null || j === 0 ? '를' : '을';
}

/** 결원 이름에서 번호 뽑기 — '결원06' → 6 */
function vacancyNoOf(name: string): number | null {
  const m = /^결원(\d+)$/.exec(name);
  return m ? parseInt(m[1], 10) : null;
}

/** 실제 교번을 가진 사람인가 — 이태원(W5)처럼 d='내근' 인 자리는 기관사가 아니다 */
function hasRealDia(p: Person): boolean {
  return !!p.d && p.d !== '내근';
}

/**
 * 교번표에 실제로 있는 결원 번호 전부.
 *
 * 지어낸 번호(결원39 같은 것)를 쓰면 교번표에 없는 결원이 앱에만 생긴다.
 * 그래서 새 결원도 «원래 교번표에 있던 번호» 중에서만 고르게 한다.
 */
const REAL_VACANCY_NOS: number[] = [
  ...new Set(P.map((p) => vacancyNoOf(p.n)).filter((n): n is number => n !== null)),
].sort((a, b) => a - b);

export default function RosterAdmin({ onClose }: { onClose: () => void }) {
  const [changes, setChanges] = useState<RosterChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  /** 고른 사람 — null 이면 목록 화면 */
  const [who, setWho] = useState<Member | null>(null);
  const [work, setWork] = useState<WorkType | null>(null);
  const [rank, setRank] = useState<StaffRank | null>(null);
  const [duty, setDuty] = useState<Duty | null>(null);
  const [slotI, setSlotI] = useState<string | null>(null);
  const [vacancyNo, setVacancyNo] = useState<number | null>(null);
  const [from, setFrom] = useState(todayKST());
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<RosterChange | null>(null);
  /** 새 직원 입력 화면 */
  const [hireOpen, setHireOpen] = useState(false);
  const [hireName, setHireName] = useState('');
  const [hireSabun, setHireSabun] = useState('');
  /** 교번표에 없는 결원 번호를 새로 만드는 중 */
  const [newVacancy, setNewVacancy] = useState(false);
  const [newVacancyNo, setNewVacancyNo] = useState('');

  useEscapeClose(true, () => {
    if (pendingRemove) setPendingRemove(null);
    else if (who) setWho(null);
    else onClose();
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/roster/changes', { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error('예약을 불러오지 못했어요'); return r.json(); })
      .then((d) => setChanges(Array.isArray(d?.changes) ? d.changes : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 전 직원 = 기관사 + 내근 + 인턴, 각 묶음 안에서 가나다순 ──
  const members = useMemo<Member[]>(() => {
    const ko = (a: Member, b: Member) => a.n.localeCompare(b.n, 'ko');
    // 기관사 칸에는 «실제 교번이 있는 사람» 만 올린다.
    //   · 결원은 사람이 아니라 빈 자리다 — 빈 자리는 «갈 자리» 고르는 곳에서만 보여준다
    //   · 이태원(W5)은 교번이 d='내근' 이라 기관사가 아니다. 내근 칸에 이미 있어
    //     걸러내지 않으면 한 사람이 양쪽에 두 번 나온다
    const drivers = getRoster()
      .filter((p) => !/^결원/.test(p.n) && hasRealDia(p))
      .map<Member>((p) => ({ n: p.n, s: p.s ?? '', group: 'driver', I: p.I, rank: null, duty: null }));
    // 휴직·병가·공로연수는 내근 명단에 들어 있지만 «일하는 내근» 과 섞이면 헷갈린다 → 맨 아래 따로
    const nowWork = activeWorkTypes();
    const office: Member[] = [];
    const away: Member[] = [];
    for (const u of officeUsers()) {
      const s = u.s ?? '';
      const w = nowWork.get(s);
      const m: Member = { n: u.n, s, group: 'office', rank: rankOf(s), duty: dutyOf(s) };
      if (w && isAway(w)) away.push({ ...m, group: 'away', away: w, rank: null, duty: null });
      else office.push(m);
    }
    const interns = internUsers().map<Member>((u) => ({ n: u.n, s: u.s ?? '', group: 'intern', rank: null, duty: null }));
    return [...drivers.sort(ko), ...office.sort(ko), ...interns.sort(ko), ...away.sort(ko)];
    // changes 가 바뀌면 명부도 다시 계산해야 한다
  }, [changes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.n.toLowerCase().includes(q));
  }, [members, query]);

  /** 사람별 예약 — 목록에 «예약됨» 표시 */
  const pendingBy = useMemo(() => {
    const today = todayKST();
    const m = new Map<string, RosterChange>();
    for (const c of changes) if (c.from > today) m.set(c.s, c);
    return m;
  }, [changes]);

  /** 지금 비어 있는 결원 자리 — 기관사가 될 사람이 고를 수 있는 자리 */
  const vacantSlots = useMemo(
    () => getRoster().filter((p) => /^결원/.test(p.n)),
    [changes],
  );

  /**
   * 지금 붙일 수 있는 결원 번호 — 교번표에 원래 있던 번호 중 아무도 안 쓰는 것.
   * 사람이 들어와 이름이 놀고 있는 번호(예: 결원04)를 다시 쓰는 것이다.
   */
  const freeVacancyNos = useMemo(() => {
    const used = new Set<number>();
    for (const p of getRoster()) { const no = vacancyNoOf(p.n); if (no !== null) used.add(no); }
    for (const c of changes) { const no = c.vacancyName ? vacancyNoOf(c.vacancyName) : null; if (no !== null) used.add(no); }
    return REAL_VACANCY_NOS.filter((n) => !used.has(n));
  }, [changes]);

  const pick = (m: Member) => {
    setWho(m);
    setWork(null);
    setRank(m.rank);
    setDuty(m.duty);
    setSlotI(null);
    setVacancyNo(null);
    setNewVacancy(false);
    setNewVacancyNo('');
    setFrom(todayKST());
  };

  /** 이미 명부에 있는 사번인가 — 새 직원을 넣기 전에 화면에서 먼저 걸러 준다 */
  const hireDup = useMemo(
    () => (hireSabun.length >= 6 ? members.find((m) => m.s === hireSabun) ?? null : null),
    [hireSabun, members],
  );
  const canHire = hireName.trim().length > 0 && /^\d{6,10}$/.test(hireSabun) && !hireDup;

  const isLeavingDriver = who?.group === 'driver' && work !== null && work !== 'driver';
  // 업무·직급은 내근만 쓴다 — 기관사·인턴은 표시하지 않고, 휴직·병가·공로연수·퇴사도 물을 일이 없다
  const needsDuty = work === 'office';
  const needsRank = work === 'office';
  const needsSlot = work === 'driver' && who?.group !== 'driver';

  /** 새로 만드는 결원 번호 — 이미 쓰는 번호면 안 된다 */
  const newVacancyValid = useMemo(() => {
    const no = parseInt(newVacancyNo, 10);
    if (!Number.isInteger(no) || no < 1 || no > 99) return null;
    const used = new Set<number>();
    for (const p of getRoster()) { const v = vacancyNoOf(p.n); if (v !== null) used.add(v); }
    for (const c of changes) { const v = c.vacancyName ? vacancyNoOf(c.vacancyName) : null; if (v !== null) used.add(v); }
    return used.has(no) ? null : no;
  }, [newVacancyNo, changes]);

  const canSave =
    !!who && !!work &&
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    (!needsDuty || !!duty) &&
    (!needsSlot || !!slotI) &&
    (!isLeavingDriver || vacancyNo !== null) &&
    (!newVacancy || newVacancyValid !== null);

  const save = async () => {
    if (!who || !work || !canSave || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roster/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          from, n: who.n, s: who.s, work,
          ...(who.isNew ? { newHire: true } : {}),
          ...(needsDuty && duty ? { duty } : {}),
          ...(needsRank && rank ? { rank } : {}),
          ...(needsSlot && slotI ? { I: slotI } : {}),
          ...(isLeavingDriver ? { I: who.I, vacancyNo, ...(newVacancy ? { newVacancy: true } : {}) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data?.message ?? '저장하지 못했어요'); return; }
      showToast(`${fmtDate(from)}부터 ${who.n} → ${needsDuty && duty ? DUTY_LABEL[duty] : WORK_TYPE_LABEL[work]}`);
      setWho(null);
      load();
      syncRosterChanges();
    } catch {
      showToast('저장하지 못했어요. 연결을 확인해주세요');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const c = pendingRemove;
    if (!c) return;
    setPendingRemove(null);
    try {
      const res = await fetch(`/api/roster/changes?id=${c.id}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) { showToast(data?.message ?? '취소하지 못했어요'); return; }
      showToast('예약을 취소했어요');
      load();
      syncRosterChanges();
    } catch {
      showToast('취소하지 못했어요. 연결을 확인해주세요');
    }
  };

  const header = (title: string, back?: () => void) => (
    <div className={styles.overlayHeader}>
      <button type="button" className={styles.overlayClose} onClick={back ?? onClose} aria-label="뒤로">
        <ArrowLeft size={20} />
      </button>
      <h2 className={styles.overlayTitle}>{title}</h2>
    </div>
  );

  const confirmDialog = (
    <ConfirmDialog
      open={pendingRemove !== null}
      title="예약 취소"
      message={pendingRemove
        ? <>{fmtDate(pendingRemove.from)}부터 <strong>{pendingRemove.n}</strong>{eul(pendingRemove.n)} {changeLabel(pendingRemove)}{ro(changeLabel(pendingRemove))} 바꾸기로 한 예약을 취소할까요?</>
        : ''}
      confirmLabel="예약 취소하기"
      variant="danger"
      onConfirm={remove}
      onClose={() => setPendingRemove(null)}
    />
  );

  // ── ①-b 새로 입사한 사람 넣기 ──
  if (hireOpen) {
    return (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="새 직원 넣기">
        {header('새 직원 넣기', () => setHireOpen(false))}
        <div className={styles.adminContent}>
          <label className={styles.rosterField}>
            <span className={styles.rosterFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.rosterInput}
              value={hireName}
              maxLength={20}
              placeholder="예) 홍길동"
              onChange={(e) => setHireName(e.target.value)}
            />
          </label>
          <label className={styles.rosterField}>
            <span className={styles.rosterFieldLabel}>사번</span>
            <input
              type="text"
              inputMode="numeric"
              className={styles.rosterInput}
              value={hireSabun}
              maxLength={10}
              placeholder="예) 22601500"
              onChange={(e) => setHireSabun(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          {hireDup && (
            <p className={styles.rosterHintBad}>
              <AlertTriangle size={14} /> 이 사번은 이미 {hireDup.n}입니다
            </p>
          )}
          <p className={styles.rosterStepHint}>넣고 나면 무엇으로 시작할지(인턴·기관사·업무) 고릅니다</p>
          <button
            type="button"
            className={`z-cta ${styles.rosterSave}`}
            data-press
            disabled={!canHire}
            onClick={() => {
              pick({ n: hireName.trim(), s: hireSabun, group: 'intern', rank: null, duty: null, isNew: true });
              setHireOpen(false);
              setHireName('');
              setHireSabun('');
            }}
          >
            다음
          </button>
        </div>
        {confirmDialog}
      </div>
    );
  }

  // ── ② 사람을 고른 뒤: 차례로 답한다 ──
  if (who) {
    // 새 직원은 인턴으로 시작할 수 있다(기존 직원은 인턴으로 되돌아갈 수 없다)
    const options = who.isNew ? NEW_HIRE : who.group === 'driver' ? LEAVING : JOINING;
    return (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="인사 변경">
        {header(who.n, () => setWho(null))}
        <div className={styles.adminContent}>
          <div className={styles.rosterTarget}>
            <span className={styles.rosterTargetName}>{who.n}</span>
            <span className={styles.rosterTargetNow}>
              지금 {GROUP_LABEL[who.group]}
              {who.rank ? ` · ${RANK_LABEL[who.rank]}` : ''}
              {who.I ? ` · ${who.I}번` : ''}
            </span>
          </div>

          {/* 첫째 — 근무형태 */}
          <section className={styles.rosterStep}>
            <h3 className={styles.rosterStepTitle}>어떻게 바뀌나요?</h3>
            <div className={styles.rosterChips}>
              {options.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`${styles.rosterChip} ${work === w ? styles.rosterChipOn : ''}`}
                  data-press
                  onClick={() => {
                    setWork(w); setSlotI(null); setVacancyNo(null);
                    if (w !== 'office') { setRank(null); setDuty(null); }
                  }}
                >
                  {chipLabel(w)}
                </button>
              ))}
            </div>
          </section>

          {/* 둘째 — 업무 («업무» 를 골랐으면 무슨 일인지까지 정해야 한다) */}
          {needsDuty && (
            <section className={styles.rosterStep}>
              <h3 className={styles.rosterStepTitle}>무슨 업무인가요?</h3>
              <div className={styles.rosterChips}>
                {DUTY_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${styles.rosterChip} ${duty === d ? styles.rosterChipOn : ''}`}
                    data-press
                    onClick={() => setDuty(d)}
                  >
                    {DUTY_LABEL[d]}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 셋째 — 직급 (기관사·인턴은 직급을 쓰지 않는다) */}
          {needsRank && (
            <section className={styles.rosterStep}>
              <h3 className={styles.rosterStepTitle}>직급</h3>
              <div className={styles.rosterChips}>
                {RANK_ORDER.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.rosterChip} ${rank === r ? styles.rosterChipOn : ''}`}
                    data-press
                    onClick={() => setRank(rank === r ? null : r)}
                  >
                    {RANK_LABEL[r]}
                  </button>
                ))}
              </div>
              <p className={styles.rosterStepHint}>없으면 안 골라도 됩니다</p>
            </section>
          )}

          {/* 셋째 — 들어갈 자리 */}
          {needsSlot && (
            <section className={styles.rosterStep}>
              <h3 className={styles.rosterStepTitle}>어느 자리로 가나요? (비어 있는 결원)</h3>
              {vacantSlots.length === 0 ? (
                <p className={styles.rosterHintBad}><AlertTriangle size={14} /> 지금 비어 있는 자리가 없어요</p>
              ) : (
                <div className={styles.rosterChips}>
                  {vacantSlots.map((p) => (
                    <button
                      key={p.I}
                      type="button"
                      className={`${styles.rosterChip} ${slotI === p.I ? styles.rosterChipOn : ''}`}
                      data-press
                      onClick={() => setSlotI(p.I)}
                    >
                      {p.I}번 · {p.n}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 셋째(반대) — 비는 자리가 될 결원 번호 */}
          {isLeavingDriver && (
            <section className={styles.rosterStep}>
              <h3 className={styles.rosterStepTitle}>{who.I}번 자리는 몇 번 결원이 되나요?</h3>
              <div className={styles.rosterChips}>
                {freeVacancyNos.map((no) => (
                  <button
                    key={no}
                    type="button"
                    className={`${styles.rosterChip} ${!newVacancy && vacancyNo === no ? styles.rosterChipOn : ''}`}
                    data-press
                    onClick={() => { setNewVacancy(false); setVacancyNo(no); }}
                  >
                    결원{String(no).padStart(2, '0')}
                  </button>
                ))}
                {/* 교번표에 없는 번호를 새로 붙여야 할 때 — 실수로 눌리지 않게 따로 둔다 */}
                <button
                  type="button"
                  className={`${styles.rosterChip} ${newVacancy ? styles.rosterChipOn : ''}`}
                  data-press
                  onClick={() => {
                    setNewVacancy(!newVacancy);
                    setVacancyNo(null);
                    setNewVacancyNo('');
                  }}
                >
                  <Plus size={14} /> 새 번호 만들기
                </button>
              </div>
              {newVacancy && (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    className={styles.rosterInput}
                    value={newVacancyNo}
                    placeholder="예) 29"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      setNewVacancyNo(v);
                      const no = parseInt(v, 10);
                      setVacancyNo(Number.isInteger(no) ? no : null);
                    }}
                  />
                  {newVacancyNo && newVacancyValid === null && (
                    <p className={styles.rosterHintBad}>
                      <AlertTriangle size={14} /> 1~99 사이의, 아직 안 쓰는 번호여야 해요
                    </p>
                  )}
                  {newVacancyValid !== null && (
                    <p className={styles.rosterHintOk}>
                      <Check size={14} /> 결원{String(newVacancyValid).padStart(2, '0')} 을(를) 새로 만듭니다
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {/* 넷째 — 시행일 */}
          {work && (
            <label className={styles.rosterField}>
              <span className={styles.rosterFieldLabel}>시행일 — 이 날부터 바뀝니다</span>
              <input type="date" className={styles.rosterInput} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
          )}

          {canSave && work && (() => {
            // 내근이면 «내근» 대신 실제 업무 이름으로 말한다 — «내근으로 바뀝니다» 는 아무것도 안 알려준다
            const head = needsDuty && duty ? DUTY_LABEL[duty] : WORK_TYPE_LABEL[work];
            const tail = needsRank && rank ? RANK_LABEL[rank] : head;
            return (
              <p className={styles.rosterConfirm}>
                <strong>{fmtDate(from)}</strong>부터 <strong>{who.n}</strong>{eun(who.n)}<br />
                <strong>{head}</strong>
                {needsRank && rank ? ` · ${RANK_LABEL[rank]}` : ''}
                {ro(tail)} 바뀝니다
                {needsSlot && slotI ? ` (${slotI}번 자리로)` : ''}
                {isLeavingDriver && vacancyNo !== null ? ` (${who.I}번 자리는 결원${String(vacancyNo).padStart(2, '0')})` : ''}
              </p>
            );
          })()}

          <button type="button" className={`z-cta ${styles.rosterSave}`} data-press onClick={save} disabled={!canSave || saving}>
            {saving ? '넣는 중…' : '예약 넣기'}
          </button>
        </div>
        {confirmDialog}
      </div>
    );
  }

  // ── ① 전 직원 목록 ──
  const today = todayKST();
  const upcoming = changes.filter((c) => c.from > today);
  const applied = changes.filter((c) => c.from <= today);


  return (
    <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="명부 관리">
      {header('명부 관리')}
      <div className={styles.adminContent}>
        {error && <p className={styles.rosterHintBad}><AlertTriangle size={14} /> {error}</p>}

        {upcoming.length > 0 && (
          <section className={styles.adminSection}>
            <h3 className={styles.adminSectionTitle}>
              <CalendarClock size={15} /> 시행을 기다리는 예약 {upcoming.length}건
            </h3>
            <ul className={styles.rosterPendingList}>
              {upcoming.map((c) => (
                <li key={c.id} className={styles.rosterPendingItem}>
                  <div className={styles.rosterPendingMain}>
                    <span className={styles.rosterPendingDate}>{fmtDate(c.from)}</span>
                    <span className={styles.rosterPendingBody}>
                      {c.n} → <strong>{changeLabel(c)}</strong>
                      {c.rank ? ` · ${RANK_LABEL[c.rank]}` : ''}
                      {c.I ? ` · ${c.I}번` : ''}
                    </span>
                  </div>
                  <button type="button" className={styles.rosterPendingDel} data-press onClick={() => setPendingRemove(c)} aria-label="예약 취소">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>전 직원 {members.length}명 — 바꿀 사람을 누르세요</h3>
          <div className={styles.rosterSearch}>
            <Search size={16} />
            <input
              type="text"
              className={styles.rosterSearchInput}
              value={query}
              placeholder="이름으로 찾기"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.rosterHireBtn}
            data-press
            onClick={() => { setHireName(''); setHireSabun(''); setHireOpen(true); }}
          >
            <UserPlus size={16} /> 새로 입사한 직원 넣기
          </button>
          {loading ? (
            <div className={styles.adminEmpty}>불러오는 중…</div>
          ) : (
            /* 왼쪽 기관사 · 오른쪽 내근(+인턴) — 기관사가 167명이라 한 줄로 세우면 한없이 길어진다 */
            <div className={styles.rosterCols}>
              {COLUMNS.map(([colKey, groups]) => (
                <div key={colKey} className={styles.rosterCol}>
                  {groups.map((g) => {
                    const rows = filtered.filter((m) => m.group === g);
                    if (rows.length === 0) return null;
                    return (
                      <section key={g} className={styles.rosterColGroup}>
                        <p className={styles.rosterGroupHead}>{GROUP_LABEL[g]} {rows.length}명</p>
                        <ul className={styles.rosterList}>
                          {rows.map((m) => {
                            const pending = pendingBy.get(m.s);
                            return (
                              <li key={`${m.group}-${m.s}-${m.n}`}>
                                <button
                                  type="button"
                                  className={`${styles.rosterRowBtn} ${styles[`rosterRow_${m.group}`]}`}
                                  data-press
                                  onClick={() => pick(m)}
                                >
                                  <span className={styles.rosterRowName}>{m.n}</span>
                                  {m.away
                                    ? <span className={styles.rosterRowRank}>{WORK_TYPE_LABEL[m.away]}</span>
                                    : m.duty
                                      ? <span className={styles.rosterRowRank}>{DUTY_LABEL[m.duty]}</span>
                                      : m.rank && <span className={styles.rosterRowRank}>{RANK_LABEL[m.rank]}</span>}
                                  {pending && (
                                    <span className={styles.rosterRowBadge}>{fmtDate(pending.from)} → {changeLabel(pending)}</span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        {applied.length > 0 && (
          <section className={styles.adminSection}>
            <h3 className={styles.adminSectionTitle}><Check size={15} /> 이미 시행된 변경 {applied.length}건</h3>
            <ul className={styles.rosterPendingList}>
              {applied.map((c) => (
                <li key={c.id} className={styles.rosterPendingItem}>
                  <div className={styles.rosterPendingMain}>
                    <span className={styles.rosterPendingDate}>{fmtDate(c.from)}</span>
                    <span className={styles.rosterPendingBody}>
                      {c.n} → <strong>{changeLabel(c)}</strong>
                      {c.rank ? ` · ${RANK_LABEL[c.rank]}` : ''}
                      {c.I ? ` · ${c.I}번` : ''}
                    </span>
                  </div>
                  <button type="button" className={styles.rosterPendingDel} data-press onClick={() => setPendingRemove(c)} aria-label="되돌리기">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
