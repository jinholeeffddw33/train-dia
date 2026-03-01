'use client';

import { useState } from 'react';
import { P } from '@/data/cycle';
import { useDriverStore } from '@/stores/driver';
import type { Person } from '@/lib/types';
import styles from './AuthGate.module.css';

/** 기관사 외 인증 허용 인원 (UI에는 미표시, 인증만 가능) */
const EXTRA_USERS: Person[] = [
  { I: '0', d: '', n: '이현구', s: '21711694' },
];

/** 사번으로 인증 가능한 전체 목록 */
const ALL_USERS = [...P, ...EXTRA_USERS];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const current = useDriverStore((s) => s.current);
  const pick = useDriverStore((s) => s.pick);
  const setCurrent = useDriverStore((s) => s.setCurrent);
  const [name, setName] = useState('');
  const [sabun, setSabun] = useState('');
  const [error, setError] = useState('');
  const [matched, setMatched] = useState<Person | null>(null);

  // 이미 인증됨 → 앱 바로 렌더
  if (current) return <>{children}</>;

  const clearError = () => setError('');

  const handleVerify = () => {
    const trimName = name.trim();
    const trimSabun = sabun.trim();

    if (!trimName) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!trimSabun) {
      setError('사번을 입력해주세요');
      return;
    }

    // 이름 + 사번 둘 다 매칭
    const found = ALL_USERS.find(
      (p) => p.n === trimName && p.s === trimSabun,
    );

    if (!found) {
      setError('이름 또는 사번이 일치하지 않습니다');
      setMatched(null);
      return;
    }

    setError('');
    setMatched(found);
  };

  const handleConfirm = () => {
    if (!matched) return;
    // P 배열에 있는 기관사 → pick(id), 그 외 → setCurrent 직접 설정
    const inP = P.find((p) => p.I === matched.I);
    if (inP) {
      pick(inP.I);
    } else {
      setCurrent(matched);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (matched) handleConfirm();
      else handleVerify();
    }
  };

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <div className={styles.icon}>🚇</div>
        <h1 className={styles.title}>기관사 DIA</h1>
        <p className={styles.subtitle}>답십리 승무사업소 · 5호선</p>

        {matched ? (
          <div className={styles.confirm}>
            <p className={styles.matchedName}>{matched.n}</p>
            <p className={styles.matchedHint}>본인이 맞으면 시작하기를 눌러주세요</p>
            <button type="button" className={styles.btn} onClick={handleConfirm}>
              시작하기
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => { setMatched(null); setName(''); setSabun(''); }}
            >
              다시 입력
            </button>
          </div>
        ) : (
          <>
            <div className={styles.inputGroup}>
              <label htmlFor="auth-name" className={styles.label}>이름</label>
              <input
                id="auth-name"
                type="text"
                className={styles.input}
                placeholder="홍길동"
                value={name}
                onChange={(e) => { setName(e.target.value); clearError(); }}
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="name"
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="auth-sabun" className={styles.label}>사번</label>
              <input
                id="auth-sabun"
                type="number"
                inputMode="numeric"
                className={styles.input}
                placeholder="21700000"
                value={sabun}
                onChange={(e) => { setSabun(e.target.value); clearError(); }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="button" className={styles.btn} onClick={handleVerify}>
              확인
            </button>
          </>
        )}
      </div>
    </div>
  );
}
