'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCompareStore } from '@/stores/compare';
import { P as P_RAW } from '@/data/cycle';
import { getDia, getType, getDiaDisplay } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import type { Person } from '@/lib/types';
import styles from '../styles/Compare.module.css';

const P_SORTED = [...P_RAW].sort((a, b) => a.n.localeCompare(b.n, 'ko'));

const MIN_COUNT = 2;
const MAX_COUNT = 20;

const GROUP_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'] as const;

export default function CompareTab() {
  const { count, persons, setCount, setPerson, activeGroup, groups, setActiveGroup, setGroupMemo } = useCompareStore();
  const [selectorTarget, setSelectorTarget] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [editingMemo, setEditingMemo] = useState<number | null>(null);

  // 오늘부터 30일간 표시
  const today = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const d = date.getDate();
      const m = date.getMonth() + 1;
      const dow = DOW[date.getDay()];
      const isSun = date.getDay() === 0;
      const isSat = date.getDay() === 6;

      const dias = persons.map((p) => (p ? getDia(p, date) : null));
      const types = dias.map((dia) => (dia ? getType(dia) : null));
      const disps = dias.map((dia) => (dia ? getDiaDisplay(dia) : ''));

      const filledCount = types.filter((t) => t !== null).length;
      const allRest = filledCount >= 2 && types.every((t) => t === null || t === 'rest');

      result.push({ d, m, dow, isSun, isSat, disps, types, allRest, isToday: i === 0 });
    }
    return result;
  }, [persons, today]);

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return P_SORTED;
    const q = searchQuery.trim().toLowerCase();
    return P_SORTED.filter((p) => p.n.toLowerCase().includes(q) || p.I.includes(q));
  }, [searchQuery]);

  const handleSelect = (person: Person) => {
    if (selectorTarget !== null) {
      setPerson(selectorTarget, person);
    }
    setSelectorTarget(null);
    setSearchQuery('');
  };

  const handleModalClose = useCallback(() => {
    setSelectorTarget(null);
    setSearchQuery('');
  }, []);

  const hasAnyPerson = persons.some((p) => p !== null);

  // 동적 grid columns: 날짜(고정) + N명(균등)
  const gridCols = `60px ${'1fr '.repeat(count).trim()}`;

  return (
    <div className={styles.container}>
      {/* 그룹 선택 탭 */}
      <div className={styles.groupTabs}>
        {groups.map((g, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.groupTab} ${activeGroup === i ? styles.groupTabActive : ''}`}
            onClick={() => setActiveGroup(i)}
            onDoubleClick={() => setEditingMemo(i)}
            aria-pressed={activeGroup === i}
          >
            {/* STYLE-EXCEPTION: 그룹별 고유 색상 액센트 — 4개 고정 */}
            <span className={styles.groupDot} style={{ background: GROUP_COLORS[i] }} />
            {editingMemo === i ? (
              <input
                type="text"
                className={styles.groupMemoInput}
                value={g.memo}
                maxLength={10}
                placeholder={`그룹 ${i + 1}`}
                autoFocus
                onChange={(e) => setGroupMemo(i, e.target.value)}
                onBlur={() => setEditingMemo(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingMemo(null); }}
              />
            ) : (
              <span className={styles.groupLabel}>{g.memo || `그룹 ${i + 1}`}</span>
            )}
            {g.persons.some((p) => p !== null) && (
              <span className={styles.groupBadge}>{g.persons.filter((p) => p !== null).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 인원 수 선택 — 스텝퍼 */}
      <div className={styles.countSelector}>
        <span className={styles.countLabel}>비교 인원</span>
        <div className={styles.countStepper}>
          <button
            type="button"
            className={styles.countStepBtn}
            onClick={() => setCount(Math.max(MIN_COUNT, count - 1))}
            disabled={count <= MIN_COUNT}
            aria-label="인원 줄이기"
          >
            <Minus size={16} />
          </button>
          <span className={styles.countValue}>{count}명</span>
          <button
            type="button"
            className={styles.countStepBtn}
            onClick={() => setCount(Math.min(MAX_COUNT, count + 1))}
            disabled={count >= MAX_COUNT}
            aria-label="인원 늘리기"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 기관사 선택 카드 — 가로 스크롤 */}
      <div className={styles.selectorScroll}>
        <div className={styles.selectorRow}>
          {persons.map((person, idx) => (
            <button
              key={idx}
              type="button"
              className={`${styles.personCard} ${person ? styles.personCardFilled : ''}`}
              onClick={() => setSelectorTarget(idx)}
            >
              {person ? (
                <>
                  <span className={styles.personCardName}>{person.n}</span>
                  <span className={styles.personCardNum}>{person.I}번</span>
                </>
              ) : (
                <span className={styles.personCardEmpty}>{idx + 1} 선택</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 기간 표시 */}
      <div className={styles.nav}>
        <span className={styles.navTitle}>
          오늘부터 30일
        </span>
      </div>

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
                <span className={`${styles.tableDate} ${row.isSun ? styles.tableDateSun : ''} ${row.isSat ? styles.tableDateSat : ''} ${row.isToday ? styles.tableDateToday : ''}`}>
                  {row.d === 1 || row.isToday ? `${row.m}/${row.d}` : row.d} ({row.dow})
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

      {/* 기관사 선택 모달 */}
      <Modal
        open={selectorTarget !== null}
        onClose={handleModalClose}
        title={`기관사 ${selectorTarget !== null ? selectorTarget + 1 : ''} 선택`}
      >
        <div className={styles.searchWrap}>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder="이름 또는 번호로 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
            <div className={styles.searchEmpty}>검색 결과가 없습니다</div>
          ) : (
            filteredPersons.map((p) => (
              <button
                key={p.I}
                type="button"
                className={styles.modalItem}
                onClick={() => handleSelect(p)}
              >
                <span className={styles.modalName}>{p.n}</span>
                <span className={styles.modalNum}>{p.I}번</span>
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
