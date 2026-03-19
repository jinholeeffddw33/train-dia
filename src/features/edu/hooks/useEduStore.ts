import { useState, useCallback, useEffect } from 'react';

/* ── 타입 ── */
export interface QuizRecord {
  date: string;       // ISO
  score: number;      // 정답 수
  total: number;      // 총 문제 수
  percent: number;    // 100점 만점 환산
  chapter?: string;   // 챕터별이면 챕터 ID
}

export interface WrongAnswer {
  questionId: string;
  question: string;
  choices: string[];
  answer: number;       // 정답 인덱스
  selected: number;     // 사용자가 선택한 인덱스
  explanation: string;
  chapter: string;
  date: string;         // ISO
}

export interface ReadRecord {
  lastRead: string;   // YYYY-MM-DD
  count: number;
}

export interface EduProgress {
  version: number;                              // 스키마 버전
  readSections: Record<string, ReadRecord>;     // 섹션ID → 읽은 기록
  bookmarks: string[];                          // 즐겨찾기 섹션 ID
  quizHistory: QuizRecord[];                    // 퀴즈 기록
  wrongAnswers: WrongAnswer[];                  // 오답노트
  lastReadSection?: string;                     // 마지막으로 읽던 섹션
  lastReadChapter?: string;                     // 마지막으로 읽던 챕터
  streak: number;
  lastStudyDate?: string;                       // YYYY-MM-DD
}

const STORAGE_KEY = 'train-dia-edu-progress';
const CURRENT_VERSION = 3;

const EMPTY_PROGRESS: EduProgress = {
  version: CURRENT_VERSION,
  readSections: {},
  bookmarks: [],
  quizHistory: [],
  wrongAnswers: [],
  streak: 0,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function migrateProgress(data: any): EduProgress {
  // v1: readSections was string[]
  if (Array.isArray(data.readSections)) {
    const migrated: Record<string, ReadRecord> = {};
    for (const id of data.readSections) {
      migrated[id] = { lastRead: data.lastStudyDate ?? getTodayStr(), count: 1 };
    }
    data = { ...data, readSections: migrated };
  }
  // v2 → v3: add bookmarks, wrongAnswers, version, lastReadChapter
  if (!data.version || data.version < 3) {
    data = {
      ...data,
      version: CURRENT_VERSION,
      bookmarks: data.bookmarks ?? [],
      wrongAnswers: data.wrongAnswers ?? [],
      lastReadChapter: data.lastReadChapter ?? undefined,
    };
  }
  return data as EduProgress;
}

function loadProgress(): EduProgress {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateProgress(JSON.parse(raw));
  } catch { /* ignore */ }
  return EMPTY_PROGRESS;
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

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  /* ── 읽기 ── */
  const markSectionRead = useCallback((sectionId: string, chapterId?: string) => {
    setProgress(prev => {
      const today = getTodayStr();
      const existing = prev.readSections[sectionId];
      const updated: ReadRecord = existing
        ? { lastRead: today, count: existing.count + 1 }
        : { lastRead: today, count: 1 };

      let streak = prev.streak;
      if (prev.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        streak = prev.lastStudyDate === yStr ? prev.streak + 1 : 1;
      }
      return {
        ...prev,
        readSections: { ...prev.readSections, [sectionId]: updated },
        lastReadSection: sectionId,
        lastReadChapter: chapterId ?? prev.lastReadChapter,
        streak,
        lastStudyDate: today,
      };
    });
  }, []);

  /* ── 북마크 ── */
  const toggleBookmark = useCallback((sectionId: string) => {
    setProgress(prev => {
      const has = prev.bookmarks.includes(sectionId);
      return {
        ...prev,
        bookmarks: has
          ? prev.bookmarks.filter(id => id !== sectionId)
          : [...prev.bookmarks, sectionId],
      };
    });
  }, []);

  const isBookmarked = useCallback((sectionId: string) => {
    return progress.bookmarks.includes(sectionId);
  }, [progress.bookmarks]);

  /* ── 퀴즈 ── */
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

  /* ── 오답노트 ── */
  const addWrongAnswer = useCallback((wrong: Omit<WrongAnswer, 'date'>) => {
    setProgress(prev => {
      // 같은 문제 중복 시 최신으로 교체
      const filtered = prev.wrongAnswers.filter(w => w.questionId !== wrong.questionId);
      return {
        ...prev,
        wrongAnswers: [...filtered, { ...wrong, date: new Date().toISOString() }],
      };
    });
  }, []);

  const removeWrongAnswer = useCallback((questionId: string) => {
    setProgress(prev => ({
      ...prev,
      wrongAnswers: prev.wrongAnswers.filter(w => w.questionId !== questionId),
    }));
  }, []);

  /* ── 파생값 ── */
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
    toggleBookmark,
    isBookmarked,
    addQuizRecord,
    addWrongAnswer,
    removeWrongAnswer,
    bestScore,
    latestScore,
    previousScore,
    avgScore,
    totalQuizzes: progress.quizHistory.length,
    readCount: Object.keys(progress.readSections).length,
    streak: progress.streak,
    wrongCount: progress.wrongAnswers.length,
  };
}
