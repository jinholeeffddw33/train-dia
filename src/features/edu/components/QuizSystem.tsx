'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface QuizSystemProps {
  onBack: () => void;
  initChapter?: string;
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

function toScore100(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function scoreGradeClass(score100: number): string {
  if (score100 >= 80) return styles.gradeGreen;
  if (score100 >= 60) return styles.gradeOrange;
  return styles.gradeRed;
}

/** 챕터 ID → 짧은 이름 */
const CHAPTER_LABELS: Record<string, string> = {
  ch1: '근무작업절차',
  ch2: '전동차 일반',
  ch3: '차종 비교',
  ch4: '기지/주박',
  ch5: '이례사항',
  ch6: '한줄노트',
  ch7: '사고사례',
  ch8: '방송문안',
};

export default function QuizSystem({ onBack, initChapter }: QuizSystemProps) {
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wrongInSession, setWrongInSession] = useState(0);

  const { addQuizRecord, addWrongAnswer, previousScore, totalQuizzes } = useEduStore();

  useEffect(() => {
    fetch('/data/edu/handbook-quiz.json')
      .then(r => r.json())
      .then(data => {
        setAllQuestions(data.questions);
        // 챕터 직진입 시 자동 시작
        if (initChapter && data.questions.length > 0) {
          const pool = data.questions.filter((q: any) => q.chapter === initChapter);
          if (pool.length > 0) {
            startQuizWith(pool, Math.min(pool.length, 20));
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQuizWith = useCallback((pool: any[], count: number) => {
    const shuffled = shuffle(pool).slice(0, count);
    const withShuffledChoices = shuffled.map(q => {
      const indices: number[] = q.choices.map((_: any, i: number) => i);
      const shuffledIndices = shuffle(indices) as number[];
      return {
        ...q,
        originalChoices: q.choices,
        choices: shuffledIndices.map((i) => q.choices[i]),
        answer: shuffledIndices.indexOf(q.answer),
        originalAnswer: q.answer,
      };
    });
    setQuestions(withShuffledChoices);
    setCurrentIdx(0);
    setScore(0);
    setWrongInSession(0);
    setSelected(null);
    setAnswered(false);
    setPhase('quiz');
  }, []);

  const startQuiz = useCallback((count: number, chapter?: string) => {
    let pool = allQuestions;
    if (chapter) {
      pool = allQuestions.filter(q => q.chapter === chapter);
    }
    startQuizWith(pool, count);
  }, [allQuestions, startQuizWith]);

  const handleSelect = useCallback((choiceIdx: number) => {
    if (answered) return;
    setSelected(choiceIdx);
    setAnswered(true);
    const q = questions[currentIdx];
    if (choiceIdx === q.answer) {
      setScore(prev => prev + 1);
    } else {
      setWrongInSession(prev => prev + 1);
      // 오답 저장
      addWrongAnswer({
        questionId: q.id,
        question: q.question,
        choices: q.originalChoices,
        answer: q.originalAnswer,
        selected: q.originalChoices.indexOf(q.choices[choiceIdx]),
        explanation: q.explanation,
        chapter: CHAPTER_LABELS[q.chapter] ?? q.chapter,
      });
    }
  }, [answered, questions, currentIdx, addWrongAnswer]);

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

  const resultMessage = useMemo(() => {
    if (score100 >= 90) return '거의 완벽합니다.';
    if (score100 >= 80) return '잘하고 있습니다. 조금만 더 보완하세요.';
    if (score100 >= 70) return '복습하면 충분히 올릴 수 있습니다.';
    if (score100 >= 50) return '교재를 다시 읽어보세요.';
    return '기초부터 다시 학습이 필요합니다.';
  }, [score100]);

  const growth = previousScore !== null ? score100 - previousScore : null;

  // 챕터별 문제 수
  const chapterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of allQuestions) {
      counts[q.chapter] = (counts[q.chapter] || 0) + 1;
    }
    return counts;
  }, [allQuestions]);

  /* ── Setup ── */
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
          <div className={styles.sectionDivider}>전체 시험</div>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(10)}>
            <div className={styles.quizOptionTitle}>빠른 테스트 (10문제)</div>
            <div className={styles.quizOptionDesc}>가볍게 실력 점검</div>
          </button>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(20)}>
            <div className={styles.quizOptionTitle}>표준 시험 (20문제)</div>
            <div className={styles.quizOptionDesc}>본격적인 역량 평가</div>
          </button>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(allQuestions.length)}>
            <div className={styles.quizOptionTitle}>전체 도전 ({allQuestions.length}문제)</div>
            <div className={styles.quizOptionDesc}>모든 문제에 도전</div>
          </button>

          {/* 챕터별 퀴즈 */}
          <div className={styles.sectionDivider}>챕터별 시험</div>
          {Object.entries(CHAPTER_LABELS).map(([chId, label]) => {
            const cnt = chapterCounts[chId] || 0;
            if (cnt === 0) return null;
            return (
              <button
                key={chId}
                type="button"
                className={styles.quizOption}
                onClick={() => startQuiz(cnt, chId)}
              >
                <div className={styles.quizOptionTitle}>{label}</div>
                <div className={styles.quizOptionDesc}>{cnt}문제</div>
              </button>
            );
          })}

          <div className={styles.sectionDivider}>시험 기록</div>
          {totalQuizzes > 0 ? (
            <QuizHistory />
          ) : (
            <div className={styles.emptyHistory}>
              아직 시험 기록이 없습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Result ── */
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
          <div className={`${styles.resultScore} ${scoreGradeClass(score100)}`}>
            {score100}점
          </div>
          <div className={styles.resultLabel}>
            {questions.length}문제 중 {score}문제 정답
            {wrongInSession > 0 && ` · ${wrongInSession}문제 오답노트에 저장됨`}
          </div>

          {growth !== null && growth !== 0 && (
            <div className={`${styles.resultGrowth} ${growth < 0 ? styles.resultDown : ''}`}>
              {growth > 0 ? `▲ ${growth}점 향상` : `▼ ${Math.abs(growth)}점`}
            </div>
          )}

          <div className={styles.resultMessage}>{resultMessage}</div>

          <div className={styles.resultActions}>
            <button type="button" className={`${styles.resultBtn} ${styles.resultBtnOutline}`} onClick={onBack}>
              돌아가기
            </button>
            <button type="button" className={`${styles.resultBtn} ${styles.resultBtnPrimary}`} onClick={() => setPhase('setup')}>
              다시 도전
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Quiz ── */
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
            /* STYLE-EXCEPTION: 동적 진행률 */
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
              {selected === q.answer ? '정답. ' : '오답. '}
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
