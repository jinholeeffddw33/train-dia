'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, BookOpen, Trophy, Sparkles, RotateCcw } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useQuizProgressStore } from '@/stores/quizProgress';
import styles from './QuizPlayer.module.css';

interface Question {
  id: string;
  page: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface QuizData {
  questions: Question[];
}

interface Props {
  title: string;
  url: string;
  onClose: () => void;
  onViewBody: (page: number, article?: number) => void;
}

const LABELS = ['①', '②', '③', '④'];

/** 해설/문제에서 "제N조"를 찾아 조문 번호 추출 (본문에서 정확한 조문으로 점프하기 위함) */
function articleNoOf(q: { explanation?: string; question?: string }): number | undefined {
  const m = /제\s*(\d+)\s*조/.exec(q.explanation ?? '') ?? /제\s*(\d+)\s*조/.exec(q.question ?? '');
  return m ? parseInt(m[1], 10) : undefined;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function QuizPlayer({ title, url, onClose, onViewBody }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  // 이어풀기: 재진입 시 저장된 지점부터 시작 → 그 문제에서만 안내 배너 표시
  const [resumedFrom, setResumedFrom] = useState(0);

  const setProgress = useQuizProgressStore((s) => s.setProgress);
  const clearProgress = useQuizProgressStore((s) => s.clearProgress);

  useHistoryBack('quiz-player', onClose, true);

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((r) => r.json())
      .then((data: QuizData) => {
        if (!active) return;
        // 문제 순서는 그대로, 보기만 셔플하여 위치 편향 제거
        const prepared = data.questions.map((q) => {
          const order = shuffle(q.options.map((_, i) => i));
          const newOptions = order.map((i) => q.options[i]);
          const newAnswer = order.indexOf(q.answer);
          return { ...q, options: newOptions, answer: newAnswer };
        });
        setQuestions(prepared);
        // 저장된 진행 위치가 있으면 그 지점부터 이어풀기 (범위 벗어나면 처음부터)
        const saved = useQuizProgressStore.getState().getProgress(url);
        if (saved > 0 && saved < prepared.length) {
          setCurrent(saved);
          setResumedFrom(saved);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [url]);

  const total = questions.length;
  const q = questions[current];
  const progress = total === 0 ? 0 : Math.round(((current + (revealed ? 1 : 0)) / total) * 100);

  const handleSelect = useCallback((idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
  }, [revealed]);

  const handleNext = useCallback(() => {
    if (!revealed) return;
    if (current + 1 >= total) {
      // 끝까지 완료 → 저장된 진행 위치 삭제 (다음엔 처음부터)
      clearProgress(url);
      setFinished(true);
      return;
    }
    const nextIdx = current + 1;
    // 다음 문제로 이동하며 진행 위치 저장 (중간에 나가도 여기서 이어풀기)
    setProgress(url, nextIdx);
    setCurrent(nextIdx);
    setSelected(null);
    setRevealed(false);
    setResumedFrom(0);
  }, [revealed, current, total, url, setProgress, clearProgress]);

  // 처음부터 다시 풀기 (저장된 진행 위치 삭제 + 보기 재셔플)
  const restartFromStart = useCallback(() => {
    clearProgress(url);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setFinished(false);
    setResumedFrom(0);
    setQuestions((prev) => prev.map((qq) => {
      const order = shuffle(qq.options.map((_, i) => i));
      const newOptions = order.map((i) => qq.options[i]);
      const newAnswer = order.indexOf(qq.answer);
      return { ...qq, options: newOptions, answer: newAnswer };
    }));
  }, [url, clearProgress]);

  const handleRestart = restartFromStart;

  if (loading) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${title} 문제`}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.title}>{title} 문제</h2>
        </div>
        <div className={styles.loading}>문제를 불러오는 중...</div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${title} 문제`}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.title}>{title} 문제</h2>
        </div>
        <div className={styles.loading}>아직 등록된 문제가 없어요</div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${title} 문제 완료`}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.title}>{title} 문제</h2>
        </div>
        <div className={styles.completion}>
          <div className={styles.completionIcon}>
            <Trophy size={42} strokeWidth={2.2} />
          </div>
          <h3 className={styles.completionTitle}>모든 문제를 풀었어요</h3>
          <p className={styles.completionDesc}>
            총 {total}문제 풀이 완료.<br />
            틀린 문제는 본문을 다시 확인해보세요.
          </p>
          <div className={styles.completionBtnRow}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              나가기
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleRestart}>
              다시 풀기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${title} 문제`}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.title}>{title} 문제</h2>
        <span className={styles.progress}>{current + 1} / {total}</span>
      </div>

      <div className={styles.progressBar}>
        {/* STYLE-EXCEPTION: 진행률 % 동적 값 */}
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.body}>
        {resumedFrom > 0 && current === resumedFrom && (
          <div className={styles.resumeBanner}>
            <span className={styles.resumeText}>
              지난번에 풀던 {current + 1}번 문제부터 이어서 풀어요
            </span>
            <button
              type="button"
              className={styles.resumeReset}
              onClick={restartFromStart}
            >
              <RotateCcw size={14} />
              <span>처음부터</span>
            </button>
          </div>
        )}

        <div className={styles.questionCard}>
          <span className={styles.questionLabel}>문제 {current + 1}</span>
          <p className={styles.questionText}>{q.question}</p>
        </div>

        <div className={styles.options} role="radiogroup">
          {q.options.map((opt, idx) => {
            const isSelected = selected === idx;
            const isCorrectOption = idx === q.answer;
            let optionClass = styles.option;
            if (!revealed && isSelected) optionClass += ` ${styles.optionSelected}`;
            if (revealed && isCorrectOption) optionClass += ` ${styles.optionCorrect}`;
            if (revealed && isSelected && !isCorrectOption) optionClass += ` ${styles.optionWrong}`;
            return (
              <button
                key={idx}
                type="button"
                className={optionClass}
                onClick={() => handleSelect(idx)}
                disabled={revealed}
                role="radio"
                aria-checked={isSelected}
              >
                <span className={styles.optionMark}>{LABELS[idx]}</span>
                <span className={styles.optionText}>{opt}</span>
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className={styles.explanationCard}>
            <div className={styles.explanationLabel}>
              <Sparkles size={14} />
              <span>{selected === q.answer ? '정답입니다' : '아쉽네요. 정답 해설을 확인하세요'}</span>
            </div>
            <p className={styles.explanationText}>{q.explanation}</p>
            <button
              type="button"
              className={styles.bodyRefBtn}
              onClick={() => onViewBody(q.page, articleNoOf(q))}
            >
              <BookOpen size={14} />
              <span>{articleNoOf(q) ? `본문 제${articleNoOf(q)}조 보기` : `본문 ${q.page}쪽 보기`}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={handleNext}
          disabled={!revealed}
        >
          {current + 1 >= total ? '결과 보기' : '다음 문제'}
        </button>
      </div>
    </div>
  );
}
