'use client';

/**
 * 등급별 명단 — 관리자(소장·부소장·관리자 계정) 전용. 내 정보 안의 «등급별 명단».
 * 7단계를 심각 → 매우 우수 순으로 묶고, 단계마다 보고서의 조치(제안)와 이름·건수를 한눈에.
 * 이름을 누르면 그 사람의 내 정보로 넘어간다. 명단을 받는 API 도 관리자만 연다.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { STAGE_NAME, STAGE_ACTION, BASIS_LABEL, stageRule, type Stage, type StageBasis } from '../lib/complaintStages';
import type { StageRoster, StageRosterEntry } from '../lib/myInfoTypes';
import styles from './MyInfo.module.css';

const ORDER: Stage[] = [7, 6, 5, 4, 3, 2, 1];
const stageCls = (s: Stage) => styles[`stage${s}`];

export default function StageRosterView({ onPick }: { onPick: (sabun: string) => void }) {
  const [data, setData] = useState<StageRoster | null>(null);
  const [error, setError] = useState('');
  const [basis, setBasis] = useState<StageBasis>('door');
  const [query, setQuery] = useState('');
  // 조치가 필요한 단계(4~7)는 펼쳐 두고, 인원이 많은 1~3단계는 접어 둔다
  const [open, setOpen] = useState<Record<number, boolean>>({ 7: true, 6: true, 5: true, 4: true });

  const load = async () => {
    setError('');
    try {
      const res = await fetch('/api/my-info/roster', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message || '명단을 불러올 수 없어요');
      setData(json as StageRoster);
    } catch (e) {
      setError(e instanceof Error ? e.message : '명단을 불러올 수 없어요');
    }
  };
  useEffect(() => { void load(); }, []);

  const groups = useMemo(() => {
    const q = query.trim();
    const m = new Map<Stage, StageRosterEntry[]>();
    for (const s of ORDER) m.set(s, []);
    for (const p of data?.people ?? []) {
      if (q && !p.name.includes(q)) continue;
      m.get(basis === 'door' ? p.doorStage : p.allStage)!.push(p);
    }
    const ev = (p: StageRosterEntry) => (basis === 'door' ? p.doorEvents : p.allEvents);
    for (const list of m.values()) list.sort((a, b) => ev(b) - ev(a) || b.praise - a.praise || a.name.localeCompare(b.name, 'ko'));
    return m;
  }, [data, basis, query]);

  if (error) {
    return (
      <div className={styles.state}>
        <p>{error}</p>
        <button type="button" className={styles.retryBtn} onClick={() => void load()}>다시 불러오기</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className={styles.state} role="status">
        <span className={styles.spinner} aria-hidden />
        <p>명단을 불러오는 중…</p>
      </div>
    );
  }

  const total = data.people.length;
  const countOf = (s: Stage) => data.people.filter((p) => (basis === 'door' ? p.doorStage : p.allStage) === s).length;

  return (
    <section className={styles.section} aria-label="등급별 명단">
      <h3 className={styles.sectionTitle}>등급별 명단 <span className={styles.dim}>현재 기관사 {total}명</span></h3>

      <div className="z-segment" data-no-press
        // STYLE-EXCEPTION: 세그먼트 선택 위치는 런타임 값(--seg-idx)으로만 표현된다
        style={{ '--seg-count': 2, '--seg-idx': basis === 'door' ? 0 : 1 } as React.CSSProperties}>
        {(['door', 'all'] as StageBasis[]).map((b) => (
          <button key={b} type="button" className={`z-segment-item ${basis === b ? 'is-on' : ''}`}
            aria-pressed={basis === b} onClick={() => setBasis(b)}>
            {b === 'door' ? '출입문 기준' : '전체 불만 기준'}
          </button>
        ))}
      </div>

      {/* 한 줄 분포 — 좋은 단계(왼쪽)부터 */}
      <div className={styles.distBar} aria-label="단계별 인원 분포">
        {([1, 2, 3, 4, 5, 6, 7] as Stage[]).map((s) => {
          const n = countOf(s);
          if (n === 0) return null;
          return (
            <span key={s} className={`${styles.distSeg} ${stageCls(s)}`} title={`${s}단계 ${STAGE_NAME[s]} ${n}명`}
              // STYLE-EXCEPTION: 단계별 인원 비율(런타임 값)
              style={{ flexGrow: n }}>
              {n}
            </span>
          );
        })}
      </div>

      <label className={styles.rosterSearch}>
        <Search size={16} aria-hidden />
        <input
          className={styles.rosterSearchInput}
          placeholder="이름으로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="명단에서 이름 찾기"
        />
      </label>

      {ORDER.map((s) => {
        const list = groups.get(s) ?? [];
        const isOpen = !!open[s] || !!query.trim();
        return (
          <div key={s} className={`${styles.stageGroup} ${stageCls(s)}`}>
            <button type="button" className={styles.stageGroupHead} aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [s]: !o[s] }))}>
              <span className={styles.heroStage}>{s}단계</span>
              <span className={styles.stageGroupName}>{STAGE_NAME[s]}</span>
              <span className={styles.stageGroupCount}>{list.length}명</span>
              {isOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
            </button>
            <p className={styles.stageGroupRule}>
              {BASIS_LABEL[basis]} {stageRule(basis, s)} · <strong>조치</strong> {STAGE_ACTION[s]}
            </p>
            {isOpen && (
              list.length === 0 ? (
                <p className={styles.dim}>해당 없음</p>
              ) : (
                <ul className={styles.nameGrid}>
                  {list.map((p) => {
                    const ev = basis === 'door' ? p.doorEvents : p.allEvents;
                    return (
                      <li key={p.sabun}>
                        <button type="button" className={styles.nameChip} onClick={() => onPick(p.sabun)}>
                          <span className={styles.nameChipName}>{p.name}</span>
                          <span className={styles.nameChipMeta}>
                            {ev > 0 ? `${ev}건` : '0건'}{p.praise > 0 ? ` · 칭찬${p.praise}` : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </div>
        );
      })}
      <p className={styles.footnote}>
        이름을 누르면 그 사람의 내 정보로 넘어가요. 이 명단은 소장·부소장·관리자만 볼 수 있어요.
      </p>
    </section>
  );
}
