'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trash2, BookOpen } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WrongReviewProps {
  onBack: () => void;
  onSection?: (sectionId: string) => void;
}

/** 챕터 레이블 → 챕터 ID 역방향 매핑 */
const CHAPTER_ID_MAP: Record<string, string> = {
  '근무작업절차': 'ch1',
  '전동차 일반': 'ch2',
  '차종 비교': 'ch3',
  '기지/주박': 'ch4',
  '이례사항': 'ch5',
  '한줄노트': 'ch6',
  '사고사례': 'ch7',
  '방송문안': 'ch8',
  '통화요령': 'ch9',
  'All-Call': 'ch10',
};

export default function WrongReview({ onBack, onSection }: WrongReviewProps) {
  const { progress, removeWrongAnswer } = useEduStore();
  const wrongs = [...progress.wrongAnswers].reverse();

  const [expanded, setExpanded] = useState<string | null>(null);

  // 챕터ID → 첫 번째 섹션ID 매핑 (관련 교재 보기용)
  const [chapterSectionMap, setChapterSectionMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/data/edu/handbook.json')
      .then(r => r.json())
      .then(data => {
        const m: Record<string, string> = {};
        for (const ch of data.chapters) {
          if (ch.sections.length > 0) {
            m[ch.id] = ch.sections[0].id;
          }
        }
        setChapterSectionMap(m);
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  const goToRelatedSection = useCallback((w: { chapterId?: string; chapter: string }) => {
    if (!onSection) return;
    const chId = w.chapterId || CHAPTER_ID_MAP[w.chapter];
    if (chId && chapterSectionMap[chId]) {
      onSection(chapterSectionMap[chId]);
    }
  }, [onSection, chapterSectionMap]);

  if (wrongs.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>오답노트</h1>
        </div>
        <div className={styles.emptyState}>
          틀린 문제가 없습니다. 시험을 먼저 풀어보세요.
        </div>
      </div>
    );
  }

  const resolvedCount = wrongs.filter(w => w.resolved).length;
  const unresolvedCount = wrongs.length - resolvedCount;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>
          오답노트 ({unresolvedCount > 0 ? `미해결 ${unresolvedCount}` : `${wrongs.length}`})
        </h1>
      </div>

      <div className={styles.wrongList}>
        {wrongs.map(w => {
          const isOpen = expanded === w.questionId;
          const isResolved = !!w.resolved;
          const chId = w.chapterId || CHAPTER_ID_MAP[w.chapter];
          const canGoToSection = !!onSection && !!chId && !!chapterSectionMap[chId];

          return (
            <div key={w.questionId} className={`${styles.wrongItem} ${isResolved ? styles.wrongResolved : ''}`}>
              <button
                type="button"
                className={styles.wrongQuestion}
                onClick={() => toggle(w.questionId)}
              >
                <span className={styles.wrongQText}>
                  {isResolved && <span className={styles.wrongResolvedBadge}>해결</span>}
                  {w.question}
                </span>
                <span className={styles.wrongChapter}>{w.chapter}</span>
              </button>

              {isOpen && (
                <div className={styles.wrongDetail}>
                  <div className={styles.wrongChoices}>
                    {w.choices.map((c, i) => (
                      <div
                        key={i}
                        className={`${styles.wrongChoice} ${
                          i === w.answer ? styles.wrongCorrect :
                          i === w.selected ? styles.wrongSelected : ''
                        }`}
                      >
                        {i + 1}. {c}
                        {i === w.answer && <span className={styles.wrongTag}>정답</span>}
                        {i === w.selected && i !== w.answer && <span className={styles.wrongTag}>내 선택</span>}
                      </div>
                    ))}
                  </div>
                  <div className={styles.wrongExplanation}>{w.explanation}</div>
                  <div className={styles.wrongActions}>
                    {canGoToSection && (
                      <button
                        type="button"
                        className={styles.wrongLinkBtn}
                        onClick={() => goToRelatedSection(w)}
                      >
                        <BookOpen size={14} />
                        관련 교재 보기
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.wrongDeleteBtn}
                      onClick={() => removeWrongAnswer(w.questionId)}
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
