'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, RotateCw, Newspaper, ArrowUp } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import styles from './NewsOverlay.module.css';

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

/** 발행 시각 → "n분 전" */
function timeAgo(pub: string): string {
  const t = new Date(pub).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return '방금';
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NewsOverlay({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showTop, setShowTop] = useState(false); // 스크롤 내려가면 '맨 위로' 버튼 노출
  const bodyRef = useRef<HTMLDivElement>(null);

  useHistoryBack('news-overlay', onBack);

  const scrollToTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.title}>오늘의 헤드라인 뉴스</h2>
        <button type="button" className={styles.refresh} onClick={load} aria-label="새로고침" disabled={loading}>
          <RotateCw size={18} strokeWidth={2.2} />
        </button>
      </header>

      <div
        className={styles.body}
        ref={bodyRef}
        onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 300)}
      >
        {loading ? (
          <ul className={styles.list} aria-label="불러오는 중">
            {Array.from({ length: 6 }).map((_, i) => <li key={i} className={styles.skeleton} />)}
          </ul>
        ) : error ? (
          <div className={styles.state}>
            <Newspaper size={40} className={styles.stateIcon} aria-hidden />
            <p className={styles.stateText}>뉴스를 불러올 수 없어요.</p>
            <button type="button" className={styles.retryBtn} onClick={load}>
              <RotateCw size={16} /> 다시 시도
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            <Newspaper size={40} className={styles.stateIcon} aria-hidden />
            <p className={styles.stateText}>표시할 뉴스가 없어요.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((it, i) => (
              <li key={`${i}-${it.link}`}>
                <a
                  href={it.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.item}
                >
                  <span className={styles.itemMeta}>
                    <span className={styles.itemSource}>{it.source || '뉴스'}</span>
                    {timeAgo(it.pubDate) && <span className={styles.itemTime}>{timeAgo(it.pubDate)}</span>}
                  </span>
                  <span className={styles.itemTitle}>{it.title}</span>
                  <ExternalLink size={15} className={styles.itemArrow} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className={styles.credit}>구글 뉴스 제공 · 약 10분마다 갱신 · 새 창에서 열려요</p>
      </div>

      {/* 아래로 내려간 뒤 맨 위 기사로 한 번에 올라가기 */}
      {showTop && (
        <button type="button" className={styles.scrollTop} onClick={scrollToTop} aria-label="맨 위로">
          <ArrowUp size={22} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
