'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ArrowLeft, Search, X, ChevronUp, ChevronDown, FileText, List, ListTree, Download, Highlighter } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useAnnotations, type Annotation, type HighlightColor } from '@/hooks/useAnnotations';
import { useFontSizeStore } from '@/stores/fontSize';
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
  /** 문제 해설에서 추출한 조문 번호 — 지정 시 해당 "제N조"로 정확히 스크롤 */
  initialArticle?: number;
  onClose: () => void;
}

type FontSize = 'small' | 'normal' | 'large' | 'xlarge';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  normal: '16px',
  large: '20px',
  xlarge: '24px',
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

export default function RegulationViewer({ title, url, pdfUrl, initialPage, initialArticle, onClose }: Props) {
  const [pages, setPages] = useState<RegulationPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  // 전역 글자 크기 설정을 초기값으로 시드 — "크게" 유저가 열 때마다 재조절하던 문제 해소
  const globalFontSize = useFontSizeStore((s) => s.size);
  const [fontSize, setFontSize] = useState<FontSize>(globalFontSize);
  const [pdfOpen, setPdfOpen] = useState(false);
  /**
   * 형광펜 모드 — 켜면 본문의 네이티브 텍스트 선택을 끈다.
   * 끌어서 선택하면 브라우저가 '복사·공유·모두 선택·웹 검색' 막대를 먼저 띄우는데,
   * 이건 OS가 그리는 것이라 웹에서 막을 방법이 없다. 선택 자체를 없애고
   * '문장을 탭하면 그 문장이 잡히는' 방식으로 바꾼다.
   */
  const [markMode, setMarkMode] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const matchRefs = useRef<(HTMLElement | null)[]>([]);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const tocAnchorRefs = useRef<Map<string, HTMLElement>>(new Map());
  const bodyRef = useRef<HTMLDivElement>(null);
  const tocCardRef = useRef<HTMLDivElement>(null);
  const [showTocFab, setShowTocFab] = useState(false);

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

  // ESC — 최상단 오버레이부터 역순으로 닫기 (메모목록 > 메모 > 형광 팝오버 > PDF > 뷰어 본체)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (notesOpen) setNotesOpen(false);
      else if (memoEditor) setMemoEditor(null);
      else if (selPopover) setSelPopover(null);
      else if (pdfOpen) setPdfOpen(false);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notesOpen, memoEditor, selPopover, pdfOpen, onClose]);

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

  // 진입 위치 스크롤 — 조문(제N조)이 지정되면 그 조문으로, 없으면 페이지 최상단으로
  useEffect(() => {
    if (loading || pages.length === 0) return;
    const scrollToEl = (el: HTMLElement) => {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }));
    };
    // 1) 조문 우선 — 같은 페이지의 조문을 우선 선택(부칙 등 중복 방어), 없으면 첫 매치
    if (initialArticle && bodyRef.current) {
      const marks = Array.from(
        bodyRef.current.querySelectorAll<HTMLElement>(`[data-article="${initialArticle}"]`),
      );
      if (marks.length > 0) {
        let target = marks[0];
        if (initialPage) {
          const onPage = marks.find(
            (m) => m.closest('[data-page]')?.getAttribute('data-page') === String(initialPage),
          );
          if (onPage) target = onPage;
        }
        scrollToEl(target);
        return;
      }
    }
    // 2) 폴백 — 페이지 최상단
    if (initialPage) {
      const el = pageRefs.current.get(initialPage);
      if (el) scrollToEl(el);
    }
  }, [initialArticle, initialPage, loading, pages]);

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

  // 목차로 즉시 스크롤
  const scrollToTopToc = useCallback(() => {
    const el = tocCardRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 접혀 있던 경우 자동으로 펼침
      if (!tocOpen) setTocOpen(true);
    }
  }, [tocOpen]);

  /**
   * 문장 하나를 팝오버 대상으로 잡는다. (형광펜 모드 · 탭)
   * 페이지 원문에서 offset 을 기준으로 문장 경계까지 넓힌다 —
   * 마침표/줄바꿈/호(①②) 앞뒤가 경계다.
   */
  const pickSentenceAt = useCallback((clientX: number, clientY: number) => {
    const root = bodyRef.current;
    if (!root) return;
    // 탭 지점의 문자 위치
    type WithCaret = Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const doc = document as WithCaret;
    let node: Node | null = null;
    let offset = 0;
    if (doc.caretRangeFromPoint) {
      const r = doc.caretRangeFromPoint(clientX, clientY);
      if (r) { node = r.startContainer; offset = r.startOffset; }
    } else if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(clientX, clientY);
      if (p) { node = p.offsetNode; offset = p.offset; }
    }
    if (!node || !root.contains(node)) return;

    const el = node.nodeType === Node.TEXT_NODE ? (node as Text).parentElement : (node as Element);
    const pageEl = el?.closest('[data-page]') as HTMLElement | null;
    if (!pageEl) return;
    const page = parseInt(pageEl.dataset.page || '0', 10);
    const pageData = pages.find((p) => p.page === page);
    if (!page || !pageData) return;

    // 탭한 텍스트 노드의 내용으로 페이지 원문에서의 대략 위치를 찾는다
    const nodeText = node.nodeType === Node.TEXT_NODE ? (node as Text).data : (el?.textContent ?? '');
    const probe = nodeText.slice(Math.max(0, offset - 12), offset + 12).trim();
    if (probe.length < 3) return;
    const base = pageData.text.indexOf(probe);
    if (base < 0) return;
    const at = base + Math.min(12, offset);

    // 문장 경계까지 확장
    const src = pageData.text;
    const isEnd = (i: number) => i >= 0 && i < src.length && /[.\n]/.test(src[i]);
    let s = at;
    while (s > 0 && !isEnd(s - 1)) s--;
    let e = at;
    while (e < src.length && !isEnd(e)) e++;
    if (isEnd(e)) e++;                       // 마침표 포함
    const text = src.slice(s, e).trim();
    if (text.length < 2) return;

    const rect = (el as HTMLElement).getBoundingClientRect();
    setSelPopover({
      text: text.slice(0, 300),
      before: src.slice(Math.max(0, s - 30), s),
      after: src.slice(e, e + 30),
      page,
      x: Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90),
      y: clientY - 12,
    });
  }, [pages]);

  // ── 텍스트 선택 캡처 → 형광 팝오버 ──
  useEffect(() => {
    if (loading || pages.length === 0) return;
    const root = bodyRef.current;
    if (!root) return;
    // 형광펜 모드에선 네이티브 선택을 안 쓴다 (아래 탭 핸들러가 담당)
    if (markMode) return;
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
  }, [loading, pages, markMode]);

  /**
   * 형광펜 모드의 범위 지정.
   *
   * 끌면 그 구간이 그대로 잡힌다. 브라우저 선택(window.getSelection)을 쓰지 않고
   * **CSS Custom Highlight API** 로 직접 칠하기 때문에 OS 의 '복사·공유' 막대가 뜨지 않는다.
   * 끌지 않고 그냥 누르면 그 문장 하나를 잡는다(빠른 길).
   *
   * Highlight API 미지원 브라우저에서는 미리보기만 안 보이고 지정은 그대로 된다.
   */
  useEffect(() => {
    if (!markMode || loading || pages.length === 0) return;
    const root = bodyRef.current;
    if (!root) return;

    type WithCaret = Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const doc = document as WithCaret;
    const caretAt = (x: number, y: number): { node: Node; offset: number } | null => {
      if (doc.caretRangeFromPoint) {
        const r = doc.caretRangeFromPoint(x, y);
        return r ? { node: r.startContainer, offset: r.startOffset } : null;
      }
      if (doc.caretPositionFromPoint) {
        const p = doc.caretPositionFromPoint(x, y);
        return p ? { node: p.offsetNode, offset: p.offset } : null;
      }
      return null;
    };

    // CSS.highlights 로 미리보기 — 선택 시스템을 건드리지 않는다
    const HL = 'regsel';
    const hlSupported = typeof CSS !== 'undefined' && 'highlights' in CSS;
    const paint = (range: Range | null) => {
      if (!hlSupported) return;
      const reg = (CSS as unknown as { highlights: Map<string, unknown> }).highlights;
      if (!range) { reg.delete(HL); return; }
      reg.set(HL, new (window as unknown as { Highlight: new (r: Range) => unknown }).Highlight(range));
    };

    let start: { node: Node; offset: number } | null = null;
    let startXY: { x: number; y: number } | null = null;
    let dragged = false;

    const buildRange = (endX: number, endY: number): Range | null => {
      if (!start) return null;
      const end = caretAt(endX, endY);
      if (!end || !root.contains(end.node)) return null;
      const r = document.createRange();
      try {
        r.setStart(start.node, start.offset);
        r.setEnd(end.node, end.offset);
        if (r.collapsed) {           // 거꾸로 끈 경우
          r.setStart(end.node, end.offset);
          r.setEnd(start.node, start.offset);
        }
      } catch { return null; }
      return r.collapsed ? null : r;
    };

    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('button')) return;
      const c = caretAt(e.clientX, e.clientY);
      if (!c || !root.contains(c.node)) return;
      start = c;
      startXY = { x: e.clientX, y: e.clientY };
      dragged = false;
      paint(null);
      setSelPopover(null);
    };

    const onMove = (e: PointerEvent) => {
      if (!start || !startXY) return;
      // 손떨림은 드래그로 치지 않는다
      if (Math.hypot(e.clientX - startXY.x, e.clientY - startXY.y) < 8) return;
      dragged = true;
      paint(buildRange(e.clientX, e.clientY));
    };

    const onUp = (e: PointerEvent) => {
      if (!start) return;
      const t = e.target as HTMLElement;
      if (t.closest('button')) { start = null; return; }

      if (!dragged) {                       // 그냥 눌렀다 → 문장 하나
        paint(null);
        pickSentenceAt(e.clientX, e.clientY);
        start = null;
        return;
      }

      const range = buildRange(e.clientX, e.clientY);
      start = null;
      if (!range) { paint(null); return; }

      const text = range.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 2) { paint(null); return; }

      // 페이지 식별 + 원문에서 위치 찾기 (기존 저장 형식 그대로)
      const anchor = range.startContainer.nodeType === Node.TEXT_NODE
        ? (range.startContainer as Text).parentElement
        : (range.startContainer as Element);
      const pageEl = anchor?.closest('[data-page]') as HTMLElement | null;
      const page = parseInt(pageEl?.dataset.page || '0', 10);
      const pageData = pages.find((p) => p.page === page);
      if (!page || !pageData) { paint(null); return; }

      // 렌더 텍스트는 공백이 정규화돼 원문과 다를 수 있다 → 공백 무시로 찾는다
      const squash = (s: string) => s.replace(/\s+/g, '');
      const target = squash(text);
      const src = pageData.text;
      const map: number[] = [];
      let flat = '';
      for (let i = 0; i < src.length; i++) {
        if (!/\s/.test(src[i])) { flat += src[i]; map.push(i); }
      }
      const at = flat.indexOf(target);
      if (at < 0) { paint(null); return; }
      const s = map[at];
      const e2 = map[Math.min(at + target.length - 1, map.length - 1)] + 1;

      const rect = range.getBoundingClientRect();
      setSelPopover({
        text: src.slice(s, e2),
        before: src.slice(Math.max(0, s - 30), s),
        after: src.slice(e2, e2 + 30),
        page,
        x: Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90),
        y: rect.top,
      });
    };

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', () => { start = null; paint(null); });
    return () => {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      paint(null);
    };
  }, [markMode, loading, pages, pickSentenceAt]);

  // 팝오버가 닫히면 미리보기도 지운다
  useEffect(() => {
    if (selPopover) return;
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
    (CSS as unknown as { highlights: Map<string, unknown> }).highlights.delete('regsel');
  }, [selPopover]);

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

  // 목차 카드가 화면 밖으로 벗어나면 "목차로" FAB 노출
  useEffect(() => {
    if (loading || tocEntries.length === 0 || !tocCardRef.current || !bodyRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowTocFab(!entry.isIntersecting),
      { root: bodyRef.current, threshold: 0 },
    );
    observer.observe(tocCardRef.current);
    return () => observer.disconnect();
  }, [loading, tocEntries.length]);

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
        const artNumMatch = /제\s*(\d+)\s*조/.exec(m[0]);
        children.push(
          <span
            key={`a-${subKey++}`}
            className={styles.articleMark}
            data-article={artNumMatch ? artNumMatch[1] : undefined}
          >
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
        {/* 법① 이어진 세그먼트(상태선택) — 작게/보통/크게/특대 */}
        <div
          className={`z-segment ${styles.fontSegment}`}
          data-no-press
          /* STYLE-EXCEPTION: 세그먼트 활성 인덱스/개수 런타임 주입 */
          style={{ '--seg-count': 4, '--seg-idx': (['small', 'normal', 'large', 'xlarge'] as FontSize[]).indexOf(fontSize) } as React.CSSProperties}
        >
          {([
            { key: 'small' as FontSize, label: '작게' },
            { key: 'normal' as FontSize, label: '보통' },
            { key: 'large' as FontSize, label: '크게' },
            { key: 'xlarge' as FontSize, label: '특대' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`z-segment-item ${fontSize === opt.key ? 'is-on' : ''}`}
              aria-pressed={fontSize === opt.key}
              onClick={() => setFontSize(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 도구 줄 — 글자 크기와 한 줄에 두면 360px 에서 폭을 넘겨 마지막 버튼이 잘린다.
          별도 줄로 빼고 셋을 균등 배분한다(좁으면 잘리지 않고 다음 줄로 내려감). */}
      <div className={styles.actionRow}>
        {pdfUrl && (
          <button type="button" className={styles.pdfBtn} onClick={() => setPdfOpen(true)}>
            <FileText size={14} />
            <span>원본 PDF</span>
          </button>
        )}
        <button
          type="button"
          className={`${styles.pdfBtn} ${markMode ? styles.markModeOn : ''}`}
          onClick={() => { setMarkMode((v) => !v); setSelPopover(null); window.getSelection()?.removeAllRanges(); }}
          aria-pressed={markMode}
          aria-label={markMode ? '형광펜 모드 끄기' : '형광펜 모드 켜기 — 문장을 눌러 표시'}
        >
          <Highlighter size={14} />
          <span>형광펜</span>
        </button>
        <button
          type="button"
          className={styles.pdfBtn}
          onClick={() => setNotesOpen(true)}
          aria-label="내 메모·형광 목록"
        >
          <span>📝</span>
          <span>내 메모{annotations.length > 0 && ` ${annotations.length}`}</span>
        </button>
      </div>

      {/* STYLE-EXCEPTION: 사용자 선택 폰트 크기를 CSS 변수로 전달 (런타임 값) */}
      <div
        ref={bodyRef}
        className={`${styles.body} ${markMode ? styles.bodyMarkMode : ''}`}
        style={{ ['--reg-font-size' as string]: computedFontSize }}
      >
        {markMode && (
          <p className={styles.markModeHint}>
            형광펜 모드 — <b>끌면 그 구간</b>, <b>누르면 그 문장</b>이 잡혀요. 끄면 평소처럼 복사할 수 있어요.
          </p>
        )}
        {loading && <div className={styles.loading}>불러오는 중...</div>}
        {!loading && pages.length === 0 && (
          <div className={styles.emptyState}>본문을 불러올 수 없어요</div>
        )}

        {/* 목차 카드 */}
        {!loading && tocEntries.length > 0 && (
          <div ref={tocCardRef} className={styles.tocCard}>
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

      {/* 목차로 빠르게 이동하는 FAB — TOC 카드가 화면 밖으로 나갔을 때 노출 */}
      {showTocFab && tocEntries.length > 0 && (
        <button
          type="button"
          className={styles.tocFab}
          onClick={scrollToTopToc}
          aria-label="목차로 이동"
        >
          <ListTree size={18} />
          <span>목차로</span>
        </button>
      )}

      {pdfOpen && pdfUrl && (
        <div className={styles.pdfOverlay} role="dialog" aria-modal="true" aria-label={`${title} 원본 PDF`}>
          <div className={styles.pdfHeader}>
            <button type="button" className={styles.backBtn} onClick={() => setPdfOpen(false)} aria-label="닫기">
              <ArrowLeft size={20} />
            </button>
            <h2 className={styles.title}>{title} (원본 p.{visiblePage})</h2>
            {/*
              PDF.js 툴바에도 저장 버튼이 있지만 아이콘만 있고 라벨이 영어(Save)라 찾기 어렵다.
              같은 출처(/data/edu/regulations/*.pdf)라 download 속성이 그대로 먹는다 —
              뷰어를 거치지 않고 한 번에 받아지고, 파일명도 규정 이름으로 저장된다.
            */}
            <a
              href={pdfUrl}
              download={`${title}.pdf`}
              className={styles.pdfDownBtn}
              aria-label={`${title} 원본 PDF 내려받기`}
            >
              <Download size={16} strokeWidth={2.2} aria-hidden />
              <span>내려받기</span>
            </a>
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
