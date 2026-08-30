'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Minus, Plus, X, RotateCcw, Pencil, UserPlus, Check } from 'lucide-react';
import { useCompareStore } from '@/stores/compare';
import { getRoster } from '@/data/cycle';
import { getDia, getType, getDiaDisplay, isHoliday } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import EmptyState from '@/components/common/EmptyState';
import { showToast } from '@/components/common/Toast';
import type { Person } from '@/lib/types';
import styles from '../styles/Compare.module.css';

// 파일이 읽히는 순간 굳혀 두면 관리자가 넣은 명부 변경이 반영되지 않는다 → 부를 때 계산
const sortedRoster = () => getRoster().sort((a, b) => a.n.localeCompare(b.n, 'ko'));

const MIN_COUNT = 2;
const MAX_COUNT = 20;

const GROUP_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'] as const;

// 그룹 정규화 — 어떤 입력이 와도 안전한 4그룹 배열로 변환
function safeGroup(g: unknown): { memo: string; count: number; persons: (Person | null)[] } {
  if (!g || typeof g !== 'object') return { memo: '', count: 2, persons: [null, null] };
  const obj = g as { memo?: unknown; count?: unknown; persons?: unknown };
  const memo = typeof obj.memo === 'string' ? obj.memo : '';
  const count = typeof obj.count === 'number' && obj.count >= 2 ? obj.count : 2;
  const persons: (Person | null)[] = Array.isArray(obj.persons)
    ? obj.persons.map((p) => {
        if (!p || typeof p !== 'object') return null;
        const pp = p as Person;
        if (typeof pp.I === 'string' && typeof pp.n === 'string') return pp;
        return null;
      })
    : [null, null];
  return { memo, count, persons };
}

function safeGroupsArray(input: unknown): { memo: string; count: number; persons: (Person | null)[] }[] {
  const arr = Array.isArray(input) ? input : [];
  const normalized = arr.map(safeGroup);
  while (normalized.length < 4) normalized.push({ memo: '', count: 2, persons: [null, null] });
  return normalized.slice(0, 4);
}

export default function CompareTab() {
  const store = useCompareStore();
  // 방어적 destructure — 손상된 persist로 어떤 필드가 undefined여도 안전한 default
  const count = typeof store.count === 'number' && store.count >= 2 ? store.count : 2;
  const year = typeof store.year === 'number' ? store.year : new Date().getFullYear();
  const month = typeof store.month === 'number' ? store.month : new Date().getMonth() + 1;
  const activeGroupRaw = typeof store.activeGroup === 'number' ? store.activeGroup : 0;
  const activeGroup = activeGroupRaw >= 0 && activeGroupRaw < 4 ? activeGroupRaw : 0;
  const groups = useMemo(() => safeGroupsArray(store.groups), [store.groups]);
  // persons는 현재 활성 그룹의 persons 우선, store.persons 보조
  const persons: (Person | null)[] = Array.isArray(store.persons)
    ? store.persons.map((p) => (p && typeof p === 'object' && typeof (p as Person).I === 'string' ? (p as Person) : null))
    : groups[activeGroup].persons;
  const { setCount, setPerson, removePerson, setPersonsBatch, resetGroup, prevMonth, nextMonth, resetMonth, setActiveGroup, setGroupMemo } = store;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [editingMemo, setEditingMemo] = useState<number | null>(null);
  // 닫은 직후 '고스트 클릭'이 기관사 선택을 다시 눌러 모달이 재열림 되는 것 차단(안드로이드).
  const lastCloseRef = useRef(0);

  const today = useMemo(() => new Date(), []);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const rows = useMemo(() => {
    const result = [];

    if (isCurrentMonth) {
      // 현재월: 오늘부터 30일간
      for (let i = 0; i < 30; i++) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const dow = DOW[date.getDay()];
        const isSun = date.getDay() === 0;
        const isSat = date.getDay() === 6;
        const isHol = !isSun && !isSat && isHoliday(date);

        const dias = persons.map((p) => (p ? getDia(p, date) : null));
        const types = dias.map((dia) => (dia ? getType(dia) : null));
        const disps = dias.map((dia) => (dia ? getDiaDisplay(dia) : ''));

        const filledCount = types.filter((t) => t !== null).length;
        const allRest = filledCount >= 2 && types.every((t) => t === null || t === 'rest');

        // 월이 바뀌는 날에 월 표시
        const label = (i === 0 || d === 1) ? `${m}/${d}` : `${d}`;
        result.push({ d, label, dow, isSun, isSat, isHol, disps, types, allRest, isToday: i === 0 });
      }
    } else {
      // 미래/과거 월: 1일~말일
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dow = DOW[date.getDay()];
        const isSun = date.getDay() === 0;
        const isSat = date.getDay() === 6;
        const isHol = !isSun && !isSat && isHoliday(date);

        const dias = persons.map((p) => (p ? getDia(p, date) : null));
        const types = dias.map((dia) => (dia ? getType(dia) : null));
        const disps = dias.map((dia) => (dia ? getDiaDisplay(dia) : ''));

        const filledCount = types.filter((t) => t !== null).length;
        const allRest = filledCount >= 2 && types.every((t) => t === null || t === 'rest');

        result.push({ d, label: `${d}`, dow, isSun, isSat, isHol, disps, types, allRest, isToday: false });
      }
    }
    return result;
  }, [persons, year, month, isCurrentMonth, today]);

  const filteredPersons = useMemo(() => {
    const all = sortedRoster();
    if (!searchQuery.trim()) return all;
    const q = searchQuery.trim().toLowerCase();
    return all.filter((p) => p.n.toLowerCase().includes(q) || p.I.includes(q));
  }, [searchQuery]);

  const openSelector = () => {
    // 방금 닫혔으면(≤500ms) 고스트 클릭에 의한 재열림으로 보고 무시 — "안 닫힘"의 근본 방지.
    if (Date.now() - lastCloseRef.current < 500) return;
    // 현재 선택된 인원을 초기값으로
    setMultiSelected(persons.filter((p): p is Person => p !== null));
    setSearchQuery('');
    setSelectorOpen(true);
  };

  const togglePerson = (person: Person) => {
    const exists = multiSelected.some((p) => p.I === person.I);
    let next: Person[];
    if (exists) {
      next = multiSelected.filter((p) => p.I !== person.I);
    } else {
      if (multiSelected.length >= MAX_COUNT) return;
      next = [...multiSelected, person];
    }
    setMultiSelected(next);
    // 탭 즉시 store에 저장 — X·ESC·배경터치 등 어떤 방식으로 닫아도 선택이 유지되고 새로고침에도 남는다.
    // (예전엔 '선택 완료' 버튼 한 곳에서만 저장 → 그 탭이 눌림효과에 취소되면 저장 자체가 안 됐음)
    setPersonsBatch(next);
  };

  const confirmSelection = () => {
    lastCloseRef.current = Date.now(); // 재열림 가드 타임스탬프
    setPersonsBatch(multiSelected);
    setSelectorOpen(false);
    setSearchQuery('');
    // 성공 피드백 — 선택 결과를 토스트로 알림
    showToast(
      multiSelected.length > 0 ? `${multiSelected.length}명을 선택했어요` : '선택을 모두 비웠어요',
      'success',
    );
  };

  const handleModalClose = useCallback(() => {
    lastCloseRef.current = Date.now(); // 재열림 가드 타임스탬프
    setSelectorOpen(false);
    setSearchQuery('');
  }, []);

  const hasAnyPerson = persons.some((p) => p !== null);

  // 동적 grid columns: 날짜(고정) + N명(균등)
  const gridCols = `60px ${'1fr '.repeat(count).trim()}`;

  return (
    <div className={styles.container}>
      {/* 그룹 선택 탭 — 법① 세그먼트 */}
      <div
        className={`z-segment ${styles.groupTabs}`}
        data-no-press
        style={{ '--seg-count': groups.length, '--seg-idx': activeGroup } as React.CSSProperties}
      >
        {groups.map((g, i) => (
          <button
            key={i}
            type="button"
            className={`z-segment-item ${styles.groupTab} ${activeGroup === i ? 'is-on' : ''}`}
            onClick={() => setActiveGroup(i)}
            aria-pressed={activeGroup === i}
          >
            {/* STYLE-EXCEPTION: 그룹별 고유 색상 액센트 — 4개 고정 */}
            <span className={styles.groupDot} style={{ background: GROUP_COLORS[i] }} />
            <span className={styles.groupLabel}>{g.memo || `그룹 ${i + 1}`}</span>
            {g.persons.some((p) => p !== null) && (
              <span className={styles.groupBadge}>{g.persons.filter((p) => p !== null).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 현재 그룹 메모 편집 + 초기화 */}
      <div className={styles.groupActions}>
        <div className={styles.groupMemoWrap}>
          <Pencil size={14} className={styles.groupMemoIcon} />
          <input
            type="text"
            className={styles.groupMemoInput}
            value={groups[activeGroup].memo}
            maxLength={10}
            placeholder={`그룹 이름 입력 (10자)`}
            onChange={(e) => setGroupMemo(activeGroup, e.target.value)}
          />
        </div>
        {hasAnyPerson && (
          <button
            type="button"
            className={`z-glass-pill ${styles.resetBtn}`}
            onClick={() => { resetGroup(); showToast('그룹을 초기화했어요', 'info'); }}
            aria-label="현재 그룹 초기화"
            data-press
          >
            <RotateCcw size={14} />
            <span>초기화</span>
          </button>
        )}
      </div>

      {/* 선택된 기관사 + 추가 버튼 */}
      <div className={styles.selectedRow}>
        <div className={styles.selectedChips}>
          {persons.filter((p): p is Person => p !== null).map((person) => (
            <span key={person.I} className={styles.selectedChip}>
              {person.n}
              <button type="button" className={styles.chipRemove} aria-label={`${person.n} 제거`} onClick={() => {
                const idx = persons.findIndex((p) => p?.I === person.I);
                if (idx >= 0) removePerson(idx);
              }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <button type="button" className={`z-cta ${styles.addPersonBtn}`} onClick={openSelector} data-press>
          <UserPlus size={16} />
          <span>기관사 선택</span>
        </button>
      </div>

      {/* 월 네비게이션 */}
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={prevMonth}
          disabled={isCurrentMonth}
          aria-label="이전 달"
        >‹</button>
        <button type="button" className={styles.navTitle} onClick={resetMonth}>
          {isCurrentMonth ? `${year}년 ${month}월 (오늘~30일)` : `${year}년 ${month}월`}
        </button>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      {/* 미선택 빈 상태 — 무엇을 해야 하는지 안내 */}
      {!hasAnyPerson && (
        <EmptyState
          icon="👥"
          text="아직 비교할 기관사가 없어요"
          hint="위 기관사 선택 버튼으로 추가해보세요"
        />
      )}

      {/* 비교 테이블 — 가로 스크롤 */}
      {hasAnyPerson && (
        <div className={styles.tableScroll}>
          <div className={styles.table}>
            {/* STYLE-EXCEPTION: 비교 인원 수에 따라 동적 grid columns 필요 */}
            <div className={styles.tableHeader} style={{ gridTemplateColumns: gridCols }}>
              <span className={styles.tableHeaderCell}>날짜</span>
              {persons.map((p, idx) => (
                <span key={idx} className={styles.tableHeaderCell}>{p?.n ?? `${idx + 1}`}</span>
              ))}
            </div>
            {rows.map((row) => (
              <div
                key={row.d}
                className={`${styles.tableRow} ${row.allRest ? styles.tableRowMatch : ''}`}
                /* STYLE-EXCEPTION: 비교 인원 수에 따라 동적 grid columns 필요 */
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className={`${styles.tableDate} ${row.isSun || row.isHol ? styles.tableDateSun : ''} ${row.isSat ? styles.tableDateSat : ''} ${row.isToday ? styles.tableDateToday : ''}`}>
                  {row.label} ({row.dow})
                </span>
                {row.disps.map((disp, idx) => (
                  <span key={idx} className={`${styles.tableDia} ${row.types[idx] ? styles[`cmpType_${row.types[idx]}`] : ''}`}>
                    {disp}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기관사 복수 선택 모달 */}
      <Modal
        open={selectorOpen}
        onClose={handleModalClose}
        title="기관사 선택"
        headerAction={
          /* 저장 = plain 버튼(z-cta 아님). 안드로이드에서 z-cta 버튼 탭이 안 먹던 정황 →
             확실히 먹는 X·목록과 같은 단순 버튼으로. 선택은 탭 즉시 저장되므로 저장/X 어느 쪽이든 유지. */
          <button type="button" className={styles.headerSave} onClick={confirmSelection}>
            저장{multiSelected.length > 0 ? ` ${multiSelected.length}` : ''}
          </button>
        }
      >
        <div className={styles.searchWrap}>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder="이름 또는 번호로 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            enterKeyHint="search"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label="검색어 지우기"
            >
              ✕
            </button>
          )}
        </div>
        <div className={styles.modalList}>
          {filteredPersons.length === 0 ? (
            <div className={styles.searchEmpty}>검색 결과가 없어요</div>
          ) : (
            filteredPersons.map((p) => {
              const isChecked = multiSelected.some((s) => s.I === p.I);
              return (
                <button
                  key={p.I}
                  type="button"
                  className={`${styles.modalItem} ${isChecked ? styles.modalItemChecked : ''}`}
                  onClick={() => togglePerson(p)}
                >
                  <span className={`${styles.checkBox} ${isChecked ? styles.checkBoxOn : ''}`}>
                    {isChecked && <Check size={14} />}
                  </span>
                  <span className={styles.modalName}>{p.n}</span>
                  <span className={styles.modalNum}>{p.I}번</span>
                </button>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}
