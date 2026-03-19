'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Search, Bookmark } from 'lucide-react';
import ContentRenderer from './ContentRenderer';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DocumentViewerProps {
  onBack: () => void;
  initSection?: string;
  initChapter?: string;
}

type ViewMode = 'toc' | 'section';

export default function DocumentViewer({ onBack, initSection, initChapter }: DocumentViewerProps) {
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
          // 해당 섹션의 챕터 찾아서 기록
          for (const ch of data.chapters) {
            for (const sec of ch.sections) {
              if (sec.id === initSection) {
                markSectionRead(initSection, ch.id);
                break;
              }
            }
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
  const currentChapterId = currentIdx >= 0 ? allSections[currentIdx].chapterId : undefined;

  const openSection = useCallback((sectionId: string) => {
    setCurrentSection(sectionId);
    setMode('section');
    // 찾아서 chapterId 전달
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

  // 검색 결과 (미리보기 포함)
  const searchResults = useMemo(() => {
    if (!doc || !search.trim()) return null;
    const q = search.toLowerCase();
    const results: { chapterId: string; chapterTitle: string; sectionId: string; sectionTitle: string; preview: string }[] = [];

    for (const ch of doc.chapters) {
      for (const sec of ch.sections) {
        const titleMatch = sec.title.toLowerCase().includes(q);
        const contentStr = JSON.stringify(sec.content).toLowerCase();
        const contentMatch = contentStr.includes(q);
        if (titleMatch || contentMatch) {
          // 미리보기 추출
          let preview = '';
          if (contentMatch) {
            const flat = extractText(sec.content);
            const idx = flat.toLowerCase().indexOf(q);
            if (idx >= 0) {
              const start = Math.max(0, idx - 20);
              const end = Math.min(flat.length, idx + q.length + 40);
              preview = (start > 0 ? '...' : '') + flat.slice(start, end) + (end < flat.length ? '...' : '');
            }
          }
          results.push({
            chapterId: ch.id,
            chapterTitle: ch.title,
            sectionId: sec.id,
            sectionTitle: sec.title,
            preview,
          });
        }
      }
    }
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

        <div className={styles.sectionContent}>
          <ContentRenderer blocks={currentSectionData.content} />
        </div>

        <div className={styles.sectionNav}>
          {currentIdx > 0 && (
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => openSection(allSections[currentIdx - 1].sectionId)}
            >
              이전
            </button>
          )}
          {currentIdx < allSections.length - 1 && (
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnPrimary}`}
              onClick={() => openSection(allSections[currentIdx + 1].sectionId)}
            >
              다음
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
            placeholder="검색 (예: ATC, 출입문, 구원)"
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
                <span className={styles.searchResultTitle}>{r.sectionTitle}</span>
                {r.preview && (
                  <span className={styles.searchResultPreview}>{r.preview}</span>
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
            {doc.chapters.map((ch: any) => {
              const isExpanded = expandedChapters.has(ch.id);
              const readCountInCh = ch.sections.filter((s: any) => readMap[s.id]).length;

              return (
                <div key={ch.id} className={styles.tocChapter}>
                  <button type="button" className={styles.tocChapterBtn} onClick={() => toggleChapter(ch.id)}>
                    <span className={styles.tocChIcon}>{ch.icon}</span>
                    <span className={styles.tocChTitle}>{ch.title}</span>
                    {readCountInCh > 0 && (
                      <span className={styles.tocBadge}>
                        {readCountInCh}/{ch.sections.length}
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className={styles.tocSections}>
                      {ch.sections.map((sec: any) => (
                        <button
                          key={sec.id}
                          type="button"
                          className={styles.tocSectionBtn}
                          onClick={() => openSection(sec.id)}
                        >
                          {bookmarkSet.has(sec.id) && (
                            <Bookmark size={12} className={styles.bookmarkIcon} fill="currentColor" />
                          )}
                          <span className={styles.tocSecTitle}>{sec.title}</span>
                          {formatReadLabel(sec.id) && (
                            <span className={styles.tocRead}>{formatReadLabel(sec.id)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
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
  }
  return parts.join(' ');
}
