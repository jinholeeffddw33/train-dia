'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Search, X, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import styles from './RegulationViewer.module.css';

interface RegulationPage {
  page: number;
  text: string;
}

interface Props {
  title: string;
  url: string;
  pdfUrl?: string;
  onClose: () => void;
}

type FontSize = 'small' | 'normal' | 'large';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  normal: '16px',
  large: '20px',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function RegulationViewer({ title, url, pdfUrl, onClose }: Props) {
  const [pages, setPages] = useState<RegulationPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [pdfOpen, setPdfOpen] = useState(false);
  const matchRefs = useRef<(HTMLElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useHistoryBack('regulation-pdf', () => setPdfOpen(false), pdfOpen);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data: RegulationPage[]) => {
        if (!active) return;
        setPages(data);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => { active = false; };
  }, [url]);

  // Pre-compute total match count and per-page positions
  const { totalMatches, perPageMatchCount } = useMemo(() => {
    const q = query.trim();
    if (!q) return { totalMatches: 0, perPageMatchCount: [] as number[] };
    const re = new RegExp(escapeRegExp(q), 'gi');
    let total = 0;
    const perPage = pages.map((p) => {
      const cnt = (p.text.match(re) || []).length;
      total += cnt;
      return cnt;
    });
    return { totalMatches: total, perPageMatchCount: perPage };
  }, [query, pages]);

  // Reset active match when query changes
  useEffect(() => {
    setActiveMatchIdx(0);
    matchRefs.current = [];
  }, [query]);

  // Scroll active match into view
  useEffect(() => {
    if (totalMatches === 0) return;
    const el = matchRefs.current[activeMatchIdx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeMatchIdx, totalMatches]);

  const renderPageText = useCallback((text: string, pageStartIdx: number) => {
    const q = query.trim();
    if (!q) return <span>{text}</span>;
    const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
    const parts = text.split(re);
    let localMatchIdx = 0;
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const globalIdx = pageStartIdx + localMatchIdx;
        localMatchIdx += 1;
        const isActive = globalIdx === activeMatchIdx;
        return (
          <mark
            key={i}
            ref={(el) => { matchRefs.current[globalIdx] = el; }}
            className={`${styles.highlight} ${isActive ? styles.highlightActive : ''}`}
          >
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [query, activeMatchIdx]);

  const handlePrev = useCallback(() => {
    setActiveMatchIdx((prev) => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  const handleNext = useCallback(() => {
    setActiveMatchIdx((prev) => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const handleSearchKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && totalMatches > 0) {
      e.preventDefault();
      handleNext();
    }
  }, [totalMatches, handleNext]);

  const computedFontSize = FONT_SIZE_MAP[fontSize];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{title}</h2>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="단어 검색 (예: 비상, 기관사)"
            aria-label="규정 본문 검색"
          />
          {query && (
            <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="검색어 지우기">
              <X size={16} />
            </button>
          )}
        </div>
        {query && (
          <>
            <span className={styles.matchInfo}>
              {totalMatches > 0 ? `${activeMatchIdx + 1} / ${totalMatches}` : '0 / 0'}
            </span>
            <button
              type="button"
              className={styles.navBtn}
              onClick={handlePrev}
              disabled={totalMatches === 0}
              aria-label="이전 결과"
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={handleNext}
              disabled={totalMatches === 0}
              aria-label="다음 결과"
            >
              <ChevronDown size={18} />
            </button>
          </>
        )}
      </div>

      <div className={styles.fontControls}>
        <span className={styles.fontLabel}>글자</span>
        <button
          type="button"
          className={`${styles.fontBtn} ${fontSize === 'small' ? styles.fontBtnActive : ''}`}
          onClick={() => setFontSize('small')}
        >
          작게
        </button>
        <button
          type="button"
          className={`${styles.fontBtn} ${fontSize === 'normal' ? styles.fontBtnActive : ''}`}
          onClick={() => setFontSize('normal')}
        >
          보통
        </button>
        <button
          type="button"
          className={`${styles.fontBtn} ${fontSize === 'large' ? styles.fontBtnActive : ''}`}
          onClick={() => setFontSize('large')}
        >
          크게
        </button>
        {pdfUrl && (
          <button type="button" className={styles.pdfBtn} onClick={() => setPdfOpen(true)}>
            <FileText size={14} />
            <span>원본 PDF</span>
          </button>
        )}
      </div>

      {/* STYLE-EXCEPTION: 사용자 선택 폰트 크기를 CSS 변수로 전달 (런타임 값) */}
      <div ref={bodyRef} className={styles.body} style={{ ['--reg-font-size' as string]: computedFontSize }}>
        {loading && <div className={styles.loading}>불러오는 중...</div>}
        {!loading && pages.length === 0 && (
          <div className={styles.emptyState}>본문을 불러올 수 없어요</div>
        )}
        {!loading && pages.map((p, idx) => {
          const pageStartIdx = perPageMatchCount.slice(0, idx).reduce((a, b) => a + b, 0);
          return (
            <section key={p.page} className={styles.page}>
              <span className={styles.pageNum}>p. {p.page}</span>
              <div className={styles.pageText}>
                {renderPageText(p.text, pageStartIdx)}
              </div>
            </section>
          );
        })}
      </div>

      {pdfOpen && pdfUrl && (
        <div className={styles.pdfOverlay} role="dialog" aria-modal="true" aria-label={`${title} 원본 PDF`}>
          <div className={styles.pdfHeader}>
            <button type="button" className={styles.backBtn} onClick={() => setPdfOpen(false)} aria-label="닫기">
              <ArrowLeft size={20} />
            </button>
            <h2 className={styles.title}>{title} (원본)</h2>
          </div>
          <div className={styles.pdfIframeWrap}>
            <iframe src={pdfUrl} title={`${title} 원본 PDF`} className={styles.pdfIframe} />
          </div>
        </div>
      )}
    </div>
  );
}
