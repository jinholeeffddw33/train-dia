'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ArrowLeft, Search, X, ChevronUp, ChevronDown, FileText, List, ListTree, Download, Highlighter, Headphones, MoreVertical, Eraser, BookmarkPlus, Share, Copy, NotebookPen } from 'lucide-react';
import RegulationReader from './RegulationReader';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useAnnotations, HIGHLIGHT_COLORS, type Annotation, type HighlightColor } from '@/hooks/useAnnotations';
import { useFontSizeStore } from '@/stores/fontSize';
import { showToast } from '@/components/common/Toast';
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
 * 공백을 무시하고 본문에서 찾은 뒤, 원문 기준 [시작, 끝) 을 돌려준다.
 * 앞뒤 문맥(withContext)으로 먼저 찾고 실패하면 문장 단독(needle)으로 찾는다 —
 * 같은 문장이 여러 번 나올 때 엉뚱한 자리에 붙는 것을 줄인다.
 */
function findIgnoringSpaces(flat: string, withContext: string, needle: string): [number, number] | null {
  const map: number[] = [];          // 공백 뺀 위치 → 원문 위치
  let squashed = '';
  for (let i = 0; i < flat.length; i++) {
    if (!/\s/.test(flat[i])) { map.push(i); squashed += flat[i]; }
  }
  const target = needle.replace(/\s+/g, '');
  if (!target) return null;
  const ctx = withContext.replace(/\s+/g, '');
  let at = ctx ? squashed.indexOf(ctx) : -1;
  at = at >= 0 ? at + (ctx.length - target.length) : squashed.indexOf(target);
  if (at < 0 || at + target.length > map.length) return null;
  return [map[at], map[at + target.length - 1] + 1];
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  /**
   * 지금 잡힌 본문 조각. 잡히면 화면 아래에서 «작업 막대»가 올라온다.
   * 잡는 방법은 셋인데 모두 같은 자리에 들어온다 —
   *   ① 항을 탭 (기본)  ② 형광펜 모드에서 문장 탭  ③ 끌어서 구간 지정
   * blockKey 는 «어느 항을 탭했는가» — 그 항을 회색으로 반전시키는 데만 쓴다.
   */
  const [selection, setSelection] = useState<{
    text: string; before: string; after: string; page: number; blockKey?: string;
  } | null>(null);
  const [memoEditor, setMemoEditor] = useState<{ id: string; text: string; memo: string } | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  /* 낭독을 시작할 조문. 화면에 보이는 조문을 따라가다가, 낭독을 켜는 순간의 값으로 고정한다.
     계속 따라가면 낭독이 스크롤시킨 위치를 다시 읽어 제자리를 맴돈다. */
  const visibleArticleRef = useRef<number | undefined>(undefined);
  const [readerStart, setReaderStart] = useState<number | undefined>(undefined);

  useHistoryBack('regulation-pdf', () => setPdfOpen(false), pdfOpen);
  useHistoryBack('regulation-reader', () => setReaderOpen(false), readerOpen);
  useHistoryBack('regulation-popover', () => setSelection(null), !!selection);
  useHistoryBack('regulation-memo', () => setMemoEditor(null), !!memoEditor);
  useHistoryBack('regulation-notes', () => setNotesOpen(false), notesOpen);

  // ESC — 최상단 오버레이부터 역순으로 닫기 (메모목록 > 메모 > 형광 팝오버 > PDF > 뷰어 본체)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (notesOpen) setNotesOpen(false);
      else if (memoEditor) setMemoEditor(null);
      else if (selection) setSelection(null);
      else if (pdfOpen) setPdfOpen(false);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notesOpen, memoEditor, selection, pdfOpen, onClose]);

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

  /* 낭독이 다음 조문으로 넘어가면 본문도 따라간다 — 귀로 듣다 화면을 봤을 때
     읽고 있는 자리가 그대로 보여야 한다. 부드럽게(smooth) 움직이면 조문이 짧을 때
     스크롤이 밀리므로 즉시 이동한다. */
  const scrollToArticle = useCallback((n: number) => {
    const root = bodyRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-article="${n}"]`);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

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

    setSelection({
      text: text.slice(0, 300),
      before: src.slice(Math.max(0, s - 30), s),
      after: src.slice(e, e + 30),
      page,
    });
  }, [pages]);

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
      setSelection({ text, before, after, page });
    };
    document.addEventListener('mouseup', handleSelectionEnd);
    document.addEventListener('touchend', handleSelectionEnd);
    return () => {
      document.removeEventListener('mouseup', handleSelectionEnd);
      document.removeEventListener('touchend', handleSelectionEnd);
    };
  }, [loading, pages]);

  // 팝오버가 닫히면 미리보기도 지운다
  useEffect(() => {
    if (selection) return;
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
    (CSS as unknown as { highlights: Map<string, unknown> }).highlights.delete('regsel');
  }, [selection]);

  // ── annotations → DOM 적용 (텍스트 노드 walk + wrap) ──
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    // 1) 기존 annotation 마크 제거 (텍스트 노드로 복원)
    // 메모 뱃지부터 걷어낸다 — 형광 밖으로 흘러나온 뱃지가 남으면 본문에 📝만 둥둥 뜬다
    root.querySelectorAll('[data-anno-badge]').forEach((el) => el.remove());
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
        let endIdx = idx + needle.length;
        /* 4차: 공백 무시 대조.
           규정 PDF 5종은 원래 본문에 공백 문자가 없어("이규정은서울교통공사") 그 상태로
           형광펜이 저장됐다. 본문에 띄어쓰기를 복원한 뒤로는 저장된 문장이 그대로는
           안 맞는다. 공백을 지우고 맞춘 뒤 위치를 되짚어 준다 — 검색이 쓰는 방식과 같다. */
        if (idx < 0) {
          const loose = findIgnoringSpaces(flat, anno.before + anno.text, anno.text);
          if (!loose) continue;
          [idx, endIdx] = loose;
        }
        if (idx < 0) continue;

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
        /* 걸치는 «텍스트 마디»마다 따로 칠한다.
           예전엔 시작~끝을 한 Range 로 잡아 extractContents 로 통째 들어냈는데, 항 하나처럼
           여러 줄·여러 span 에 걸친 형광에서는 그 덩어리가 문단 상자(.textBlock) 밖으로
           끌려 나와 본문이 어긋났다(실측: 형광이 본문 아래에 따로 떨어져 그려짐).
           마디별로 감싸면 문단 구조는 한 글자도 건드리지 않는다. */
        const parts: { node: Text; from: number; to: number }[] = [];
        for (const o of offsets) {
          const nodeStart = o.start;
          const nodeEnd = o.start + o.node.data.length;
          if (nodeEnd <= idx || nodeStart >= endIdx) continue;
          parts.push({
            node: o.node,
            from: Math.max(idx, nodeStart) - nodeStart,
            to: Math.min(endIdx, nodeEnd) - nodeStart,
          });
        }
        if (parts.length === 0) continue;

        let lastSpan: HTMLElement | null = null;
        for (const part of parts) {
          if (part.to <= part.from) continue;
          // 공백만 걸린 마디는 건너뛴다 — 빈 형광 상자가 생기는 것을 막는다
          if (!part.node.data.slice(part.from, part.to).trim()) continue;
          try {
            const range = document.createRange();
            range.setStart(part.node, part.from);
            range.setEnd(part.node, part.to);
            const span = document.createElement('span');
            span.setAttribute('data-anno', anno.id);
            span.setAttribute('data-color', anno.color);
            span.className = styles.annotation + ' ' + styles[`annotationColor_${anno.color}`];
            if (anno.memo) span.setAttribute('title', anno.memo);
            range.surroundContents(span);
            lastSpan = span;
          } catch { /* 이 마디만 건너뛴다 */ }
        }

        // 메모·북마크 표시는 맨 끝에 한 번만
        if (lastSpan && (anno.memo || anno.bookmark)) {
          const badge = document.createElement('span');
          badge.className = styles.annotationMemoBadge;
          badge.setAttribute('data-anno-badge', anno.id);
          badge.textContent = anno.bookmark ? (anno.memo ? '🔖📝' : '🔖') : '📝';
          badge.setAttribute('aria-label', anno.bookmark ? '북마크' : '메모 보기');
          lastSpan.appendChild(badge);
        }
      }
    });
  }, [annotations, pages, query, activeMatchIdx, fontSize]);

  /**
   * 본문 탭 → 그 «항»을 잡는다. (갓피플 성경에서 절을 누르는 것과 같다)
   *
   * 이미 형광이 칠해진 자리를 누르면 그 형광 조각을 그대로 잡는다 — 색을 바꾸거나
   * 메모를 고칠 때 엉뚱하게 항 전체가 잡히지 않도록.
   *
   * 글자를 끌어서 고르고 있는 중이면(선택이 살아 있으면) 건드리지 않는다. 끌기는
   * 원래대로 «구간 지정» 이고, 그 처리는 아래 selection 핸들러가 맡는다.
   */
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 목차 카드·버튼 등 본문이 아닌 것은 그대로 둔다
      if (target.closest('button, a, input, textarea')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;

      const pageEl = target.closest('[data-page]') as HTMLElement | null;
      if (!pageEl) return;
      const page = parseInt(pageEl.dataset.page || '0', 10);
      const pageData = pages.find((pg) => pg.page === page);
      if (!page || !pageData) return;

      // ① 형광 조각을 눌렀으면 그 조각
      const annoEl = target.closest('[data-anno]') as HTMLElement | null;
      const anno = annoEl ? annotations.find((a) => a.id === annoEl.dataset.anno) : undefined;
      if (anno) {
        setSelection({ text: anno.text, before: anno.before, after: anno.after, page: anno.page });
        return;
      }

      // ② 아니면 그 항 전체
      const blockEl = target.closest('[data-bstart]') as HTMLElement | null;
      if (!blockEl) return;
      const start = parseInt(blockEl.dataset.bstart || '', 10);
      const len = parseInt(blockEl.dataset.blen || '', 10);
      if (!Number.isFinite(start) || !Number.isFinite(len) || len < 2) return;
      const src = pageData.text;
      const text = src.slice(start, start + len).trim();
      if (text.length < 2) return;
      setSelection({
        text,
        before: src.slice(Math.max(0, start - 30), start),
        after: src.slice(start + len, start + len + 30),
        page,
        blockKey: `${page}:${start}`,
      });
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [annotations, pages]);

  /* 잡힌 항을 회색으로 반전. 본문은 블록이 수백 개라 다시 그리면 무거워서,
     클래스만 직접 붙였다 뗀다. */
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const key = selection?.blockKey;
    if (!key) return;
    const [pageStr, startStr] = key.split(':');
    const el = root.querySelector<HTMLElement>(`[data-page="${pageStr}"] [data-bstart="${startStr}"]`);
    if (!el) return;
    el.classList.add(styles.blockPicked);
    return () => el.classList.remove(styles.blockPicked);
  }, [selection]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  /** 지금 잡힌 자리에 이미 저장된 형광·메모·북마크가 있는가 (같은 페이지 + 글이 겹치면 같은 자리로 본다) */
  const pickedAnnotation = useMemo(() => {
    if (!selection) return undefined;
    const mine = selection.text.replace(/\s+/g, '');
    return annotations.find((a) => {
      if (a.page !== selection.page) return false;
      const his = a.text.replace(/\s+/g, '');
      return his === mine || his.includes(mine) || mine.includes(his);
    });
  }, [selection, annotations]);

  /** 형광색 — 이미 있으면 색만 갈아입히고, 없으면 새로 만든다 */
  const handleAddHighlight = useCallback((color: HighlightColor) => {
    if (!selection) return;
    if (pickedAnnotation) updateAnnotation(pickedAnnotation.id, { color });
    else {
      addAnnotation({
        page: selection.page,
        text: selection.text,
        before: selection.before,
        after: selection.after,
        color,
      });
    }
    clearSelection();
  }, [selection, pickedAnnotation, addAnnotation, updateAnnotation, clearSelection]);

  /** 지우개 — 색을 지운다. 메모나 북마크가 남아 있으면 그것까지 지우지는 않는다. */
  const handleEraseHighlight = useCallback(() => {
    if (!pickedAnnotation) { clearSelection(); return; }
    const keep = pickedAnnotation.memo?.trim() || pickedAnnotation.bookmark;
    if (keep) updateAnnotation(pickedAnnotation.id, { color: 'none' });
    else removeAnnotation(pickedAnnotation.id);
    showToast(keep ? '형광만 지웠어요' : '표시를 지웠어요', 'info');
    clearSelection();
  }, [pickedAnnotation, updateAnnotation, removeAnnotation, clearSelection]);

  const handleToggleBookmark = useCallback(() => {
    if (!selection) return;
    if (pickedAnnotation) {
      const next = !pickedAnnotation.bookmark;
      /* 북마크만 있던 자리에서 북마크를 빼면 남길 것이 없다 — 기록째 지운다.
         예전엔 bookmark:false 로만 바꿔서, 색도 메모도 없는 빈 기록이 남아
         본문에 점선 밑줄이 그대로 남아 있었다. */
      if (!next && pickedAnnotation.color === 'none' && !pickedAnnotation.memo?.trim()) {
        removeAnnotation(pickedAnnotation.id);
      } else {
        updateAnnotation(pickedAnnotation.id, { bookmark: next });
      }
      showToast(next ? '북마크에 담았어요' : '북마크에서 뺐어요', next ? 'success' : 'info');
    } else {
      addAnnotation({
        page: selection.page,
        text: selection.text,
        before: selection.before,
        after: selection.after,
        color: 'none',
        bookmark: true,
      });
      showToast('북마크에 담았어요', 'success');
    }
    clearSelection();
  }, [selection, pickedAnnotation, addAnnotation, updateAnnotation, removeAnnotation, clearSelection]);

  /** 공유·복사에 붙일 출처 — 어느 규정 몇 쪽인지 알아야 남에게 보내도 쓸모가 있다 */
  const selectionForShare = useCallback(() => {
    if (!selection) return '';
    return `${selection.text}

— ${title} p.${selection.page}`;
  }, [selection, title]);

  const handleCopy = useCallback(async () => {
    const body = selectionForShare();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      showToast('복사했어요', 'success');
    } catch {
      showToast('복사할 수 없어요', 'error');
    }
    clearSelection();
  }, [selectionForShare, clearSelection]);

  const handleShare = useCallback(async () => {
    const body = selectionForShare();
    if (!body) return;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: body });
      } else {
        await navigator.clipboard.writeText(body);
        showToast('공유가 안 되는 기기예요 — 복사했어요', 'info');
      }
    } catch {
      /* 사용자가 공유창을 닫은 것도 여기로 온다 — 알릴 것 없다 */
    }
    clearSelection();
  }, [selectionForShare, title, clearSelection]);

  /** 노트작성 — 이미 있으면 그 메모를 고치고, 없으면 형광 없이 메모만 남긴다 */
  const handleAddWithMemo = useCallback(() => {
    if (!selection) return;
    const item = pickedAnnotation ?? addAnnotation({
      page: selection.page,
      text: selection.text,
      before: selection.before,
      after: selection.after,
      color: 'none',
    });
    setMemoEditor({ id: item.id, text: item.text, memo: item.memo ?? '' });
    setMemoDraft(item.memo ?? '');
    clearSelection();
  }, [selection, pickedAnnotation, addAnnotation, clearSelection]);

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

    const renderBlock = (blockText: string, blockKey: string, blockStart: number): ReactNode => {
      const children: ReactNode[] = [];
      let bcur = 0;
      let subKey = 0;
      /**
       * «제N조» 를 조문 제목으로 볼지, 문장 속 참조로 볼지.
       *
       * 제목은 언제나 블록 맨 앞에 온다 — computeBlocks 가 줄 첫머리의 «제N조» 를
       * 구조적 시작으로 보고 반드시 새 블록을 열기 때문이다.
       * 그래서 블록 맨 앞이 아니면 «…제4조, 제5조에서 정한 사고» 같은 참조다.
       *
       * 예전에는 전부 제목으로 그려서, 문장이 조문 참조마다 끊기고 파란 제목이
       * 중간에 튀어나왔다(실측 293곳, 인사규정 95곳). data-article 도 참조에 붙어
       * 조문 이동이 엉뚱한 곳으로 가기도 했다.
       */
      const leadWs = blockText.length - blockText.trimStart().length;
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
        const isHeading = mStart === leadWs;
        children.push(
          isHeading ? (
            <span
              key={`a-${subKey++}`}
              className={styles.articleMark}
              data-article={artNumMatch ? artNumMatch[1] : undefined}
            >
              {renderHighlighted(m[0], pageStartIdx + localMatchOffset)}
            </span>
          ) : (
            // 참조는 본문 흐름 그대로 — 옅게만 구분한다
            <span key={`a-${subKey++}`} className={styles.articleRef}>
              {renderHighlighted(m[0], pageStartIdx + localMatchOffset)}
            </span>
          ),
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
      /* data-bstart/blen — 이 덩어리가 페이지 «원문»의 어디부터 어디까지인가.
         항을 탭했을 때 원문을 그대로 오려내기 위한 좌표다. 화면에 그려진 글자에서
         거꾸로 찾으면 공백·줄바꿈이 달라 어긋나는데, 이 좌표는 어긋날 일이 없다. */
      return (
        <div key={blockKey} className={styles.textBlock} data-bstart={blockStart} data-blen={blockText.length}>
          {children}
        </div>
      );
    };

    const pushText = (slice: string, key: string, base: number) => {
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
        segments.push(renderBlock(blockText, `${key}-b${bi}`, base + s));
      });
    };

    for (const toc of pageToc) {
      if (cursor < toc.startInPage) {
        pushText(p.text.slice(cursor, toc.startInPage), `t-${cursor}`, cursor);
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
      pushText(p.text.slice(cursor), `t-${cursor}-end`, cursor);
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
      {/* 제목줄 하나로 끝낸다 — 본문이 화면의 주인이어야 한다.
          예전엔 검색·글자크기·도구가 각각 한 줄씩 차지해 본문이 화면의 절반도 안 됐다.
          자주 안 쓰는 것(글자 크기·원본 PDF)은 «더보기» 안으로 넣었다. */}
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.headerBtn} ${searchOpen ? styles.headerBtnOn : ''}`}
            onClick={() => { if (searchOpen) setQuery(''); setSearchOpen((v) => !v); }}
            aria-pressed={searchOpen}
            aria-label="본문 검색"
          >
            <Search size={20} />
          </button>
          <button
            type="button"
            className={`${styles.headerBtn} ${readerOpen ? styles.headerBtnOn : ''}`}
            onClick={() => {
              if (readerOpen) { setReaderOpen(false); return; }
              /* 지금 화면 맨 위에 걸린 조문부터 읽는다 — 보던 자리에서 이어지도록.
                 observer 를 따로 두지 않고 열 때 한 번만 훑는다(조문 블록이 수백 개다). */
              const root = bodyRef.current;
              let start: number | undefined;
              if (root) {
                const top = root.getBoundingClientRect().top;
                for (const el of root.querySelectorAll<HTMLElement>('[data-article]')) {
                  if (el.getBoundingClientRect().bottom > top) {
                    start = parseInt(el.dataset.article ?? '', 10) || undefined;
                    break;
                  }
                }
              }
              visibleArticleRef.current = start;
              setReaderStart(start);
              setReaderOpen(true);
            }}
            aria-pressed={readerOpen}
            aria-label={readerOpen ? '읽어주기 닫기' : '읽어주기 — 보고 있는 조문부터 읽어줍니다'}
          >
            <Headphones size={20} />
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => setNotesOpen(true)}
            aria-label={`내 표시 ${annotations.length}건 보기`}
          >
            <Highlighter size={20} />
            {annotations.length > 0 && <span className={styles.headerBadge}>{annotations.length}</span>}
          </button>
          <button
            type="button"
            className={`${styles.headerBtn} ${menuOpen ? styles.headerBtnOn : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="더보기"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {searchOpen && (
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
              autoFocus
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
              <button type="button" className={styles.navBtn} onClick={handlePrev} disabled={totalMatches === 0} aria-label="이전 결과">
                <ChevronUp size={18} />
              </button>
              <button type="button" className={styles.navBtn} onClick={handleNext} disabled={totalMatches === 0} aria-label="다음 결과">
                <ChevronDown size={18} />
              </button>
            </>
          )}
        </div>
      )}

      {menuOpen && (
        <div className={styles.menuPanel}>
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
          {pdfUrl && (
            <button type="button" className={styles.menuItem} onClick={() => { setMenuOpen(false); setPdfOpen(true); }}>
              <FileText size={16} />
              <span>원본 PDF 보기</span>
            </button>
          )}
        </div>
      )}

      {/* STYLE-EXCEPTION: 사용자 선택 폰트 크기를 CSS 변수로 전달 (런타임 값) */}
      <div
        ref={bodyRef}
        className={styles.body}
        style={{ ['--reg-font-size' as string]: computedFontSize }}
      >
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

      {/* 목차로 빠르게 이동하는 FAB — TOC 카드가 화면 밖으로 나갔을 때 노출.
          낭독 패널이 열리면 하단 속도 버튼(1.5배)을 덮어 못 누르게 되므로 숨긴다. */}
      {showTocFab && tocEntries.length > 0 && !readerOpen && !selection && (
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

      {readerOpen && (
        <RegulationReader
          regulationId={regulationId}
          startArticle={readerStart}
          onClose={() => setReaderOpen(false)}
          onArticleChange={scrollToArticle}
        />
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

      {/* 잡은 자리에 대고 할 일 — 화면 아래에서 올라온다 (갓피플 성경의 절 선택 막대와 같은 얼개) */}
      {selection && (
        <div className={styles.actionBar} role="dialog" aria-label="선택한 본문으로 할 일">
          <p className={styles.actionBarQuote}>{selection.text}</p>

          <div className={styles.penRow}>
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${styles.penDot} ${styles[`pen_${c.key}`]} ${pickedAnnotation?.color === c.key ? styles.penDotOn : ''}`}
                onClick={() => handleAddHighlight(c.key)}
                aria-label={`${c.label} 형광펜`}
                aria-pressed={pickedAnnotation?.color === c.key}
              />
            ))}
            <button
              type="button"
              className={styles.penEraser}
              onClick={handleEraseHighlight}
              aria-label="형광펜 지우개"
            >
              <Eraser size={16} strokeWidth={2.2} aria-hidden />
            </button>
          </div>

          <div className={styles.actRow}>
            <button type="button" className={styles.actBtn} onClick={handleToggleBookmark}>
              <BookmarkPlus size={20} strokeWidth={1.8} aria-hidden className={pickedAnnotation?.bookmark ? styles.actIconOn : undefined} />
              <span>{pickedAnnotation?.bookmark ? '북마크해제' : '북마크추가'}</span>
            </button>
            <button type="button" className={styles.actBtn} onClick={handleShare}>
              <Share size={20} strokeWidth={1.8} aria-hidden />
              <span>SNS공유</span>
            </button>
            <button type="button" className={styles.actBtn} onClick={handleCopy}>
              <Copy size={20} strokeWidth={1.8} aria-hidden />
              <span>복사하기</span>
            </button>
            <button type="button" className={styles.actBtn} onClick={handleAddWithMemo}>
              <NotebookPen size={20} strokeWidth={1.8} aria-hidden />
              <span>{pickedAnnotation?.memo ? '노트수정' : '노트작성'}</span>
            </button>
          </div>

          <button type="button" className={styles.actCancel} onClick={clearSelection}>선택 취소</button>
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
              <h3 className={styles.notesTitle}>내 표시 <span className={styles.notesCount}>{annotations.length}건</span></h3>
              <button type="button" className={styles.memoClose} onClick={() => setNotesOpen(false)} aria-label="닫기">✕</button>
            </div>
            <div className={styles.notesList}>
              {annotations.length === 0 && (
                <p className={styles.notesEmpty}>본문에서 항(①②③)을 누르면 형광펜·북마크·노트를 남길 수 있어요</p>
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
                    {a.bookmark && <span className={styles.notesItemMemoBadge} aria-label="북마크">🔖</span>}
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
