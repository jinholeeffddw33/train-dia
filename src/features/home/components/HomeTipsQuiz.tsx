'use client';

import { useState, useRef, useEffect } from 'react';
import { DAILY_TIPS, QUIZ } from '@/data/tips';
import styles from '../styles/Home.module.css';

export default function HomeTipsQuiz() {
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);

  const nextBtnRef = useRef<HTMLButtonElement>(null);

  // 답변 후 "다음 문제" 버튼으로 자동 스크롤
  useEffect(() => {
    if (quizAnswer !== null && nextBtnRef.current) {
      const timer = setTimeout(() => {
        nextBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [quizAnswer]);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 864e5);
  const todayTip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
  const currentQuiz = QUIZ[quizIdx % QUIZ.length];

  return (
    <div className={styles.tipsQuizSection}>
      {/* 오늘의 한마디 */}
      <div className={styles.tipCard}>
        <span className={styles.tipIcon}>{todayTip.icon}</span>
        <div className={styles.tipContent}>
          <span className={styles.tipLabel}>오늘의 한마디 <span className={styles.newBadge}>NEW</span></span>
          <p className={styles.tipText}>{todayTip.text}</p>
        </div>
      </div>

      {/* 안전 퀴즈 */}
      <div className={styles.quizCard}>
        <span className={styles.quizLabel}>안전 퀴즈 <span className={styles.newBadge}>NEW 30</span></span>
        <p className={styles.quizQuestion}>{currentQuiz.q}</p>
        <div className={styles.quizOptions}>
          {currentQuiz.a.map((opt, i) => {
            const isCorrect = i === currentQuiz.correct;
            const isSelected = quizAnswer === i;
            const showResult = quizAnswer !== null;
            return (
              <button
                key={i}
                type="button"
                className={`${styles.quizOption} ${showResult && isCorrect ? styles.quizCorrect : ''} ${showResult && isSelected && !isCorrect ? styles.quizWrong : ''}`}
                onClick={() => setQuizAnswer(i)}
                disabled={showResult}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {quizAnswer !== null && (
          <div className={styles.quizExplanation}>
            <p>{quizAnswer === currentQuiz.correct ? '맞았어요!' : '아쉬워요!'} {currentQuiz.exp}</p>
            <button
              ref={nextBtnRef}
              type="button"
              className={styles.quizNext}
              onClick={() => { setQuizIdx((i) => i + 1); setQuizAnswer(null); }}
            >
              다음 문제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
