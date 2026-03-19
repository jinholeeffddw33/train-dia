'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import ContentRenderer from './ContentRenderer';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DocumentViewerProps {
  onBack: () => void;
}

type ViewMode = 'toc' | 'section';

export default function DocumentViewer({ onBack }: DocumentViewerProps) {
  const [doc, setDoc] = useState<any>(null);
  const [mode, setMode] = useState<ViewMode>('toc');
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const { progress, markSectionRead } = useEduStore();

  useEffect(() => {
    fetch('/data/edu/handbook.json')
      .then(r => r.json())
      .then(setDoc)
      .catch(() => {});
  }, []);

  // flat list of all sections
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
    markSectionRead(sectionId);
    window.scrollTo(0, 0);
  }, [markSectionRead]);

  const toggleChapter = useCallback((chId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chId)) next.delete(chId);
      else next.add(chId);
      return next;
    });
  }, []);

  // search filtering
  const filteredChapters = useMemo(() => {
    if (!doc || !search.trim()) return doc?.chapters ?? [];
    const q = search.toLowerCase();
    return doc.chapters.map((ch: any) => ({
      ...ch,
      sections: ch.sections.filter((sec: any) => {
        if (sec.title.toLowerCase().includes(q)) return true;
        // deep search in content
        return JSON.stringify(sec.content).toLowerCase().includes(q);
      }),
    })).filter((ch: any) => ch.sections.length > 0);
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

  if (mode === 'section' && currentSectionData) {
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

  // TOC mode
  const readMap = progress.readSections;

  function formatReadLabel(sectionId: string): string | null {
    const rec = readMap[sectionId];
    if (!rec) return null;
    const d = rec.lastRead; // YYYY-MM-DD
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
        <div style={{ position: 'relative' }}>
          {/* STYLE-EXCEPTION: position relative는 CSS variable로 표현 불가 */}
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dia-text-tertiary)', pointerEvents: 'none' }} />
          {/* STYLE-EXCEPTION: 아이콘 위치 지정 */}
          <input
            type="search"
            className={styles.searchInput}
            placeholder="검색 (예: ATC, 출입문, 구원)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          {/* STYLE-EXCEPTION: 아이콘에 맞춘 좌측 패딩 */}
        </div>
      </div>

      <div className={styles.tocList}>
        {filteredChapters.map((ch: any) => {
          const isExpanded = expandedChapters.has(ch.id) || search.trim().length > 0;
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

        {filteredChapters.length === 0 && (
          <div className={styles.emptyState}>
            &ldquo;{search}&rdquo; 검색 결과가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
