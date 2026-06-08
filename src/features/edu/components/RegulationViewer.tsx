'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ArrowLeft, Search, X, ChevronUp, ChevronDown, FileText, List } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useAnnotations, type Annotation, type HighlightColor } from '@/hooks/useAnnotations';
import styles from './RegulationViewer.module.css';

/** url에서 regulationId 추출 (예: /data/edu/regulations/operation-rules-search.json → operation-rules) */
function deriveRegulationId(url: string): string {
  return url.match(/regulations\/([^/]+?)(?:-search)?\.(json|pdf)$/)?.[1] ?? url;
}

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

/**
 * 검색용 정규식 생성. PDF 추출 본문은 한글 사이 공백이 제거된 상태로 저장되므로,
 * 사용자가 "열차 운전"으로 띄어 써도 본문의 "열차운전"·"열차\n운전" 모두 매치되도록
 * 검색어 내 공백을 \s* 로 치환한다.
 */
function buildSearchRegex(query: string, capture: boolean): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/).map(escapeRegExp);
  if (tokens.length === 0) return null;
  const pattern = tokens.join('\\s*');
  return new RegExp(capture ? `(${pattern})` : pattern, 'gi');
}

/**
 * 원본 텍스트를 그대로 유지하면서, 구조적 시작점(제N조/장/절·항번호·번호항목·부칙·별표 등)을
 * 기준으로 블록 경계 인덱스를 계산한다. 텍스트 내용은 한 글자도 바뀌지 않으며,
 * 각 블록은 CSS white-space:normal 로 렌더되어 블록 내부 줄바꿈은 자연스럽게 흐른다.
 */
const STRUCTURAL_LINE_START = /^[ \t]*(제\s*\d+\s*[조장절]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]|\d+\s*\.\s|[가나다라마바사아자차카타파하]\s*\.\s|\(\d+\)|【|\[|부\s*칙|별\s*표|◦|○|※|[-─]\s*\d+\s*[-─])/;

/** 라인 경계를 묶어서 블록 [startOffset, endOffset) 목록 반환 */
function computeBlocks(text: string): Array<[number, number]> {
  if (text.length === 0) return [];
  // 각 라인의 [start, endExclusive] 수집 (endExclusive 는 개행 직전 또는 텍스트 끝)
  type Line = { start: number; end: number; blank: boolean; structural: boolean };
  const lines: Line[] = [];
  let lineStart = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      const raw = text.slice(lineStart, i);
      lines.push({
        start: lineStart,
        end: i,
        blank: raw.trim() === '',
        structural: STRUCTURAL_LINE_START.test(raw),
      });
      lineStart = i + 1;
    }
  }
  const blocks: Array<[number, number]> = [];
  let curStart: number | null = null;
  let curEnd: number = 0;
  let prevBlank = true;
  for (const ln of lines) {
    if (ln.blank) {
      if (curStart !== null) {
        blocks.push([curStart, curEnd]);
        curStart = null;
      }
      prevBlank = true;
      continue;
    }
    // 새 블록 시작: 현재 진행 중인 블록이 없거나, 이 라인이 구조적 시작
    if (curStart === null || ln.structural) {
      if (curStart !== null) blocks.push([curStart, curEnd]);
      curStart = ln.start;
      curEnd = ln.end;
    } else {
      curEnd = ln.end;
    }
    prevBlank = false;
  }
  if (curStart !== null) blocks.push([curStart, curEnd]);
  return blocks;
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

  // ── 형광·메모 (localStorage) ──
  const regulationId = deriveRegulationId(url);
  const { annotations, add: addAnnotation, update: updateAnnotation, remove: removeAnnotation } = useAnnotations(regulationId);
  const [selPopover, setSelPopover] = useState<{
    text: string; before: string; after: string; page: number; x: number; y: number;
  } | null>(null);
  const [memoEditor, setMemoEditor] = useState<{ id: string; text: string; memo: string } | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);

  useHistoryBack('regulation-pdf', () => setPdfOpen(false), pdfOpen);
  useHistoryBack('regulation-popover', () => setSelPopover(null), !!selPopover);
  useHistoryBack('regulation-memo', () => setMemoEditor(null), !!memoEditor);
  useHistoryBack('regulation-notes', () => setNotesOpen(false), notesOpen);

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

  // ── 텍스트 선택 캡처 → 형광 팝오버 ──
  useEffect(() => {
    if (loading || pages.length === 0) return;
    const root = bodyRef.current;
    if (!root) return;
    const handleSelectionEnd = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      // 본문 영역 안의 선택만 처리
      if (!root.contains(range.commonAncestorContainer)) return;
      const text = sel.toString().trim();
      if (text.length < 2 || text.length > 300) return; // 너무 짧거나 길면 무시
      // 페이지 식별
      const anchorEl = (range.commonAncestorContainer as Node).nodeType === Node.TEXT_NODE
        ? (range.commonAncestorContainer as Text).parentElement
        : (range.commonAncestorContainer as Element);
      const pageEl = anchorEl?.closest('[data-page]') as HTMLElement | null;
      if (!pageEl) return;
      const page = parseInt(pageEl.dataset.page || '0', 10);
      if (!page) return;
      // 원본 페이지 텍스트에서 위치 찾기 + 컨텍스트 확보
      const pageData = pages.find((p) => p.page === page);
      if (!pageData) return;
      const pos = pageData.text.indexOf(text);
      if (pos < 0) return;
      const before = pageData.text.slice(Math.max(0, pos - 30), pos);
      const after = pageData.text.slice(pos + text.length, pos + text.length + 30);
      // 팝오버 위치
      const rect = range.getBoundingClientRect();
      setSelPopover({
        text, before, after, page,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    };
    document.addEventListener('mouseup', handleSelectionEnd);
    document.addEventListener('touchend', handleSelectionEnd);
    return () => {
      document.removeEventListener('mouseup', handleSelectionEnd);
      document.removeEventListener('touchend', handleSelectionEnd);
    };
  }, [loading, pages]);

  // ── annotations → DOM 적용 (텍스트 노드 walk + wrap) ──
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    // 1) 기존 annotation 마크 제거 (텍스트 노드로 복원)
    root.querySelectorAll(`[data-anno]`).forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      parent.normalize();
    });
    if (annotations.length === 0) return;

    // 2) 각 annotation을 page DOM에서 텍스트 매칭 → wrap
    const byPage = new Map<number, Annotation[]>();
    for (const a of annotations) {
      const arr = byPage.get(a.page) ?? [];
      arr.push(a);
      byPage.set(a.page, arr);
    }

    byPage.forEach((annos, pageNum) => {
      const pageEl = root.querySelector(`[data-page="${pageNum}"]`) as HTMLElement | null;
      if (!pageEl) return;
      for (const anno of annos) {
        // 페이지 DOM의 모든 텍스트 노드를 평탄화
        const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let cursor: Node | null = walker.nextNode();
        let flat = '';
        const offsets: { node: Text; start: number }[] = [];
        while (cursor) {
          const tn = cursor as Text;
          offsets.push({ node: tn, start: flat.length });
          flat += tn.data;
          nodes.push(tn);
          cursor = walker.nextNode();
        }
        // before+text+after 형태로 위치 찾되, 본문 변형 가능성 대비 단계적 매칭
        const needle = anno.text;
        let idx = -1;
        // 1차: full context로 시도
        const fullCtx = anno.before + anno.text + anno.after;
        idx = flat.indexOf(fullCtx);
        if (idx >= 0) idx += anno.before.length;
        // 2차: before만으로
        if (idx < 0) {
          const withBefore = anno.before + anno.text;
          const found = flat.indexOf(withBefore);
          if (found >= 0) idx = found + anno.before.length;
        }
        // 3차: text 단독 (첫 번째 매치)
        if (idx < 0) idx = flat.indexOf(needle);
        if (idx < 0) continue;
        const endIdx = idx + needle.length;

        // 시작/끝 텍스트 노드 + 노드 내 offset 찾기
        const findNodeFor = (pos: number): { node: Text; offset: number } | null => {
          for (let i = 0; i < offsets.length; i++) {
            const o = offsets[i];
            const nodeEnd = o.start + o.node.data.length;
            if (pos >= o.start && pos <= nodeEnd) {
              return { node: o.node, offset: pos - o.start };
            }
          }
          return null;
        };
        const startLoc = findNodeFor(idx);
        const endLoc = findNodeFor(endIdx);
        if (!startLoc || !endLoc) continue;

        // Range 생성 후 surroundContents 시도. 노드 경계 걸치면 splitText로 정리.
        try {
          const range = document.createRange();
          range.setStart(startLoc.node, startLoc.offset);
          range.setEnd(endLoc.node, endLoc.offset);
          const span = document.createElement('span');
          span.setAttribute('data-anno', anno.id);
          span.setAttribute('data-color', anno.color);
          span.className = styles.annotation + ' ' + styles[`annotationColor_${anno.color}`];
          if (anno.memo) span.setAttribute('title', anno.memo);
          // 단일 텍스트 노드 안이면 surroundContents 가능
          if (startLoc.node === endLoc.node) {
            range.surroundContents(span);
          } else {
            // 여러 노드 걸치면 extractContents → append → insert
            const frag = range.extractContents();
            span.appendChild(frag);
            range.insertNode(span);
          }
          // 메모 있으면 작은 인디케이터 추가
          if (anno.memo) {
            const badge = document.createElement('span');
            badge.className = styles.annotationMemoBadge;
            badge.setAttribute('data-anno-badge', anno.id);
            badge.textContent = '📝';
            badge.setAttribute('aria-label', '메모 보기');
            span.appendChild(badge);
          }
        } catch { /* 일부 케이스에서 wrap 실패 — 무시하고 다음 annotation 처리 */ }
      }
    });
  }, [annotations, pages, query, activeMatchIdx, fontSize]);

  // ── 본문 클릭 → annotation 클릭 처리 (메모 보기·편집) ──
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const annoEl = target.closest('[data-anno]') as HTMLElement | null;
      if (!annoEl) return;
      const id = annoEl.dataset.anno;
      if (!id) return;
      const anno = annotations.find((a) => a.id === id);
      if (!anno) return;
      e.stopPropagation();
      setMemoEditor({ id, text: anno.text, memo: anno.memo ?? '' });
      setMemoDraft(anno.memo ?? '');
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [annotations]);

  const handleAddHighlight = useCallback((color: HighlightColor) => {
    if (!selPopover) return;
    addAnnotation({
      page: selPopover.page,
      text: selPopover.text,
      before: selPopover.before,
      after: selPopover.after,
      color,
    });
    setSelPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selPopover, addAnnotation]);

  const handleAddWithMemo = useCallback(() => {
    if (!selPopover) return;
    const item = addAnnotation({
      page: selPopover.page,
      text: selPopover.text,
      before: selPopover.before,
      after: selPopover.after,
      color: 'yellow',
    });
    setMemoEditor({ id: item.id, text: item.text, memo: '' });
    setMemoDraft('');
    setSelPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selPopover, addAnnotation]);

  const handleMemoSave = useCallback(() => {
    if (!memoEditor) return;
    updateAnnotation(memoEditor.id, { memo: memoDraft.trim() });
    setMemoEditor(null);
  }, [memoEditor, memoDraft, updateAnnotation]);

  const handleMemoDelete = useCallback(() => {
    if (!memoEditor) return;
    removeAnnotation(memoEditor.id);
    setMemoEditor(null);
  }, [memoEditor, removeAnnotation]);

  const scrollToAnnotation = useCallback((anno: Annotation) => {
    setNotesOpen(false);
    requestAnimationFrame(() => {
      const root = bodyRef.current;
      if (!root) return;
      const el = root.querySelector(`[data-anno="${anno.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else {
        const pageEl = pageRefs.current.get(anno.page);
        if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  // PDF.js 자체 뷰어로 표시 (iOS Safari 등 모든 브라우저에서 #page=N 정확 동작)
  const pdfSrcWithPage = useMemo(() => {
    if (!pdfUrl) return '';
    const encoded = encodeURIComponent(pdfUrl);
    return `/pdfjs/web/viewer.html?file=${encoded}#page=${visiblePage}`;
  }, [pdfUrl, visiblePage]);

  // 목차 (장·절) 파싱
  const tocEntries = useMemo(() => parseToc(pages), [pages]);

  // 검색 매치 카운트
  const { totalMatches, perPageMatchCount } = useMemo(() => {
    const re = buildSearchRegex(query, false);
    if (!re) return { totalMatches: 0, perPageMatchCount: [] as number[] };
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
    const re = buildSearchRegex(query, true);
    if (!re) return [<span key="t">{text}</span>];
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
    const countRe = buildSearchRegex(query, false);
    let cursor = 0;
    let localMatchOffset = 0;

    // 조문 머리(예: "제39조(열차의운전방향)") 강조용 정규식
    const ARTICLE_RE = /제\s*\d+\s*조(?:\s*\([^)]+\))?/g;

    const renderBlock = (blockText: string, blockKey: string): ReactNode => {
      const children: ReactNode[] = [];
      let bcur = 0;
      let subKey = 0;
      for (const m of blockText.matchAll(ARTICLE_RE)) {
        const mStart = m.index!;
        const mEnd = mStart + m[0].length;
        if (bcur < mStart) {
          const pre = blockText.slice(bcur, mStart);
          children.push(
            <span key={`p-${subKey++}`}>{renderHighlighted(pre, pageStartIdx + localMatchOffset)}</span>,
          );
          if (countRe) localMatchOffset += (pre.match(countRe) || []).length;
        }
        children.push(
          <span key={`a-${subKey++}`} className={styles.articleMark}>
            {renderHighlighted(m[0], pageStartIdx + localMatchOffset)}
          </span>,
        );
        if (countRe) localMatchOffset += (m[0].match(countRe) || []).length;
        bcur = mEnd;
      }
      if (bcur < blockText.length) {
        const tail = blockText.slice(bcur);
        children.push(
          <span key={`p-${subKey++}`}>{renderHighlighted(tail, pageStartIdx + localMatchOffset)}</span>,
        );
        if (countRe) localMatchOffset += (tail.match(countRe) || []).length;
      }
      return <div key={blockKey} className={styles.textBlock}>{children}</div>;
    };

    const pushText = (slice: string, key: string) => {
      if (slice.length === 0) return;
      // 원본 텍스트는 그대로 두고, 구조적 시작점 기준으로 블록 div를 만들어 white-space:normal로 렌더
      const blocks = computeBlocks(slice);
      // 블록 사이의 gap(공백·개행만)은 검색 매칭이 없으므로 무시
      if (blocks.length === 0) {
        // 텍스트는 있는데 비-공백 라인이 없는 경우(드물지만 안전망)
        if (countRe) localMatchOffset += (slice.match(countRe) || []).length;
        return;
      }
      blocks.forEach(([s, e], bi) => {
        const blockText = slice.slice(s, e);
        segments.push(renderBlock(blockText, `${key}-b${bi}`));
      });
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
          {/* 원문에 포함된 raw 마커도 검색 인덱스 유지를 위해 보이지 않게 유지 + 매치 ref 등록 */}
          <span className={styles.srOnly}>{renderHighlighted(markerText, pageStartIdx + localMatchOffset)}</span>
        </span>,
      );
      if (countRe) localMatchOffset += (markerText.match(countRe) || []).length;
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
        <button
          type="button"
          className={styles.pdfBtn}
          onClick={() => setNotesOpen(true)}
          aria-label="내 메모·형광 목록"
        >
          <span>📝</span>
          <span>내 메모 {annotations.length > 0 && `(${annotations.length})`}</span>
        </button>
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

      {/* 형광색 선택 팝오버 (텍스트 선택 직후) */}
      {selPopover && (
        <div
          className={styles.annoPopover}
          /* STYLE-EXCEPTION: 동적 좌표 (브라우저 selection 위치) */
          style={{ left: selPopover.x, top: selPopover.y }}
          role="dialog"
          aria-label="형광 선택"
        >
          <button
            type="button"
            className={`${styles.annoColorBtn} ${styles.annoColorYellow}`}
            onClick={() => handleAddHighlight('yellow')}
            aria-label="노랑 형광"
          />
          <button
            type="button"
            className={`${styles.annoColorBtn} ${styles.annoColorPink}`}
            onClick={() => handleAddHighlight('pink')}
            aria-label="분홍 형광"
          />
          <button
            type="button"
            className={`${styles.annoColorBtn} ${styles.annoColorGreen}`}
            onClick={() => handleAddHighlight('green')}
            aria-label="초록 형광"
          />
          <button
            type="button"
            className={styles.annoMemoBtn}
            onClick={handleAddWithMemo}
            aria-label="형광 + 메모"
          >
            📝
          </button>
          <button
            type="button"
            className={styles.annoCloseBtn}
            onClick={() => setSelPopover(null)}
            aria-label="취소"
          >
            ✕
          </button>
        </div>
      )}

      {/* 메모 작성·편집 모달 */}
      {memoEditor && (
        <div className={styles.memoOverlay} role="dialog" aria-modal="true" aria-label="메모">
          <div className={styles.memoCard}>
            <div className={styles.memoHeader}>
              <h3 className={styles.memoTitle}>메모</h3>
              <button type="button" className={styles.memoClose} onClick={() => setMemoEditor(null)} aria-label="닫기">✕</button>
            </div>
            <p className={styles.memoQuote}>"{memoEditor.text}"</p>
            <textarea
              className={styles.memoTextarea}
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              placeholder="이 형광에 대한 메모를 적어두세요"
              maxLength={500}
              rows={5}
              autoFocus
            />
            <div className={styles.memoActions}>
              <button type="button" className={styles.memoDelete} onClick={handleMemoDelete}>형광·메모 삭제</button>
              <button type="button" className={styles.memoSave} onClick={handleMemoSave}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 내 메모·형광 목록 시트 */}
      {notesOpen && (
        <div className={styles.notesOverlay} role="dialog" aria-modal="true" aria-label="내 메모 목록" onClick={(e) => { if (e.target === e.currentTarget) setNotesOpen(false); }}>
          <div className={styles.notesSheet}>
            <div className={styles.notesHeader}>
              <h3 className={styles.notesTitle}>내 메모 · 형광 <span className={styles.notesCount}>{annotations.length}건</span></h3>
              <button type="button" className={styles.memoClose} onClick={() => setNotesOpen(false)} aria-label="닫기">✕</button>
            </div>
            <div className={styles.notesList}>
              {annotations.length === 0 && (
                <p className={styles.notesEmpty}>본문에서 글자를 선택하면 형광을 칠하거나 메모를 남길 수 있어요</p>
              )}
              {annotations.slice().sort((a, b) => a.page - b.page || a.updatedAt.localeCompare(b.updatedAt)).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.notesItem} ${styles[`notesItemColor_${a.color}`]}`}
                  onClick={() => scrollToAnnotation(a)}
                >
                  <div className={styles.notesItemHead}>
                    <span className={styles.notesItemPage}>p. {a.page}</span>
                    {a.memo && <span className={styles.notesItemMemoBadge}>📝</span>}
                  </div>
                  <p className={styles.notesItemText}>{a.text}</p>
                  {a.memo && <p className={styles.notesItemMemo}>{a.memo}</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
