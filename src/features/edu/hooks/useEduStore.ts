import { useState, useCallback, useEffect } from 'react';

/* ── 타입 ── */
export interface QuizRecord {
  date: string;       // ISO
  score: number;      // 정답 수
  total: number;      // 총 문제 수
  percent: number;    // 정답률
  chapter?: string;   // 챕터별이면 챕터 ID
}

export interface EduProgress {
  readSections: string[];        // 읽은 섹션 ID 목록
  quizHistory: QuizRecord[];     // 퀴즈 기록
  lastReadSection?: string;      // 마지막으로 읽던 섹션
  streak: number;                // 연속 학습 일수
  lastStudyDate?: string;        // 마지막 학습 날짜 (YYYY-MM-DD)
}

const STORAGE_KEY = 'train-dia-edu-progress';

function loadProgress(): EduProgress {
  if (typeof window === 'undefined') {
    return { readSections: [], quizHistory: [], streak: 0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { readSections: [], quizHistory: [], streak: 0 };
}

function saveProgress(p: EduProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function useEduStore() {
  const [progress, setProgress] = useState<EduProgress>(loadProgress);

  // sync to localStorage
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const markSectionRead = useCallback((sectionId: string) => {
    setProgress(prev => {
      if (prev.readSections.includes(sectionId)) {
        return { ...prev, lastReadSection: sectionId };
      }
      const today = getTodayStr();
      let streak = prev.streak;
      if (prev.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        streak = prev.lastStudyDate === yStr ? prev.streak + 1 : 1;
      }
      return {
        ...prev,
        readSections: [...prev.readSections, sectionId],
        lastReadSection: sectionId,
        streak,
        lastStudyDate: today,
      };
    });
  }, []);

  const addQuizRecord = useCallback((record: Omit<QuizRecord, 'date'>) => {
    setProgress(prev => {
      const today = getTodayStr();
      let streak = prev.streak;
      if (prev.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        streak = prev.lastStudyDate === yStr ? prev.streak + 1 : 1;
      }
      return {
        ...prev,
        quizHistory: [...prev.quizHistory, { ...record, date: new Date().toISOString() }],
        streak,
        lastStudyDate: today,
      };
    });
  }, []);

  const bestScore = progress.quizHistory.length > 0
    ? Math.max(...progress.quizHistory.map(r => r.percent))
    : 0;

  const latestScore = progress.quizHistory.length > 0
    ? progress.quizHistory[progress.quizHistory.length - 1].percent
    : null;

  const previousScore = progress.quizHistory.length > 1
    ? progress.quizHistory[progress.quizHistory.length - 2].percent
    : null;

  const avgScore = progress.quizHistory.length > 0
    ? Math.round(progress.quizHistory.reduce((s, r) => s + r.percent, 0) / progress.quizHistory.length)
    : 0;

  return {
    progress,
    markSectionRead,
    addQuizRecord,
    bestScore,
    latestScore,
    previousScore,
    avgScore,
    totalQuizzes: progress.quizHistory.length,
    readCount: progress.readSections.length,
    streak: progress.streak,
  };
}
