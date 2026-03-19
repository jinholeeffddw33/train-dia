'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import type { QuizMode } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface QuizSystemProps {
  onBack: () => void;
  initChapter?: string;
  wrongOnly?: boolean;
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

export default function QuizSystem({ onBack, initChapter, wrongOnly }: QuizSystemProps) {
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [phase, setPhase] = useState<Phase>(wrongOnly ? 'quiz' : 'setup');
  const [quizMode, setQuizMode] = useState<QuizMode>(wrongOnly ? 'wrong-only' : 'standard');
  const [quizChapterId, setQuizChapterId] = useState<string | undefined>(initChapter);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wrongInSession, setWrongInSession] = useState(0);
  const [resolvedInSession, setResolvedInSession] = useState(0);

  const {
    addQuizRecord, addWrongAnswer, resolveWrongAnswer,
    previousScore, totalQuizzes, unresolvedWrongs,
  } = useEduStore();

  // 오답 전용 모드: store에서 오답 문제를 퀴즈 형식으로 변환
  const startWrongOnlyQuiz = useCallback(() => {
    if (unresolvedWrongs.length === 0) return;
    const pool = unresolvedWrongs.map(w => ({
      id: w.questionId,
      chapter: w.chapterId,
      question: w.question,
      choices: w.choices,
      answer: w.answer,
      explanation: w.explanation,
      _isFromWrongNote: true,
    }));
    startQuizWith(pool, pool.length, 'wrong-only');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unresolvedWrongs]);

  useEffect(() => {
    if (wrongOnly) {
      // 오답 전용 모드: quiz JSON 불필요, store 데이터로 직접 시작
      if (unresolvedWrongs.length > 0) {
        startWrongOnlyQuiz();
      }
      return;
    }

    fetch('/data/edu/handbook-quiz.json')
      .then(r => r.json())
      .then(data => {
        setAllQuestions(data.questions);
        // 챕터 직진입 시 자동 시작
        if (initChapter && data.questions.length > 0) {
          const pool = data.questions.filter((q: any) => q.chapter === initChapter);
          if (pool.length > 0) {
            startQuizWith(pool, Math.min(pool.length, 20), 'chapter', initChapter);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQuizWith = useCallback((pool: any[], count: number, mode: QuizMode = 'standard', chapterId?: string) => {
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
    setResolvedInSession(0);
    setSelected(null);
    setAnswered(false);
    setQuizMode(mode);
    setQuizChapterId(chapterId);
    setPhase('quiz');
  }, []);

  const startQuiz = useCallback((count: number, mode: QuizMode = 'standard', chapter?: string) => {
    let pool = allQuestions;
    if (chapter) {
      pool = allQuestions.filter(q => q.chapter === chapter);
    }
    startQuizWith(pool, count, mode, chapter);
  }, [allQuestions, startQuizWith]);

  const handleSelect = useCallback((choiceIdx: number) => {
    if (answered) return;
    setSelected(choiceIdx);
    setAnswered(true);
    const q = questions[currentIdx];
    if (choiceIdx === q.answer) {
      setScore(prev => prev + 1);
      // 오답 재시험 모드에서 맞힌 문제는 resolved 처리
      if (q._isFromWrongNote) {
        resolveWrongAnswer(q.id);
        setResolvedInSession(prev => prev + 1);
      }
    } else {
      setWrongInSession(prev => prev + 1);
      // 오답 재시험 모드가 아닌 경우에만 오답노트에 추가
      if (!q._isFromWrongNote) {
        addWrongAnswer({
          questionId: q.id,
          question: q.question,
          choices: q.originalChoices,
          answer: q.originalAnswer,
          selected: q.originalChoices.indexOf(q.choices[choiceIdx]),
          explanation: q.explanation,
          chapter: CHAPTER_LABELS[q.chapter] ?? q.chapter,
          chapterId: q.chapter,
        });
      }
    }
  }, [answered, questions, currentIdx, addWrongAnswer, resolveWrongAnswer]);

  const handleNext = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      const percent = toScore100(score, questions.length);
      addQuizRecord({
        score, total: questions.length, percent,
        mode: quizMode,
        chapterId: quizChapterId,
      });
      setPhase('result');
    }
  }, [currentIdx, questions.length, score, addQuizRecord, quizMode, quizChapterId]);

  const score100 = toScore100(score, questions.length);

  const resultMessage = useMemo(() => {
    if (quizMode === 'wrong-only') {
      if (score100 === 100) return '오답을 모두 정복했습니다.';
      if (score100 >= 80) return '대부분 보완되었습니다. 남은 문제를 한번 더 확인하세요.';
      return '오답 교재를 다시 확인하고 재도전하세요.';
    }
    if (score100 >= 90) return '충분히 숙달되었습니다.';
    if (score100 >= 80) return '양호합니다. 취약 부분만 보완하세요.';
    if (score100 >= 70) return '복습이 필요합니다. 오답 교재를 확인하세요.';
    if (score100 >= 50) return '관련 교재를 다시 학습하세요.';
    return '기본 내용부터 재학습이 필요합니다.';
  }, [score100, quizMode]);

  const growth = previousScore !== null ? score100 - previousScore : null;

  // 챕터별 문제 수
  const chapterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of allQuestions) {
      counts[q.chapter] = (counts[q.chapter] || 0) + 1;
    }
    return counts;
  }, [allQuestions]);

  /* ── 오답 전용 모드인데 문제 없음 ── */
  if (wrongOnly && unresolvedWrongs.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>오답 재시험</h1>
        </div>
        <div className={styles.emptyState}>
          미해결 오답이 없습니다. 시험을 먼저 풀어보세요.
        </div>
      </div>
    );
  }

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
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(10, 'quick')}>
            <div className={styles.quizOptionTitle}>빠른 테스트 (10문제)</div>
            <div className={styles.quizOptionDesc}>가볍게 실력 점검</div>
          </button>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(20, 'standard')}>
            <div className={styles.quizOptionTitle}>표준 시험 (20문제)</div>
            <div className={styles.quizOptionDesc}>실력 평가</div>
          </button>
          <button type="button" className={styles.quizOption} onClick={() => startQuiz(allQuestions.length, 'full')}>
            <div className={styles.quizOptionTitle}>전체 ({allQuestions.length}문제)</div>
            <div className={styles.quizOptionDesc}>전 범위 점검</div>
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
                onClick={() => startQuiz(cnt, 'chapter', chId)}
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
    const isWrongMode = quizMode === 'wrong-only';
    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>{isWrongMode ? '오답 재시험 결과' : '결과'}</h1>
        </div>

        <div className={styles.resultWrap}>
          <div className={`${styles.resultScore} ${scoreGradeClass(score100)}`}>
            {score100}점
          </div>
          <div className={styles.resultLabel}>
            {questions.length}문제 중 {score}문제 정답
            {isWrongMode && resolvedInSession > 0 && ` · ${resolvedInSession}문제 해결됨`}
            {!isWrongMode && wrongInSession > 0 && ` · ${wrongInSession}문제 오답노트 저장`}
          </div>

          {!isWrongMode && growth !== null && growth !== 0 && (
            <div className={`${styles.resultGrowth} ${growth < 0 ? styles.resultDown : ''}`}>
              {growth > 0 ? `이전 대비 +${growth}점` : `이전 대비 ${growth}점`}
            </div>
          )}

          <div className={styles.resultMessage}>{resultMessage}</div>

          <div className={styles.resultActions}>
            <button type="button" className={`${styles.resultBtn} ${styles.resultBtnOutline}`} onClick={onBack}>
              돌아가기
            </button>
            {isWrongMode ? (
              <button
                type="button"
                className={`${styles.resultBtn} ${styles.resultBtnPrimary}`}
                onClick={() => {
                  // 미해결 오답으로 재시작
                  startWrongOnlyQuiz();
                }}
              >
                다시 풀기
              </button>
            ) : (
              <button type="button" className={`${styles.resultBtn} ${styles.resultBtnPrimary}`} onClick={() => setPhase('setup')}>
                다시 도전
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Quiz ── */
  const q = questions[currentIdx];
  if (!q) return null;

  const isWrongMode = quizMode === 'wrong-only';

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>
          {isWrongMode ? '오답 재시험' : `문제 ${currentIdx + 1}`}
        </h1>
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

  const modeLabel = (mode?: QuizMode) => {
    switch (mode) {
      case 'quick': return '빠른';
      case 'full': return '전체';
      case 'chapter': return '챕터';
      case 'wrong-only': return '오답';
      default: return '표준';
    }
  };

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
              {modeLabel(record.mode)} · {record.score}/{record.total}
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
