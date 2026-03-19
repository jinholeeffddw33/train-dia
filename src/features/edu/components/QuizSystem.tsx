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

/** 100점 만점 환산 */
function toScore100(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

/** 점수대별 등급 CSS 클래스 */
function scoreGradeClass(score100: number): string {
  if (score100 >= 80) return styles.gradeGreen;
  if (score100 >= 60) return styles.gradeOrange;
  return styles.gradeRed;
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
      const percent = toScore100(score, questions.length);
      addQuizRecord({ score, total: questions.length, percent });
      setPhase('result');
    }
  }, [currentIdx, questions.length, score, addQuizRecord]);

  const score100 = toScore100(score, questions.length);

  const resultEmoji = useMemo(() => {
    if (score100 >= 90) return '🏆';
    if (score100 >= 70) return '👏';
    if (score100 >= 50) return '💪';
    return '📚';
  }, [score100]);

  const resultMessage = useMemo(() => {
    if (score100 >= 90) return '대단해요! 거의 완벽합니다!';
    if (score100 >= 80) return '잘하고 있어요! 조금만 더!';
    if (score100 >= 70) return '좋은 성적이에요. 복습하면 더 오를 수 있어요!';
    if (score100 >= 50) return '절반 이상 맞혔어요. 교재를 다시 읽어보면 금방!';
    return '아직 공부가 필요해요. 교재부터 다시 시작해봐요!';
  }, [score100]);

  const growth = previousScore !== null ? score100 - previousScore : null;

  /* ── Setup Phase ── */
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

          <div className={styles.heading}>시험 기록</div>
          {totalQuizzes > 0 ? (
            <QuizHistory />
          ) : (
            <div className={styles.emptyHistory}>
              아직 시험 기록이 없어요. 위에서 시험을 선택해보세요!
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Result Phase ── */
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
          <div className={`${styles.resultScore} ${scoreGradeClass(score100)}`}>
            {score100}점
          </div>
          <div className={styles.resultLabel}>
            {questions.length}문제 중 {score}문제 정답
          </div>

          {growth !== null && growth !== 0 && (
            <div className={`${styles.resultGrowth} ${growth < 0 ? styles.resultDown : ''}`}>
              {growth > 0 ? `▲ ${growth}점 향상!` : `▼ ${Math.abs(growth)}점`}
            </div>
          )}

          <div className={styles.growthText}>{resultMessage}</div>

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

  /* ── Quiz Phase ── */
  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>문제 {currentIdx + 1}</h1>
        <span className={styles.quizScoreChip}>
          {score}/{currentIdx + (answered ? 1 : 0)}
        </span>
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
      {recent.map((record, i) => {
        const s = record.percent;
        const gradeClass = s >= 80 ? styles.gradeGreen : s >= 60 ? styles.gradeOrange : styles.gradeRed;
        return (
          <div key={i} className={styles.historyItem}>
            <span className={styles.historyDate}>
              {new Date(record.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
            <span className={styles.historyMeta}>
              {record.score}/{record.total}
            </span>
            <span className={`${styles.historyScore} ${gradeClass} ${record.percent === best ? styles.historyHigh : ''}`}>
              {record.percent}점
            </span>
          </div>
        );
      })}
    </div>
  );
}
