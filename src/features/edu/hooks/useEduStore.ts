import { useState, useCallback, useEffect } from 'react';

/* ── 타입 ── */

export type QuizMode = 'quick' | 'standard' | 'full' | 'chapter' | 'wrong-only' | 'level' | 'area';

export interface QuizRecord {
  date: string;       // ISO
  score: number;      // 정답 수
  total: number;      // 총 문제 수
  percent: number;    // 100점 만점 환산
  mode: QuizMode;
  chapterId?: string;
  solvedAt: string;   // ISO
}

export interface WrongAnswer {
  questionId: string;
  question: string;
  choices: string[];
  answer: number;       // 정답 인덱스
  selected: number;     // 사용자가 선택한 인덱스
  explanation: string;
  chapter: string;      // 챕터 레이블
  chapterId: string;    // 챕터 ID (ch1, ch2...)
  date: string;         // ISO
  resolved?: boolean;   // 오답 재시험에서 맞힌 경우
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
  lastReadSectionId?: string;                   // 마지막으로 읽던 섹션 ID
  lastReadChapter?: string;                     // 마지막으로 읽던 챕터 ID
  lastActiveAt?: string;                        // 마지막 활동 시각 ISO
  recentSections: string[];                     // 최근 본 섹션 ID (최대 10개, 최신이 앞)
  streak: number;
  lastStudyDate?: string;                       // YYYY-MM-DD
  /** 등급 해금 상태: levelScores[level] = 최고점수 (70+ or 80+ 이면 다음 레벨 해금) */
  levelScores: Record<number, number>;
}

const STORAGE_KEY = 'train-dia-edu-progress';
const CURRENT_VERSION = 4;
const MAX_RECENT_SECTIONS = 10;

const EMPTY_PROGRESS: EduProgress = {
  version: CURRENT_VERSION,
  readSections: {},
  bookmarks: [],
  quizHistory: [],
  wrongAnswers: [],
  recentSections: [],
  streak: 0,
  levelScores: {},
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
  // v2 → v3: add bookmarks, wrongAnswers
  if (!data.version || data.version < 3) {
    data = {
      ...data,
      version: 3,
      bookmarks: data.bookmarks ?? [],
      wrongAnswers: data.wrongAnswers ?? [],
      lastReadChapter: data.lastReadChapter ?? undefined,
    };
  }
  // v3 → v4: add lastReadSectionId, lastActiveAt, recentSections, quizHistory 확장, wrongAnswers.chapterId
  if (data.version < 4) {
    // lastReadSection → lastReadSectionId (rename)
    const lastReadSectionId = data.lastReadSectionId ?? data.lastReadSection ?? undefined;

    // quizHistory 마이그레이션: mode, solvedAt 추가
    const quizHistory = (data.quizHistory ?? []).map((r: any) => ({
      ...r,
      mode: r.mode ?? 'standard',
      solvedAt: r.solvedAt ?? r.date ?? new Date().toISOString(),
    }));

    // wrongAnswers 마이그레이션: chapterId, resolved 추가
    const wrongAnswers = (data.wrongAnswers ?? []).map((w: any) => ({
      ...w,
      chapterId: w.chapterId ?? '',
      resolved: w.resolved ?? false,
    }));

    data = {
      ...data,
      version: CURRENT_VERSION,
      lastReadSectionId,
      lastActiveAt: data.lastActiveAt ?? undefined,
      recentSections: data.recentSections ?? [],
      quizHistory,
      wrongAnswers,
    };

    // 이전 필드 정리
    delete data.lastReadSection;
  }

  // v4+: levelScores 기본값
  if (!data.levelScores) {
    data.levelScores = {};
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

function updateStreak(prev: EduProgress): { streak: number; lastStudyDate: string } {
  const today = getTodayStr();
  if (prev.lastStudyDate === today) {
    return { streak: prev.streak, lastStudyDate: today };
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const streak = prev.lastStudyDate === yStr ? prev.streak + 1 : 1;
  return { streak, lastStudyDate: today };
}

function pushRecent(prev: string[], sectionId: string): string[] {
  const filtered = prev.filter(id => id !== sectionId);
  return [sectionId, ...filtered].slice(0, MAX_RECENT_SECTIONS);
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

      const { streak, lastStudyDate } = updateStreak(prev);
      return {
        ...prev,
        readSections: { ...prev.readSections, [sectionId]: updated },
        lastReadSectionId: sectionId,
        lastReadChapter: chapterId ?? prev.lastReadChapter,
        lastActiveAt: new Date().toISOString(),
        recentSections: pushRecent(prev.recentSections, sectionId),
        streak,
        lastStudyDate,
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
  const addQuizRecord = useCallback((record: Omit<QuizRecord, 'date' | 'solvedAt'>) => {
    setProgress(prev => {
      const now = new Date().toISOString();
      const { streak, lastStudyDate } = updateStreak(prev);
      return {
        ...prev,
        quizHistory: [...prev.quizHistory, { ...record, date: now, solvedAt: now }],
        lastActiveAt: now,
        streak,
        lastStudyDate,
      };
    });
  }, []);

  /* ── 오답노트 ── */
  const addWrongAnswer = useCallback((wrong: Omit<WrongAnswer, 'date' | 'resolved'>) => {
    setProgress(prev => {
      // 같은 문제 중복 시 최신으로 교체
      const filtered = prev.wrongAnswers.filter(w => w.questionId !== wrong.questionId);
      return {
        ...prev,
        wrongAnswers: [...filtered, { ...wrong, date: new Date().toISOString(), resolved: false }],
      };
    });
  }, []);

  const removeWrongAnswer = useCallback((questionId: string) => {
    setProgress(prev => ({
      ...prev,
      wrongAnswers: prev.wrongAnswers.filter(w => w.questionId !== questionId),
    }));
  }, []);

  /** 오답 재시험에서 맞힌 문제를 resolved 처리 */
  const resolveWrongAnswer = useCallback((questionId: string) => {
    setProgress(prev => ({
      ...prev,
      wrongAnswers: prev.wrongAnswers.map(w =>
        w.questionId === questionId ? { ...w, resolved: true } : w
      ),
    }));
  }, []);

  /* ── 등급 점수 기록 ── */
  const updateLevelScore = useCallback((level: number, percent: number) => {
    setProgress(prev => {
      const prevBest = prev.levelScores[level] ?? 0;
      if (percent <= prevBest) return prev;
      return {
        ...prev,
        levelScores: { ...prev.levelScores, [level]: percent },
      };
    });
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

  const unresolvedWrongs = progress.wrongAnswers.filter(w => !w.resolved);

  return {
    progress,
    markSectionRead,
    toggleBookmark,
    isBookmarked,
    addQuizRecord,
    addWrongAnswer,
    removeWrongAnswer,
    resolveWrongAnswer,
    bestScore,
    latestScore,
    previousScore,
    avgScore,
    totalQuizzes: progress.quizHistory.length,
    readCount: Object.keys(progress.readSections).length,
    streak: progress.streak,
    wrongCount: progress.wrongAnswers.length,
    unresolvedWrongCount: unresolvedWrongs.length,
    unresolvedWrongs,
    updateLevelScore,
    levelScores: progress.levelScores,
  };
}
