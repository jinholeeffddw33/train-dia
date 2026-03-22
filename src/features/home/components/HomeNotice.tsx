'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import styles from '../styles/Home.module.css';

const NOTICE_ID = 'dia-update-2026-03-23';
const NOTICE_START = new Date('2026-03-22T15:00:00+09:00').getTime();
const NOTICE_EXPIRE = NOTICE_START + 72 * 60 * 60 * 1000;

export default function HomeNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const now = Date.now();
    if (now >= NOTICE_START && now < NOTICE_EXPIRE) {
      const dismissed = localStorage.getItem(`notice-dismissed-${NOTICE_ID}`);
      if (!dismissed) setShow(true);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(`notice-dismissed-${NOTICE_ID}`, 'true');
  };

  if (!show) return null;

  return (
    <div className={styles.homeNotice}>
      <div className={styles.homeNoticeGlow} />
      <div className={styles.homeNoticeContent}>
        <div className={styles.homeNoticeIconWrap}>
          <Sparkles size={24} />
        </div>
        <div className={styles.homeNoticeBody}>
          <strong className={styles.homeNoticeTitle}>3/23 다이아 개정 적용 완료</strong>
          <p className={styles.homeNoticeDesc}>
            다이아가 새롭게 업데이트되었습니다.{'\n'}
            교번 탭의 <em>교번변경</em> 기능도 추가되었으니 활용해보세요!
          </p>
        </div>
        <button type="button" className={styles.homeNoticeClose} onClick={dismiss} aria-label="공지 닫기">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
