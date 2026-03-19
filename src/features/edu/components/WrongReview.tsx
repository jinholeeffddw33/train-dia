'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

interface WrongReviewProps {
  onBack: () => void;
}

export default function WrongReview({ onBack }: WrongReviewProps) {
  const { progress, removeWrongAnswer } = useEduStore();
  const wrongs = [...progress.wrongAnswers].reverse();

  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

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

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>오답노트 ({wrongs.length})</h1>
      </div>

      <div className={styles.wrongList}>
        {wrongs.map(w => {
          const isOpen = expanded === w.questionId;
          return (
            <div key={w.questionId} className={styles.wrongItem}>
              <button
                type="button"
                className={styles.wrongQuestion}
                onClick={() => toggle(w.questionId)}
              >
                <span className={styles.wrongQText}>{w.question}</span>
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
                  <button
                    type="button"
                    className={styles.wrongDeleteBtn}
                    onClick={() => removeWrongAnswer(w.questionId)}
                  >
                    <Trash2 size={14} />
                    삭제
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
