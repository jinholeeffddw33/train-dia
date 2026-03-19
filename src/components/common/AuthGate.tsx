'use client';

import { useState } from 'react';
import { P } from '@/data/cycle';
import { useDriverStore } from '@/stores/driver';
import type { Person } from '@/lib/types';
import styles from './AuthGate.module.css';

/** 기관사 외 인증 허용 인원 (UI에는 미표시, 인증만 가능) */
const EXTRA_USERS: Person[] = [
  { I: '0', d: '', n: '이현구', s: '21711694' },
  { I: '0', d: '', n: '강병우', s: '21714898' },
  { I: '0', d: '', n: '박성아', s: '21714940' },
  { I: '0', d: '', n: '석영훈', s: '21715437' },
  { I: '0', d: '', n: '김준홍', s: '21715494' },
  { I: '0', d: '', n: '허금녀', s: '21715538' },
  { I: '0', d: '', n: '김민정', s: '21715676' },
  { I: '0', d: '', n: '최창욱', s: '21715684' },
  { I: '0', d: '', n: '이민우', s: '21716991' },
  { I: '0', d: '', n: '한태환', s: '21713547' },
  { I: '0', d: '', n: '반헌준', s: '21713554' },
  { I: '0', d: '', n: '신승헌', s: '21713568' },
  { I: '0', d: '', n: '정광구', s: '21714013' },
  { I: '0', d: '', n: '정용식', s: '21714357' },
  { I: '0', d: '', n: '이수윤', s: '21714586' },
  { I: '0', d: '', n: '김다솜', s: '22000103' },
  { I: '0', d: '', n: '하도현', s: '22000834' },
  { I: '0', d: '', n: '오현창', s: '22000850' },
  { I: '0', d: '', n: '김현진', s: '22200209' },
  { I: '0', d: '', n: '황선호', s: '21717719' },
  { I: '0', d: '', n: '이지훈', s: '21900305' },
  { I: '0', d: '', n: '장진수', s: '21707096' },
  { I: '0', d: '', n: '김봉철', s: '21707406' },
  { I: '0', d: '', n: '김창환', s: '21707420' },
  { I: '0', d: '', n: '김성준A', s: '21703825' },
  { I: '0', d: '', n: '안성숙', s: '21704630' },
  { I: '0', d: '', n: '신형식', s: '21704784' },
  { I: '0', d: '', n: '최승곤', s: '21706206' },
  { I: '0', d: '', n: '이병홍', s: '21706208' },
  { I: '0', d: '', n: '윤경일', s: '21706306' },
  { I: '0', d: '', n: '현덕일', s: '21706327' },
  { I: '0', d: '', n: '김대환', s: '21706363' },
  { I: '0', d: '', n: '김재범', s: '21707084' },
  { I: '0', d: '', n: '조재홍', s: '21709373' },
  { I: '0', d: '', n: '이승훈', s: '21711443' },
  { I: '0', d: '', n: '박종길', s: '21711719' },
  { I: '0', d: '', n: '김건래', s: '21711811' },
  { I: '0', d: '', n: '윤성애', s: '21712601' },
  { I: '0', d: '', n: '조효진', s: '21709378' },
  { I: '0', d: '', n: '신제윤', s: '21709575' },
  { I: '0', d: '', n: '김진완', s: '21709589' },
  { I: '0', d: '', n: '김윤수', s: '21709608' },
  { I: '0', d: '', n: '정성한', s: '21709635' },
  { I: '0', d: '', n: '조옥란', s: '21709649' },
  { I: '0', d: '', n: '이동복', s: '21710720' },
  { I: '0', d: '', n: '이선길', s: '21711197' },
  { I: '0', d: '', n: '전동규', s: '21711304' },
  { I: '0', d: '', n: '박용덕', s: '21711438' },
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
