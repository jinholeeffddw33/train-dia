'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface QuizSystemProps {
  onBack: () => void;
}

type Phase = 'setup' | 'quiz' | 'result';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizSystem({ onBack }: QuizSystemProps) {
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);

  const { addQuizRecord, previousScore, totalQuizzes } = useEduStore();

  useEffect(() => {
    fetch('/data/edu/handbook-quiz.json')
      .then(r => r.json())
      .then(data => setAllQuestions(data.questions))
      .catch(() => {});
  }, []);

  const startQuiz = useCallback((count: number, chapter?: string) => {
    let pool = allQuestions;
    if (chapter) {
      pool = allQuestions.filter(q => q.chapter === chapter);
    }
    const shuffled = shuffle(pool).slice(0, count);
    // shuffle choices too
    const withShuffledChoices = shuffled.map(q => {
      const indices: number[] = q.choices.map((_: any, i: number) => i);
      const shuffledIndices = shuffle(indices) as number[];
      return {
        ...q,
        choices: shuffledIndices.map((i) => q.choices[i]),
        answer: shuffledIndices.indexOf(q.answer),
      };
    });
    setQuestions(withShuffledChoices);
    setCurrentIdx(0);
    setScore(0);
    setSelected(null);
    setAnswered(false);
    setPhase('quiz');
  }, [allQuestions]);

  const handleSelect = useCallback((choiceIdx: number) => {
    if (answered) return;
    setSelected(choiceIdx);
    setAnswered(true);
    if (choiceIdx === questions[currentIdx].answer) {
      setScore(prev => prev + 1);
    }
  }, [answered, questions, currentIdx]);

  const handleNext = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      const percent = Math.round((score / questions.length) * 100);
      addQuizRecord({ score, total: questions.length, percent });
      setPhase('result');
    }
  }, [currentIdx, questions.length, score, addQuizRecord]);

  const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const resultEmoji = useMemo(() => {
    if (percent >= 90) return '🏆';
    if (percent >= 70) return '👏';
    if (percent >= 50) return '💪';
    return '📚';
  }, [percent]);

  const growth = previousScore !== null ? percent - previousScore : null;

  if (phase === 'setup') {
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>실력 테스트</h1>
        </div>

        <div className={styles.quizSetup}>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(10)}>
            <div className={styles.quizOptionTitle}>🎯 빠른 테스트 (10문제)</div>
            <div className={styles.quizOptionDesc}>가볍게 실력 점검</div>
          </button>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(20)}>
            <div className={styles.quizOptionTitle}>📝 표준 시험 (20문제)</div>
            <div className={styles.quizOptionDesc}>본격적인 역량 평가</div>
          </button>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(allQuestions.length)}>
            <div className={styles.quizOptionTitle}>🔥 전체 도전 ({allQuestions.length}문제)</div>
            <div className={styles.quizOptionDesc}>모든 문제에 도전</div>
          </button>

          {totalQuizzes > 0 && (
            <>
              <div className={styles.heading}>시험 기록</div>
              <QuizHistory />
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>결과</h1>
        </div>

        <div className={styles.resultWrap}>
          <div className={styles.resultEmoji}>{resultEmoji}</div>
          <div className={styles.resultScore}>{percent}%</div>
          <div className={styles.resultLabel}>
            {questions.length}문제 중 {score}문제 정답
          </div>

          {growth !== null && growth !== 0 && (
            <div className={`${styles.resultGrowth} ${growth < 0 ? styles.resultDown : ''}`}>
              {growth > 0 ? `▲ ${growth}%p 향상!` : `▼ ${Math.abs(growth)}%p`}
            </div>
          )}

          {percent >= 90 && (
            <div className={styles.growthText}>대단해요! 거의 완벽합니다!</div>
          )}
          {percent >= 70 && percent < 90 && (
            <div className={styles.growthText}>잘하고 있어요! 조금만 더 복습하면 완벽!</div>
          )}
          {percent < 70 && (
            <div className={styles.growthText}>교재를 한 번 더 읽어보면 금방 올라요!</div>
          )}

          <div className={styles.resultActions}>
            <button type="button" className={`${styles.resultBtn} ${styles.resultBtnOutline}`} onClick={onBack}>
              홈으로
            </button>
            <button type="button" className={`${styles.resultBtn} ${styles.resultBtnPrimary}`} onClick={() => setPhase('setup')}>
              다시 도전
            </button>
          </div>
        </div>
      </div>
    );
  }

  // quiz phase
  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>문제 {currentIdx + 1}</h1>
      </div>

      <div className={styles.quizProgress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            /* STYLE-EXCEPTION: 동적 진행률 width는 CSS 변수 브릿지 불가 */
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className={styles.progressText}>{currentIdx + 1}/{questions.length}</span>
      </div>

      <div className={styles.questionCard}>
        <div className={styles.questionText}>{q.question}</div>
        <div className={styles.choiceList}>
          {q.choices.map((choice: string, i: number) => {
            let cls = styles.choiceBtn;
            if (answered) {
              cls += ` ${styles.choiceDisabled}`;
              if (i === q.answer) cls += ` ${styles.choiceCorrect}`;
              else if (i === selected) cls += ` ${styles.choiceWrong}`;
            }
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => handleSelect(i)}
                disabled={answered}
              >
                {i + 1}. {choice}
              </button>
            );
          })}
        </div>

        {answered && (
          <>
            <div className={styles.explanation}>
              {selected === q.answer ? '✅ 정답! ' : '❌ 오답. '}
              {q.explanation}
            </div>
            <button type="button" className={styles.nextBtn} onClick={handleNext}>
              {currentIdx < questions.length - 1 ? '다음 문제' : '결과 보기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function QuizHistory() {
  const { progress } = useEduStore();
  const recent = [...progress.quizHistory].reverse().slice(0, 10);
  const best = progress.quizHistory.length > 0
    ? Math.max(...progress.quizHistory.map(r => r.percent))
    : 0;

  return (
    <div className={styles.historyList}>
      {recent.map((record, i) => (
        <div key={i} className={styles.historyItem}>
          <span className={styles.historyDate}>
            {new Date(record.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </span>
          <span className={`${styles.historyScore} ${record.percent === best ? styles.historyHigh : ''}`}>
            {record.score}/{record.total} ({record.percent}%)
          </span>
        </div>
      ))}
    </div>
  );
}
