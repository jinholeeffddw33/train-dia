'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { P } from '@/data/cycle';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';
import { useDriverStore } from '@/stores/driver';
import styles from '../styles/Home.module.css';

/** 가나다순 정렬된 기관사 목록 (기관사 + 관리자/기타 직원 + 인턴) */
const ALL_PEOPLE = [...P, ...EXTRA_USERS, ...INTERN_USERS];
const SORTED_P = [...ALL_PEOPLE].sort((a, b) => a.n.localeCompare(b.n, 'ko'));
/** I가 '0'인 직원/인턴 구분용 Set */
const EXTRA_SET = new Set(EXTRA_USERS.map((u) => u.s));
const INTERN_SET = new Set(INTERN_USERS.map((u) => u.s));

interface DriverSelectorProps {
  open: boolean;
  onClose: () => void;
  /** 설정에서 열 때: 선택 시 myDriver로 설정하는 오버라이드 */
  onSelectOverride?: (person: import('@/lib/types').Person) => void;
}

export default function DriverSelector({ open, onClose, onSelectOverride }: DriverSelectorProps) {
  const [query, setQuery] = useState('');
  const pick = useDriverStore((s) => s.pick);
  const current = useDriverStore((s) => s.current);
  const inputRef = useRef<HTMLInputElement>(null);

  const setCurrent = useDriverStore((s) => s.setCurrent);
  const myDriver = useDriverStore((s) => s.myDriver);

  const filtered = useMemo(() => {
    if (!query.trim()) return SORTED_P;
    const q = query.trim();
    return SORTED_P.filter(
      (p) => p.n.includes(q) || (p.I !== '0' && p.I.includes(q)) || p.d.includes(q) || (p.s && p.s.includes(q)),
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handlePick = (person: import('@/lib/types').Person) => {
    if (onSelectOverride) {
      onSelectOverride(person);
    } else if (person.I !== '0') {
      pick(person.I);
      onClose();
    } else {
      // EXTRA_USERS (I='0') — setCurrent으로 직접 설정
      setCurrent(person);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="기관사 선택">
      <div className={styles.selectorSearch}>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          className={styles.searchInput}
          placeholder="이름 또는 번호로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
          aria-label="기관사 검색"
          /* 브라우저 자동완성 액세서리 바(비밀번호·카드·주소 흰 띠) 억제 → 목록 가림 방지 */
          name="driver-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
        />
        {query && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setQuery('')}
            aria-label="검색어 지우기"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className={styles.selectorCount}>
        {filtered.length}명
      </div>

      <div className={styles.selectorList}>
        {/* 본인(myDriver)이 있으면 맨 위에 고정 표시 */}
        {myDriver && (
          <button
            type="button"
            className={`${styles.personItem} ${styles.personItemMyDriver} ${current?.n === myDriver.n && current?.s === myDriver.s ? styles.personItemActive : ''}`}
            onClick={() => handlePick(myDriver)}
          >
            <span className={styles.personNum}>★</span>
            <span className={styles.personName}>{myDriver.n}</span>
            <span className={styles.personDia}>내 계정</span>
          </button>
        )}
        {filtered.map((p) => {
          const isIntern = INTERN_SET.has(p.s);
          const isExtra = EXTRA_SET.has(p.s);
          const isMe = myDriver && p.n === myDriver.n && p.s === myDriver.s;
          if (isMe) return null; // 위에 고정 표시했으므로 중복 제거
          const isActive = current?.n === p.n && current?.s === p.s;
          return (
            <button
              key={`${p.I}-${p.s}`}
              type="button"
              className={`${styles.personItem} ${isActive ? styles.personItemActive : ''}`}
              onClick={() => handlePick(p)}
            >
              <span className={styles.personNum}>{p.I === '0' ? '' : p.I}</span>
              <span className={styles.personName}>{p.n}</span>
              <span className={styles.personDia}>{isIntern ? '인턴' : isExtra ? '직원' : p.d}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className={styles.selectorEmpty}>검색 결과가 없어요</p>
        )}
      </div>
    </Modal>
  );
}
