'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Search, Bookmark, AlertTriangle, Info, Check,
  TrainFront, Wrench, Building2, AlertCircle, FileText, Mic,
  Radio, Satellite, Rocket, Shield,
  type LucideIcon,
} from 'lucide-react';
import ContentRenderer from './ContentRenderer';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DocumentViewerProps {
  onBack: () => void;
  initSection?: string;
  initChapter?: string;
  /** 여러 챕터를 펼쳐서 보여줄 때 (아이콘 메뉴 진입) */
  initChapters?: string[];
}

type ViewMode = 'toc' | 'section';

/** 현장 검색 별칭 맵 — 기관사가 실제 사용하는 약어/동의어 */
const SEARCH_ALIAS_MAP: Record<string, string[]> = {
  'ATC': ['자동열차제어', '자동열차제어장치', 'ATC장치'],
  'ATO': ['자동열차운전', '자동운전'],
  'ATP': ['자동열차방호', '열차방호장치'],
  'EB': ['비상제동', '비상브레이크', 'Emergency Brake'],
  'TGIS': ['열차종합정보', '종합정보시스템'],
  'SIV': ['보조전원장치', '정적인버터'],
  'VVVF': ['추진제어', '인버터'],
  '출입문': ['도어', '차문', '승객문', '승강문'],
  '구원': ['구원운전', '구원열차', '합병운전'],
  '대피': ['승객대피', '비상대피', '여객대피'],
  '화재': ['화재발생', '차량화재', '객실화재'],
  '고장': ['차량고장', '장애', '고장조치'],
  '지연': ['열차지연', '운행지연'],
  '역행': ['역행운전', '역주행'],
  '퇴행': ['퇴행운전'],
  '무선': ['무선통신', '열차무선'],
  '관제': ['종합관제', '관제실', '운영관제'],
  '기지': ['차량기지', '차량사업소'],
  '주박': ['주박위치', '야간주박'],
  '입고': ['입고절차', '차량입고'],
  '출고': ['출고절차', '차량출고'],
  '절연': ['절연구간'],
  'ABB': ['ABB차량', 'ABB전동차'],
  '우진': ['우진차량', '우진산전', '우진전동차'],
  '로템': ['현대로템', '로템차량', '로템전동차'],
};

/** 검색어 정규화: 공백 제거 + 소문자 */
function normalizeSearchTerm(term: string): string {
  return term.replace(/\s+/g, '').toLowerCase();
}

/** 별칭 맵에서 확장된 검색어 목록 반환 */
function expandSearchTerms(query: string): string[] {
  const q = query.trim();
  const qLower = q.toLowerCase();
  const qNorm = normalizeSearchTerm(q);
  const terms = new Set<string>([qLower, qNorm]);

  // alias 맵에서 정확히 매칭되는 키/값 찾기
  for (const [key, aliases] of Object.entries(SEARCH_ALIAS_MAP)) {
    const keyNorm = normalizeSearchTerm(key);
    if (keyNorm === qNorm || qNorm.includes(keyNorm)) {
      terms.add(keyNorm);
      for (const a of aliases) {
        terms.add(normalizeSearchTerm(a));
      }
    }
    for (const a of aliases) {
      if (normalizeSearchTerm(a) === qNorm) {
        terms.add(keyNorm);
        for (const aa of aliases) {
          terms.add(normalizeSearchTerm(aa));
        }
      }
    }
  }

  return [...terms];
}

/* ── 챕터 3D 배지 색상 순환 ── */
const CHAPTER_COLORS = ['blue', 'purple', 'green', 'amber', 'red'] as const;
type ChapterColor = typeof CHAPTER_COLORS[number];

const ICON_BG_MAP: Record<ChapterColor, string> = {
  blue:   styles.iconBgBlue,
  purple: styles.iconBgPurple,
  green:  styles.iconBgGreen,
  amber:  styles.iconBgAmber,
  red:    styles.iconBgRed,
};

const ACCENT_BAR_MAP: Record<ChapterColor, string> = {
  blue:   styles.tocAccentBlue,
  purple: styles.tocAccentPurple,
  green:  styles.tocAccentGreen,
  amber:  styles.tocAccentAmber,
  red:    styles.tocAccentRed,
};

const PROGRESS_BAR_MAP: Record<ChapterColor, string> = {
  blue:   styles.tocProgressBlue,
  purple: styles.tocProgressPurple,
  green:  styles.tocProgressGreen,
  amber:  styles.tocProgressAmber,
  red:    styles.tocProgressRed,
};

/** 이모지 → lucide 아이콘 매핑 */
const EMOJI_ICON_MAP: Record<string, LucideIcon> = {
  '🚆': TrainFront,
  '🔧': Wrench,
  '🏗️': Building2,
  '🔴': AlertCircle,
  '📝': FileText,
  '⚠️': AlertTriangle,
  '🎙️': Mic,
  '📻': Radio,
  '📡': Satellite,
  '🚀': Rocket,
  '🛡️': Shield,
};

function getChapterIcon(emoji: string): LucideIcon {
  return EMOJI_ICON_MAP[emoji] || FileText;
}

type SearchMatchType = 'title' | 'alias' | 'content';

interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  sectionId: string;
  sectionTitle: string;
  preview: string;
  matchType: SearchMatchType;
}

export default function DocumentViewer({ onBack, initSection, initChapter, initChapters }: DocumentViewerProps) {
  const [doc, setDoc] = useState<any>(null);
  const [mode, setMode] = useState<ViewMode>('toc');
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const { progress, markSectionRead, toggleBookmark, isBookmarked } = useEduStore();

  useEffect(() => {
    fetch('/data/edu/handbook.json')
      .then(r => r.json())
      .then(data => {
        setDoc(data);
        // 직진입 처리
        if (initSection) {
          setCurrentSection(initSection);
          setMode('section');
          for (const ch of data.chapters) {
            for (const sec of ch.sections) {
              if (sec.id === initSection) {
                markSectionRead(initSection, ch.id);
                break;
              }
            }
          }
        } else if (initChapters && initChapters.length > 0) {
          // 단일 챕터 + 단일 섹션이면 TOC 스킵 → 바로 섹션 뷰
          const filtered = data.chapters.filter((ch: any) => initChapters.includes(ch.id));
          const totalSections = filtered.reduce((sum: number, ch: any) => sum + ch.sections.length, 0);
          if (totalSections === 1 && filtered.length === 1) {
            const sec = filtered[0].sections[0];
            setCurrentSection(sec.id);
            setMode('section');
            markSectionRead(sec.id, filtered[0].id);
          } else {
            setExpandedChapters(new Set(initChapters));
          }
        } else if (initChapter) {
          setExpandedChapters(new Set([initChapter]));
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSections = useMemo(() => {
    if (!doc) return [];
    const list: { chapterId: string; sectionId: string; sectionTitle: string; chapterTitle: string }[] = [];
    for (const ch of doc.chapters) {
      for (const sec of ch.sections) {
        list.push({ chapterId: ch.id, sectionId: sec.id, sectionTitle: sec.title, chapterTitle: ch.title });
      }
    }
    return list;
  }, [doc]);

  const currentIdx = allSections.findIndex(s => s.sectionId === currentSection);

  const openSection = useCallback((sectionId: string) => {
    setCurrentSection(sectionId);
    setMode('section');
    const info = allSections.find(s => s.sectionId === sectionId);
    markSectionRead(sectionId, info?.chapterId);
    window.scrollTo(0, 0);
  }, [markSectionRead, allSections]);

  const toggleChapter = useCallback((chId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chId)) next.delete(chId);
      else next.add(chId);
      return next;
    });
  }, []);

  // 현장형 검색 (별칭 확장 + 정렬)
  const searchResults = useMemo(() => {
    if (!doc || !search.trim()) return null;
    const terms = expandSearchTerms(search);
    const results: SearchResult[] = [];

    for (const ch of doc.chapters) {
      for (const sec of ch.sections) {
        const titleNorm = normalizeSearchTerm(sec.title);
        const flat = extractText(sec.content);
        const flatNorm = normalizeSearchTerm(flat);

        // 매칭 판정: title > alias > content
        let matchType: SearchMatchType | null = null;

        // 1) 제목 일치
        if (terms.some(t => titleNorm.includes(t))) {
          matchType = 'title';
        }

        // 2) 별칭/키워드 확장 일치 (제목이 아닌 경우)
        if (!matchType) {
          // 원본 검색어로 제목 체크를 이미 했으니, 확장 term으로 제목 체크
          if (terms.length > 1 && terms.some(t => titleNorm.includes(t))) {
            matchType = 'alias';
          }
        }

        // 3) 본문 일치
        if (!matchType) {
          if (terms.some(t => flatNorm.includes(t))) {
            matchType = 'content';
          }
        }

        if (matchType) {
          // 미리보기 추출 (원본 검색어 기준)
          let preview = '';
          const qLower = search.toLowerCase();
          const idx = flat.toLowerCase().indexOf(qLower);
          if (idx >= 0) {
            const start = Math.max(0, idx - 20);
            const end = Math.min(flat.length, idx + qLower.length + 40);
            preview = (start > 0 ? '...' : '') + flat.slice(start, end) + (end < flat.length ? '...' : '');
          } else {
            // 확장 term으로 미리보기 찾기
            for (const t of terms) {
              const tIdx = flat.toLowerCase().indexOf(t);
              if (tIdx >= 0) {
                const start = Math.max(0, tIdx - 20);
                const end = Math.min(flat.length, tIdx + t.length + 40);
                preview = (start > 0 ? '...' : '') + flat.slice(start, end) + (end < flat.length ? '...' : '');
                break;
              }
            }
          }

          results.push({
            chapterId: ch.id,
            chapterTitle: ch.title,
            sectionId: sec.id,
            sectionTitle: sec.title,
            preview,
            matchType,
          });
        }
      }
    }

    // 정렬: title > alias > content
    const order: Record<SearchMatchType, number> = { title: 0, alias: 1, content: 2 };
    results.sort((a, b) => order[a.matchType] - order[b.matchType]);

    return results;
  }, [doc, search]);

  const currentSectionData = useMemo(() => {
    if (!doc || !currentSection) return null;
    for (const ch of doc.chapters) {
      for (const sec of ch.sections) {
        if (sec.id === currentSection) return sec;
      }
    }
    return null;
  }, [doc, currentSection]);

  if (!doc) {
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>교재 학습</h1>
        </div>
        <div className={styles.emptyState}>로딩 중...</div>
      </div>
    );
  }

  /* ── 섹션 뷰어 ── */
  if (mode === 'section' && currentSectionData) {
    const bookmarked = isBookmarked(currentSection!);
    const summaryArr = Array.isArray(currentSectionData.summary)
      ? currentSectionData.summary
      : currentSectionData.summary ? [currentSectionData.summary] : [];
    const hasSummary = summaryArr.length > 0;
    const hasCaution = !!currentSectionData.caution;
    const hasKeywords = currentSectionData.keywords && currentSectionData.keywords.length > 0;
    const showMeta = hasSummary || hasCaution || hasKeywords;

    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => { setMode('toc'); setCurrentSection(null); }}
            aria-label="목차로"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>{currentSectionData.title}</h1>
          <button
            type="button"
            className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarkActive : ''}`}
            onClick={() => toggleBookmark(currentSection!)}
            aria-label={bookmarked ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* 빠른 요약 카드 — 데이터에 메타가 있을 때만 표시 */}
        {showMeta && (
          <div className={styles.summaryCard}>
            {hasSummary && (
              <div className={styles.summarySection}>
                <div className={styles.summaryLabel}>
                  <span className={styles.metaIconBadgeBlue}>
                    <Info size={16} />
                  </span>
                  핵심 요약
                </div>
                <ul className={styles.summaryList}>
                  {summaryArr.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {hasCaution && (
              <div className={styles.summaryCaution}>
                <span className={styles.metaIconBadgeAmber}>
                  <AlertTriangle size={16} />
                </span>
                <span>{currentSectionData.caution}</span>
              </div>
            )}
            {hasKeywords && (
              <div className={styles.summaryKeywords}>
                {currentSectionData.keywords.map((kw: string, i: number) => (
                  <span key={i} className={styles.keywordChip}>{kw}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.sectionContent}>
          <ContentRenderer blocks={currentSectionData.content} />
        </div>

        {/* 섹션 메타 정보 (updatedAt) */}
        {currentSectionData.updatedAt && (
          <div className={styles.sectionMeta}>
            최종 개정: {currentSectionData.updatedAt}
          </div>
        )}

        <div className={styles.sectionNav}>
          {currentIdx > 0 && (
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => openSection(allSections[currentIdx - 1].sectionId)}
            >
              ← 이전
            </button>
          )}
          {currentIdx < allSections.length - 1 && (
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnPrimary}`}
              onClick={() => openSection(allSections[currentIdx + 1].sectionId)}
            >
              다음 →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── 목차 ── */
  const readMap = progress.readSections;
  const bookmarkSet = new Set(progress.bookmarks);

  function formatReadLabel(sectionId: string): string | null {
    const rec = readMap[sectionId];
    if (!rec) return null;
    const d = rec.lastRead;
    const short = `${parseInt(d.slice(5, 7))}/${parseInt(d.slice(8, 10))}`;
    return rec.count >= 2 ? `${rec.count}회 · ${short}` : short;
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>{doc.title}</h1>
      </div>

      <div className={styles.searchWrap}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="검색 (예: ATC, 출입문, 구원, 화재)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 검색 결과 */}
      {searchResults ? (
        <div className={styles.searchResults}>
          {searchResults.length === 0 ? (
            <div className={styles.emptyState}>
              &ldquo;{search}&rdquo; 검색 결과가 없습니다
            </div>
          ) : (
            searchResults.map(r => (
              <button
                key={r.sectionId}
                type="button"
                className={styles.searchResultItem}
                onClick={() => openSection(r.sectionId)}
              >
                <span className={styles.searchResultChapter}>{r.chapterTitle}</span>
                <span className={styles.searchResultTitle}>
                  <HighlightText text={r.sectionTitle} query={search} />
                </span>
                {r.preview && (
                  <span className={styles.searchResultPreview}>
                    <HighlightText text={r.preview} query={search} />
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        /* 즐겨찾기 + 목차 */
        <>
          {/* 즐겨찾기 섹션 */}
          {progress.bookmarks.length > 0 && (
            <div className={styles.tocList}>
              <div className={styles.sectionDivider}>즐겨찾기</div>
              {progress.bookmarks.map(secId => {
                const info = allSections.find(s => s.sectionId === secId);
                if (!info) return null;
                return (
                  <button
                    key={secId}
                    type="button"
                    className={styles.tocSectionBtn}
                    onClick={() => openSection(secId)}
                  >
                    <Bookmark size={14} className={styles.bookmarkIcon} fill="currentColor" />
                    <span className={styles.tocSecTitle}>{info.sectionTitle}</span>
                    {formatReadLabel(secId) && (
                      <span className={styles.tocRead}>{formatReadLabel(secId)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.tocList}>
            {(initChapters && initChapters.length > 0
              ? doc.chapters.filter((ch: any) => initChapters.includes(ch.id))
              : doc.chapters.filter((ch: any) => !ch.hidden)
            ).map((ch: any, chIdx: number) => {
              const isExpanded = expandedChapters.has(ch.id);
              const readCountInCh = ch.sections.filter((s: any) => readMap[s.id]).length;
              const color = CHAPTER_COLORS[chIdx % CHAPTER_COLORS.length];
              const ChIcon = getChapterIcon(ch.icon);
              const progressPct = ch.sections.length > 0
                ? Math.round((readCountInCh / ch.sections.length) * 100)
                : 0;

              return (
                <div key={ch.id} className={`${styles.tocChapter} ${ACCENT_BAR_MAP[color]}`}>
                  <button type="button" className={styles.tocChapterBtn} onClick={() => toggleChapter(ch.id)}>
                    <span className={`${styles.tocChIconBadge} ${ICON_BG_MAP[color]}`}>
                      <ChIcon size={18} />
                    </span>
                    <span className={styles.tocChBody}>
                      <span className={styles.tocChTitle}>{ch.title}</span>
                      {ch.sections.length > 0 && (
                        <span className={styles.tocProgressRow}>
                          <span className={styles.tocProgressTrack}>
                            {/* STYLE-EXCEPTION: 동적 진도 퍼센트 — CSS만으로 표현 불가 */}
                            <span
                              className={`${styles.tocProgressFill} ${PROGRESS_BAR_MAP[color]}`}
                              style={{ width: `${progressPct}%` }}
                              role="progressbar"
                              aria-valuenow={progressPct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </span>
                          <span className={styles.tocProgressLabel}>
                            {readCountInCh}/{ch.sections.length}
                          </span>
                        </span>
                      )}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.tocSections}>
                      {ch.sections.map((sec: any, secIdx: number) => {
                        const isRead = !!readMap[sec.id];
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            className={styles.tocSectionBtn}
                            onClick={() => openSection(sec.id)}
                          >
                            <span className={isRead ? styles.tocSecCheck : styles.tocSecNum}>
                              {isRead ? <Check size={12} /> : secIdx + 1}
                            </span>
                            {bookmarkSet.has(sec.id) && (
                              <Bookmark size={12} className={styles.bookmarkIcon} fill="currentColor" />
                            )}
                            <span className={styles.tocSecTitle}>{sec.title}</span>
                            {formatReadLabel(sec.id) && (
                              <span className={styles.tocRead}>{formatReadLabel(sec.id)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 교육자료 기준일 — 목차 하단 */}
          {doc.version && (
            <div className={styles.docVersionBanner}>
              교육자료 기준: {doc.version}
              {doc.updatedAt && ` · 최종 개정 ${doc.updatedAt}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 검색어 하이라이트 컴포넌트 */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const qLower = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(qLower);
  if (idx < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.searchHighlight}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** content 블록에서 순수 텍스트 추출 (검색 미리보기용) */
function extractText(blocks: any[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (typeof b === 'string') { parts.push(b); continue; }
    if (b.text) parts.push(b.text);
    if (b.title) parts.push(b.title);
    if (b.items) {
      for (const item of b.items) {
        if (typeof item === 'string') parts.push(item);
        else if (item.label) parts.push(item.label);
        else if (item.term) parts.push(item.term);
        else if (item.desc) parts.push(item.desc);
        if (item.items) parts.push(...item.items.filter((x: any) => typeof x === 'string'));
      }
    }
    if (b.steps) {
      for (const step of b.steps) {
        if (step.label) parts.push(step.label);
        if (step.items) parts.push(...step.items.filter((x: any) => typeof x === 'string'));
      }
    }
    if (b.rows) {
      for (const row of b.rows) {
        parts.push(...row.filter((x: any) => typeof x === 'string'));
      }
    }
    if (b.headers) {
      parts.push(...b.headers.filter((x: any) => typeof x === 'string'));
    }
  }
  return parts.join(' ');
}
