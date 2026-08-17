'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import ContentRenderer from './ContentRenderer';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  /** handbook.json 의 장 id (없으면 절 id 로만 폴백 탐색) */
  chapterId: string | null;
  /** handbook.json 의 절 id — 표시 대상 */
  sectionId: string;
  /** 못 찾았을 때 헤더에 쓸 대체 제목 */
  fallbackTitle: string;
  onClose: () => void;
}

interface Section { id: string; title: string; content: any[] }
interface Chapter { id: string; title: string; sections: Section[] }

/**
 * 레일봇 근거 배지(교재)에서 교안 원문 섹션으로 점프한다.
 * 규정은 RegulationViewer(PDF·조문)로 열지만, 교안은 handbook.json 의 구조화 콘텐츠라
 * TrainingList 와 동일한 ContentRenderer 로 렌더한다. 규정 뷰어와 같은 전체화면 오버레이 거동.
 */
export default function HandbookSectionViewer({ chapterId, sectionId, fallbackTitle, onClose }: Props) {
  const [section, setSection] = useState<Section | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useHistoryBack('handbook-section', onClose, true);
  useEscapeClose(true, onClose);

  useEffect(() => {
    let alive = true;
    fetch('/data/edu/handbook.json')
      .then((r) => r.json())
      .then((h: { chapters?: Chapter[] }) => {
        if (!alive) return;
        const chapters = h.chapters ?? [];
        const find = (matchChapter: boolean): { s: Section; ct: string } | null => {
          for (const ch of chapters) {
            if (matchChapter && chapterId && ch.id !== chapterId) continue;
            const s = ch.sections?.find((x) => x.id === sectionId);
            if (s) return { s, ct: ch.title };
          }
          return null;
        };
        // 장 id 로 먼저 찾고, 실패하면 절 id 만으로 폴백
        const hit = find(true) ?? find(false);
        if (!hit) { setState('error'); return; }
        setSection(hit.s);
        setChapterTitle(hit.ct);
        setState('ready');
      })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [chapterId, sectionId]);

  return (
    <div className={styles.handbookViewer} role="dialog" aria-modal="true" aria-label={section?.title ?? fallbackTitle}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="뒤로가기">
          <ArrowLeft size={22} />
        </button>
        <h1 className={styles.topTitle}>{section?.title ?? fallbackTitle}</h1>
      </div>

      <div className={styles.handbookBody}>
        {chapterTitle && <p className={styles.handbookChapter}>{chapterTitle}</p>}
        {state === 'loading' && <p className={styles.handbookNote}>교재를 불러오는 중…</p>}
        {state === 'error' && (
          <p className={styles.handbookNote}>교재 내용을 불러오지 못했어요. 규정 화면에서 직접 찾아보세요.</p>
        )}
        {state === 'ready' && section && <ContentRenderer blocks={section.content} />}
      </div>
    </div>
  );
}
