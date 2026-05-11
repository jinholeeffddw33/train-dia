'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ArrowLeft, Search, X, ChevronUp, ChevronDown, FileText, List } from 'lucide-react';
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
  initialPage?: number;
  onClose: () => void;
}

type FontSize = 'small' | 'normal' | 'large';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  normal: '16px',
  large: '20px',
};

interface TocEntry {
  id: string;
  kind: 'chapter' | 'section';
  num: number;
  title: string;
  page: number;
  startInPage: number;
  matchLength: number;
}

const CHAPTER_RE = /제\s*(\d+)\s*장\s*([\s\S]{1,30}?)(?=\s*제\s*\d+\s*[조절])/g;
const SECTION_RE = /제\s*(\d+)\s*절\s*([\s\S]{1,30}?)(?=\s*제\s*\d+\s*조)/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseToc(pages: RegulationPage[]): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const p of pages) {
    for (const m of p.text.matchAll(CHAPTER_RE)) {
      const num = parseInt(m[1], 10);
      const title = m[2].replace(/\s+/g, '').trim();
      if (!title) continue;
      entries.push({
        id: `ch-${p.page}-${m.index}`,
        kind: 'chapter',
        num,
        title,
        page: p.page,
        startInPage: m.index ?? 0,
        matchLength: m[0].length,
      });
    }
    for (const m of p.text.matchAll(SECTION_RE)) {
      const num = parseInt(m[1], 10);
      const title = m[2].replace(/\s+/g, '').trim();
      if (!title) continue;
      entries.push({
        id: `sec-${p.page}-${m.index}`,
        kind: 'section',
        num,
        title,
        page: p.page,
        startInPage: m.index ?? 0,
        matchLength: m[0].length,
      });
    }
  }
  // 페이지·페이지내 위치 순으로 정렬
  return entries.sort((a, b) => (a.page === b.page ? a.startInPage - b.startInPage : a.page - b.page));
}

export default function RegulationViewer({ title, url, pdfUrl, initialPage, onClose }: Props) {
  const [pages, setPages] = useState<RegulationPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const matchRefs = useRef<(HTMLElement | null)[]>([]);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const tocAnchorRefs = useRef<Map<string, HTMLElement>>(new Map());
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

  // initialPage가 지정되면 해당 페이지로 스크롤
  useEffect(() => {
    if (!initialPage || loading || pages.length === 0) return;
    const el = pageRefs.current.get(initialPage);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }, [initialPage, loading, pages]);

  // 본문 스크롤에 따라 현재 보이는 페이지 추적
  useEffect(() => {
    if (loading || pages.length === 0 || !bodyRef.current) return;
    const root = bodyRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        // 가장 위쪽에 보이는 페이지를 현재 페이지로 인식
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const pageStr = (visible[0].target as HTMLElement).dataset.page;
          if (pageStr) setVisiblePage(parseInt(pageStr, 10));
        }
      },
      { root, threshold: [0, 0.1], rootMargin: '0px 0px -70% 0px' },
    );
    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading, pages]);

  // PDF iframe src에 현재 페이지 hash 추가
  const pdfSrcWithPage = useMemo(() => {
    if (!pdfUrl) return '';
    return `${pdfUrl}#page=${visiblePage}`;
  }, [pdfUrl, visiblePage]);

  // 목차 (장·절) 파싱
  const tocEntries = useMemo(() => parseToc(pages), [pages]);

  // 검색 매치 카운트
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

  // 검색어 변경 시 활성 매치 리셋
  useEffect(() => {
    setActiveMatchIdx(0);
    matchRefs.current = [];
  }, [query]);

  // 활성 매치로 스크롤
  useEffect(() => {
    if (totalMatches === 0) return;
    const el = matchRefs.current[activeMatchIdx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeMatchIdx, totalMatches]);

  // 검색 하이라이트만 적용된 텍스트 렌더
  const renderHighlighted = useCallback((text: string, startIdx: number): ReactNode[] => {
    const q = query.trim();
    if (!q) return [<span key="t">{text}</span>];
    const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
    const parts = text.split(re);
    let local = 0;
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const globalIdx = startIdx + local;
        local += 1;
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

  // 페이지 텍스트를 장·절 마커 기준으로 분할 후 렌더
  const renderPageBody = useCallback((p: RegulationPage, pageStartIdx: number) => {
    const pageToc = tocEntries.filter((e) => e.page === p.page);
    const segments: ReactNode[] = [];
    const q = query.trim();
    const countRe = q ? new RegExp(escapeRegExp(q), 'gi') : null;
    let cursor = 0;
    let localMatchOffset = 0;

    const pushText = (slice: string, key: string) => {
      if (slice.length === 0) return;
      segments.push(
        <span key={key}>{renderHighlighted(slice, pageStartIdx + localMatchOffset)}</span>,
      );
      if (countRe) {
        localMatchOffset += (slice.match(countRe) || []).length;
      }
    };

    for (const toc of pageToc) {
      if (cursor < toc.startInPage) {
        pushText(p.text.slice(cursor, toc.startInPage), `t-${cursor}`);
      }
      const markerText = p.text.slice(toc.startInPage, toc.startInPage + toc.matchLength);
      // 머리말 부분 추출: "제N장" + 공백/줄바꿈 후의 제목까지
      const headerLabel = `제${toc.num}${toc.kind === 'chapter' ? '장' : '절'}`;
      segments.push(
        <span
          key={toc.id}
          ref={(el) => {
            if (el) tocAnchorRefs.current.set(toc.id, el);
            else tocAnchorRefs.current.delete(toc.id);
          }}
          className={toc.kind === 'chapter' ? styles.chapterMark : styles.sectionMark}
          data-toc-id={toc.id}
        >
          <span className={toc.kind === 'chapter' ? styles.chapterBadge : styles.sectionBadge}>{headerLabel}</span>
          <span className={styles.markTitle}>{toc.title}</span>
          {/* 원문에 포함된 raw 마커도 검색 인덱스 유지를 위해 보이지 않게 유지 */}
          <span className={styles.srOnly}>{markerText}</span>
        </span>,
      );
      cursor = toc.startInPage + toc.matchLength;
    }

    if (cursor < p.text.length) {
      pushText(p.text.slice(cursor), `t-${cursor}-end`);
    }

    return segments;
  }, [tocEntries, query, renderHighlighted]);

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

  const scrollToToc = useCallback((tocId: string) => {
    const el = tocAnchorRefs.current.get(tocId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

        {/* 목차 카드 */}
        {!loading && tocEntries.length > 0 && (
          <div className={styles.tocCard}>
            <button
              type="button"
              className={styles.tocToggle}
              onClick={() => setTocOpen((o) => !o)}
              aria-expanded={tocOpen}
            >
              <span className={styles.tocToggleLeft}>
                <List size={18} />
                <span className={styles.tocToggleLabel}>목차</span>
                <span className={styles.tocCount}>{tocEntries.filter((e) => e.kind === 'chapter').length}장 · {tocEntries.filter((e) => e.kind === 'section').length}절</span>
              </span>
              {tocOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {tocOpen && (
              <ul className={styles.tocList}>
                {tocEntries.map((entry) => (
                  <li key={entry.id} className={entry.kind === 'chapter' ? styles.tocItemChapter : styles.tocItemSection}>
                    <button
                      type="button"
                      className={entry.kind === 'chapter' ? styles.tocBtnChapter : styles.tocBtnSection}
                      onClick={() => scrollToToc(entry.id)}
                    >
                      <span className={entry.kind === 'chapter' ? styles.tocBadgeChapter : styles.tocBadgeSection}>
                        제{entry.num}{entry.kind === 'chapter' ? '장' : '절'}
                      </span>
                      <span className={styles.tocTitle}>{entry.title}</span>
                      <span className={styles.tocPage}>p.{entry.page}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && pages.map((p, idx) => {
          const pageStartIdx = perPageMatchCount.slice(0, idx).reduce((a, b) => a + b, 0);
          return (
            <section
              key={p.page}
              ref={(el) => {
                if (el) pageRefs.current.set(p.page, el);
                else pageRefs.current.delete(p.page);
              }}
              data-page={p.page}
              className={styles.page}
            >
              <span className={styles.pageNum}>p. {p.page}</span>
              <div className={styles.pageText}>
                {renderPageBody(p, pageStartIdx)}
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
            <h2 className={styles.title}>{title} (원본 p.{visiblePage})</h2>
          </div>
          <div className={styles.pdfIframeWrap}>
            <iframe src={pdfSrcWithPage} title={`${title} 원본 PDF p.${visiblePage}`} className={styles.pdfIframe} />
          </div>
        </div>
      )}
    </div>
  );
}
