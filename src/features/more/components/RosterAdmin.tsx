'use client';

/**
 * 명부 관리 (관리자 모드)
 *
 * 인원이 바뀔 때 배포 없이 여기서 넣는다. 시행일을 정해 두면 그 날 자동으로 반영된다.
 *
 * 화면 흐름
 *   ① 명부에서 바뀔 «자리»를 고른다 (순번·교번·현재 사람)
 *   ② 들어올 사람과 시행일을 넣는다
 *   ③ 예약 목록에서 확인 — 시행 전이면 언제든 취소할 수 있다
 *
 * 안전장치 (잘못 넣으면 175명의 근무표가 틀어진다)
 *   · 자리를 «고르게만» 한다 — 순번을 손으로 치지 않으므로 없는 자리를 짚을 수 없다
 *   · 넣기 전에 «누구 자리에 누가»를 문장으로 다시 보여준다
 *   · 사번이 이미 다른 자리에 있으면 서버가 막는다
 *   · 인턴·내근 명단에 있는 사번이면 시행일에 그 명단에서 자동으로 뺀다
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Users, Search, CalendarClock, Trash2, AlertTriangle, Check } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { showToast } from '@/components/common/Toast';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { getRoster, P } from '@/data/cycle';
import { syncRosterChanges } from '@/lib/rosterSync';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';
import type { Person } from '@/lib/types';
import styles from '../styles/More.module.css';

const ADMIN_PIN = '9110';

interface PendingChange {
  id: number;
  from: string;
  I: string;
  n: string;
  s: string;
  replaces: string;
  leaves?: 'intern' | 'extra';
  note?: string;
  by?: string;
}

/** KST 오늘 — 시행 전/후 판단용 */
function todayKST(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 올해면 «8월 30일», 해가 다르면 «2027년 12월 31일» — 연도를 빼면 내년 것과 구별이 안 된다 */
function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  const thisYear = todayKST().slice(0, 4);
  const head = y === thisYear ? '' : `${y}년 `;
  return `${head}${parseInt(m)}월 ${parseInt(day)}일`;
}

/**
 * 이름 뒤에 붙는 «로/으로» 를 고른다.
 * 받침이 없거나 받침이 ㄹ 이면 «로» — "조건희로", "김철로". 그밖엔 «으로» — "김경률으로"가 아니라
 * 받침 ㄹ 도 «로» 이므로 "김경률로". 한글이 아니면 «로» 로 둔다.
 */
function ro(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '로';
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

export default function RosterAdmin({ onClose }: { onClose: () => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [changes, setChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /** 고른 자리 — null 이면 목록 화면 */
  const [slot, setSlot] = useState<Person | null>(null);
  const [query, setQuery] = useState('');

  // 넣을 값
  const [name, setName] = useState('');
  const [sabun, setSabun] = useState('');
  const [from, setFrom] = useState(todayKST());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  /** 지우기 확인을 기다리는 예약 — window.confirm 금지(CLAUDE.md §1.5) */
  const [pendingRemove, setPendingRemove] = useState<PendingChange | null>(null);

  // ESC 는 안쪽부터 닫는다 — 확인창 → 인원 바꾸기 → 명부 관리
  useEscapeClose(true, () => {
    if (pendingRemove) setPendingRemove(null);
    else if (slot) setSlot(null);
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

  useEffect(() => { if (authenticated) load(); }, [authenticated, load]);

  const handlePinSubmit = useCallback(() => {
    if (pin === ADMIN_PIN) { setAuthenticated(true); setPinError(''); }
    else { setPinError('비밀번호가 올바르지 않아요'); setPin(''); }
  }, [pin]);

  /** 지금 시점의 명부 — 이미 시행된 변경이 반영된 상태 */
  const roster = useMemo(() => getRoster(), [changes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((p) => p.n.toLowerCase().includes(q) || p.I.includes(q) || p.d.includes(q) || (p.s ?? '').includes(q));
  }, [roster, query]);

  /** 자리별 예약 — 목록에 «예약됨» 표시 */
  const pendingBySlot = useMemo(() => {
    const today = todayKST();
    const m = new Map<string, PendingChange>();
    for (const c of changes) if (c.from > today) m.set(c.I, c);
    return m;
  }, [changes]);

  /** 사번을 넣으면 인턴·내근 명단에서 이름을 찾아 준다 — 손으로 치는 실수를 줄인다 */
  const known = useMemo(() => {
    if (sabun.length < 6) return null;
    const intern = INTERN_USERS.find((u) => u.s === sabun);
    if (intern) return { n: intern.n, where: '인턴' as const };
    const extra = EXTRA_USERS.find((u) => u.s === sabun);
    if (extra) return { n: extra.n, where: '내근·지도' as const };
    return null;
  }, [sabun]);

  /** 그 사번이 이미 명부에 있으면 미리 막는다 (서버도 막지만 손이 덜 간다) */
  const dupPerson = useMemo(() => {
    if (sabun.length < 6 || !slot) return null;
    return P.find((p) => p.s === sabun && p.I !== slot.I) ?? null;
  }, [sabun, slot]);

  const canSave =
    !!slot && name.trim().length > 0 && /^\d{6,10}$/.test(sabun) && /^\d{4}-\d{2}-\d{2}$/.test(from) && !dupPerson;

  const save = async () => {
    if (!slot || !canSave || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roster/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ from, I: slot.I, n: name.trim(), s: sabun, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data?.message ?? '저장하지 못했어요'); return; }
      showToast(`${fmtDate(from)}부터 ${slot.I}번은 ${name.trim()}`);
      setSlot(null); setName(''); setSabun(''); setNote(''); setFrom(todayKST());
      load();
      syncRosterChanges();   // 지금 이 기기의 명부에도 바로 반영
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

  /** 예약을 지우기 전 한 번 더 묻는다 — 시행된 것을 지우면 명부가 바로 되돌아간다 */
  const confirmDialog = (
    <ConfirmDialog
      open={pendingRemove !== null}
      title="예약 취소"
      message={pendingRemove
        ? <>{fmtDate(pendingRemove.from)}부터 {pendingRemove.I}번 자리를 <strong>{pendingRemove.n}</strong>{ro(pendingRemove.n)} 바꾸기로 한 예약을 취소할까요?</>
        : ''}
      confirmLabel="예약 취소하기"
      variant="danger"
      onConfirm={remove}
      onClose={() => setPendingRemove(null)}
    />
  );

  const header = (title: string, back?: () => void) => (
    <div className={styles.overlayHeader}>
      <button type="button" className={styles.overlayClose} onClick={back ?? onClose} aria-label="뒤로">
        <ArrowLeft size={20} />
      </button>
      <h2 className={styles.overlayTitle}>{title}</h2>
    </div>
  );

  // ── 비밀번호 ──
  if (!authenticated) {
    return (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="명부 관리">
        {header('명부 관리')}
        <div className={styles.adminPinGate}>
          <div className={styles.adminPinIcon}><Users size={40} /></div>
          <p className={styles.adminPinLabel}>관리자 비밀번호를 입력하세요</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className={styles.adminPinInput}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePinSubmit(); }}
            placeholder="****"
            autoFocus
          />
          {pinError && <p className={styles.adminPinError}>{pinError}</p>}
          <button type="button" className={`z-cta ${styles.adminPinSubmit}`} data-press onClick={handlePinSubmit} disabled={pin.length < 4}>
            확인
          </button>
        </div>
      </div>
    );
  }

  // ── ② 자리를 고른 뒤: 새 사람 넣기 ──
  if (slot) {
    return (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="인원 바꾸기">
        {header('인원 바꾸기', () => setSlot(null))}
        <div className={styles.adminContent}>
          <div className={styles.rosterTarget}>
            <span className={styles.rosterTargetNo}>{slot.I}번</span>
            <span className={styles.rosterTargetDia}>교번 {slot.d}</span>
            <span className={styles.rosterTargetName}>{slot.n}</span>
          </div>

          <label className={styles.rosterField}>
            <span className={styles.rosterFieldLabel}>들어올 사람 사번</span>
            <input
              type="text"
              inputMode="numeric"
              className={styles.rosterInput}
              value={sabun}
              maxLength={10}
              placeholder="예) 22600439"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setSabun(v);
                // 인턴·내근 명단에 있으면 이름을 자동으로 채운다
                const hit = INTERN_USERS.find((u) => u.s === v) ?? EXTRA_USERS.find((u) => u.s === v);
                if (hit) setName(hit.n);
              }}
            />
          </label>
          {known && (
            <p className={styles.rosterHintOk}>
              <Check size={14} /> {known.where} 명단의 {known.n} — 시행일에 그 명단에서 자동으로 빠져요
            </p>
          )}
          {dupPerson && (
            <p className={styles.rosterHintBad}>
              <AlertTriangle size={14} /> 이 사번은 이미 {dupPerson.I}번 {dupPerson.n}입니다
            </p>
          )}

          <label className={styles.rosterField}>
            <span className={styles.rosterFieldLabel}>이름</span>
            <input
              type="text"
              className={styles.rosterInput}
              value={name}
              maxLength={20}
              placeholder="예) 김경률"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className={styles.rosterField}>
            <span className={styles.rosterFieldLabel}>시행일 — 이 날부터 바뀝니다</span>
            <input
              type="date"
              className={styles.rosterInput}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>

          <label className={styles.rosterField}>
            <span className={styles.rosterFieldLabel}>메모 (안 써도 됩니다)</span>
            <input
              type="text"
              className={styles.rosterInput}
              value={note}
              maxLength={200}
              placeholder="예) 인턴 정식 임용"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          {canSave && (
            <p className={styles.rosterConfirm}>
              <strong>{fmtDate(from)}</strong>부터 <strong>{slot.I}번</strong> 자리(교번 {slot.d})가<br />
              {slot.n} → <strong>{name.trim()}</strong>{ro(name)} 바뀝니다
            </p>
          )}

          <button type="button" className={`z-cta ${styles.rosterSave}`} data-press onClick={save} disabled={!canSave || saving}>
            {saving ? '넣는 중…' : '예약 넣기'}
          </button>
        </div>
      </div>
    );
  }

  // ── ① 명부 목록 + 예약 목록 ──
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
                      {c.I}번 {c.replaces} → <strong>{c.n}</strong>
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
          <h3 className={styles.adminSectionTitle}>
            <Users size={15} /> 명부 {roster.length}명 — 바꿀 자리를 누르세요
          </h3>
          <div className={styles.rosterSearch}>
            <Search size={16} />
            <input
              type="text"
              className={styles.rosterSearchInput}
              value={query}
              placeholder="이름·순번·교번·사번"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <div className={styles.adminEmpty}>불러오는 중…</div>
          ) : (
            <ul className={styles.rosterList}>
              {filtered.map((p) => {
                const pending = pendingBySlot.get(p.I);
                return (
                  <li key={p.I}>
                    <button
                      type="button"
                      className={styles.rosterRowBtn}
                      data-press
                      onClick={() => { setSlot(p); setName(''); setSabun(''); setNote(''); setFrom(todayKST()); }}
                    >
                      <span className={styles.rosterRowNo}>{p.I}</span>
                      <span className={styles.rosterRowDia}>{p.d}</span>
                      <span className={styles.rosterRowName}>{p.n}</span>
                      {pending
                        ? <span className={styles.rosterRowBadge}>{fmtDate(pending.from)} → {pending.n}</span>
                        : <span className={styles.rosterRowSabun}>{p.s}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {applied.length > 0 && (
          <section className={styles.adminSection}>
            <h3 className={styles.adminSectionTitle}>이미 시행된 변경 {applied.length}건</h3>
            <ul className={styles.rosterPendingList}>
              {applied.map((c) => (
                <li key={c.id} className={styles.rosterPendingItem}>
                  <div className={styles.rosterPendingMain}>
                    <span className={styles.rosterPendingDate}>{fmtDate(c.from)}</span>
                    <span className={styles.rosterPendingBody}>
                      {c.I}번 {c.replaces} → <strong>{c.n}</strong>
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
