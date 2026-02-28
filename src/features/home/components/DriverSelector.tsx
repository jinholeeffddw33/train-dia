'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { P } from '@/data/cycle';
import { useDriverStore } from '@/stores/driver';
import styles from '../styles/Home.module.css';

/** 가나다순 정렬된 기관사 목록 */
const SORTED_P = [...P].sort((a, b) => a.n.localeCompare(b.n, 'ko'));

interface DriverSelectorProps {
  open: boolean;
  onClose: () => void;
}

export default function DriverSelector({ open, onClose }: DriverSelectorProps) {
  const [query, setQuery] = useState('');
  const pick = useDriverStore((s) => s.pick);
  const current = useDriverStore((s) => s.current);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return SORTED_P;
    const q = query.trim();
    return SORTED_P.filter(
      (p) => p.n.includes(q) || p.I.includes(q) || p.d.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handlePick = (id: string) => {
    pick(id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="기관사 선택">
      <div className={styles.selectorSearch}>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="이름 또는 번호로 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="기관사 검색"
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
        {filtered.map((p) => (
          <button
            key={p.I}
            type="button"
            className={`${styles.personItem} ${current?.I === p.I ? styles.personItemActive : ''}`}
            onClick={() => handlePick(p.I)}
          >
            <span className={styles.personNum}>{p.I}</span>
            <span className={styles.personName}>{p.n}</span>
            <span className={styles.personDia}>{p.d}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className={styles.selectorEmpty}>검색 결과가 없어요</p>
        )}
      </div>
    </Modal>
  );
}
