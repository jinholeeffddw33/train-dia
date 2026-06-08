'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Shield, Crown, Lock, Check, BookOpen, AlertCircle } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useBonsaiStore } from '@/stores/bonsai';
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

/* ── 등급 정의 ── */
interface LevelDef {
  id: number;
  name: string;
  color: string;
  passScore: number;
  description: string;
}

interface AreaDef {
  id: string;
  name: string;
  chapters: string[];
  level: number;
}

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

/** 등급 색상 CSS 클래스 */
function levelColorClass(color: string): string {
  switch (color) {
    case 'green': return styles.levelGreen;
    case 'blue': return styles.levelBlue;
    case 'amber': return styles.levelAmber;
    case 'red': return styles.levelRed;
    default: return '';
  }
}

/** 뱃지 아이콘 — 방패+별 */
function LevelBadge({ level, size = 24 }: { level: LevelDef; size?: number }) {
  const isMaster = level.id === 4;
  const Icon = isMaster ? Crown : Shield;
  const stars = Math.min(level.id - 1, 3);
  return (
    <span className={`${styles.levelBadge} ${levelColorClass(level.color)}`}>
      <Icon size={size} />
      {stars > 0 && (
        <span className={styles.levelStars}>{'★'.repeat(stars)}</span>
      )}
    </span>
  );
}

/** 현재 등급 계산 */
function getCurrentLevel(levelScores: Record<number, number>, levels: LevelDef[]): LevelDef {
  let current = levels[0];
  for (let i = 0; i < levels.length - 1; i++) {
    const bestScore = levelScores[levels[i].id] ?? 0;
    if (bestScore >= levels[i].passScore) {
      current = levels[i + 1];
    } else break;
  }
  return current;
}

/** 해당 레벨이 해금되었는지 */
function isLevelUnlocked(levelId: number, levelScores: Record<number, number>, levels: LevelDef[]): boolean {
  if (levelId === 1) return true;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].id === levelId) {
      // 이전 레벨이 통과되었는지 확인
      const prevLevel = levels[i - 1];
      if (!prevLevel) return true;
      return (levelScores[prevLevel.id] ?? 0) >= prevLevel.passScore;
    }
  }
  return false;
}

/** 해당 레벨이 통과되었는지 */
function isLevelPassed(levelId: number, levelScores: Record<number, number>, levels: LevelDef[]): boolean {
  const level = levels.find(l => l.id === levelId);
  if (!level) return false;
  return (levelScores[levelId] ?? 0) >= level.passScore;
}

/** 영역 이름 맵 */
const AREA_LABELS: Record<string, string> = {};

/** 규정 시험 목록 (training.json과 동기화) */
interface RegulationDef {
  id: string;
  title: string;
  quizUrl: string;
  totalQuestions: number;
  shortName: string;
}

const REGULATIONS: RegulationDef[] = [
  { id: 'operation-rules',        title: '운전취급규정',           shortName: '운전취급', quizUrl: '/data/edu/regulations/operation-rules-quiz.json',        totalQuestions: 268 },
  { id: 'crew-management-rules',  title: '승무원지도운용내규',     shortName: '승무원',   quizUrl: '/data/edu/regulations/crew-management-rules-quiz.json',  totalQuestions: 64 },
  { id: 'operating-staff-rules',  title: '운전관계직원업무내규',   shortName: '운전직원', quizUrl: '/data/edu/regulations/operating-staff-rules-quiz.json',  totalQuestions: 104 },
  { id: 'depot-operation-rules',  title: '차량기지운전취급내규',   shortName: '차량기지', quizUrl: '/data/edu/regulations/depot-operation-rules-quiz.json',  totalQuestions: 126 },
  { id: 'safety-record-rules',    title: '운전무사고성적심사규정', shortName: '무사고',   quizUrl: '/data/edu/regulations/safety-record-rules-quiz.json',    totalQuestions: 26 },
  { id: 'detail-operation-rules', title: '운전취급세부요령',       shortName: '세부요령', quizUrl: '/data/edu/regulations/detail-operation-rules-quiz.json', totalQuestions: 28 },
];

/** 규정 wrongAnswer의 chapterId 프리픽스 */
const REG_CHAPTER_PREFIX = 'reg::';

/** 규정 raw 문제(options/answer) → 통합 스키마(choices/answer) */
interface RawRegQuestion {
  id: string;
  page?: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}
function normalizeRegQuestion(q: RawRegQuestion, reg: RegulationDef) {
  return {
    id: `${reg.id}::${q.id}`,
    chapter: reg.id,
    area: reg.id,
    level: 0,
    page: q.page,
    question: q.question,
    choices: q.options,
    answer: q.answer,
    explanation: q.explanation,
    _regulationTitle: reg.title,
  };
}

export default function QuizSystem({ onBack, initChapter, wrongOnly }: QuizSystemProps) {
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [levels, setLevels] = useState<LevelDef[]>([]);
  const [areas, setAreas] = useState<AreaDef[]>([]);
  const [phase, setPhase] = useState<Phase>(wrongOnly ? 'quiz' : 'setup');
  const [quizMode, setQuizMode] = useState<QuizMode>(wrongOnly ? 'wrong-only' : 'standard');
  const [quizLevelId, setQuizLevelId] = useState<number | undefined>();
  const [quizAreaId, setQuizAreaId] = useState<string | undefined>();
  const [quizRegulationId, setQuizRegulationId] = useState<string | undefined>();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wrongInSession, setWrongInSession] = useState(0);
  const [resolvedInSession, setResolvedInSession] = useState(0);

  const {
    addQuizRecord, addWrongAnswer, resolveWrongAnswer, updateLevelScore, updateRegulationScore,
    previousScore, totalQuizzes, unresolvedWrongs, levelScores, regulationScores,
  } = useEduStore();

  // 퀴즈/결과 화면에서 뒤로가기 → setup 화면으로 복귀
  const goSetup = useCallback(() => setPhase('setup'), []);
  useHistoryBack('quiz-phase', goSetup, phase !== 'setup');

  // 오답 전용 모드
  const startWrongOnlyQuiz = useCallback(() => {
    if (unresolvedWrongs.length === 0) return;
    const pool = unresolvedWrongs.map(w => ({
      id: w.questionId, chapter: w.chapterId,
      question: w.question, choices: w.choices,
      answer: w.answer, explanation: w.explanation,
      _isFromWrongNote: true,
    }));
    startQuizWith(pool, pool.length, 'wrong-only');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unresolvedWrongs]);

  useEffect(() => {
    if (wrongOnly) {
      if (unresolvedWrongs.length > 0) startWrongOnlyQuiz();
      return;
    }
    fetch('/data/edu/handbook-quiz.json')
      .then(r => r.json())
      .then(data => {
        setAllQuestions(data.questions);
        setLevels(data.levels ?? []);
        setAreas(data.areas ?? []);
        // 영역 이름 맵 구성
        for (const a of (data.areas ?? [])) {
          AREA_LABELS[a.id] = a.name;
        }
        if (initChapter && data.questions.length > 0) {
          const pool = data.questions.filter((q: any) => q.chapter === initChapter);
          if (pool.length > 0) startQuizWith(pool, Math.min(pool.length, 20), 'chapter');
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQuizWith = useCallback((pool: any[], count: number, mode: QuizMode = 'standard') => {
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
    setPhase('quiz');
  }, []);

  const startLevelQuiz = useCallback((levelId: number) => {
    const pool = allQuestions.filter(q => q.level === levelId);
    setQuizLevelId(levelId);
    setQuizAreaId(undefined);
    startQuizWith(pool, Math.min(pool.length, 30), 'level');
  }, [allQuestions, startQuizWith]);

  const startAreaQuiz = useCallback((areaId: string) => {
    const pool = allQuestions.filter(q => q.area === areaId);
    setQuizAreaId(areaId);
    setQuizLevelId(undefined);
    setQuizRegulationId(undefined);
    startQuizWith(pool, pool.length, 'area');
  }, [allQuestions, startQuizWith]);

  const startRegulationQuiz = useCallback(async (reg: RegulationDef) => {
    try {
      const res = await fetch(reg.quizUrl);
      const data: { questions: RawRegQuestion[] } = await res.json();
      const pool = data.questions.map((q) => normalizeRegQuestion(q, reg));
      if (pool.length === 0) return;
      setQuizRegulationId(reg.id);
      setQuizLevelId(undefined);
      setQuizAreaId(undefined);
      startQuizWith(pool, pool.length, 'regulation');
    } catch {
      // 무시 (loading 실패 시 setup에 머무름)
    }
  }, [startQuizWith]);

  const handleSelect = useCallback((choiceIdx: number) => {
    if (answered) return;
    setSelected(choiceIdx);
    setAnswered(true);
    const q = questions[currentIdx];
    if (choiceIdx === q.answer) {
      setScore(prev => prev + 1);
      if (q._isFromWrongNote) {
        resolveWrongAnswer(q.id);
        setResolvedInSession(prev => prev + 1);
      }
    } else {
      setWrongInSession(prev => prev + 1);
      if (!q._isFromWrongNote) {
        const isReg = !!q._regulationTitle;
        addWrongAnswer({
          questionId: q.id, question: q.question,
          choices: q.originalChoices, answer: q.originalAnswer,
          selected: q.originalChoices.indexOf(q.choices[choiceIdx]),
          explanation: q.explanation,
          chapter: isReg ? q._regulationTitle : (AREA_LABELS[q.area] ?? q.chapter),
          chapterId: isReg ? `${REG_CHAPTER_PREFIX}${q.chapter}` : q.chapter,
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
      addQuizRecord({ score, total: questions.length, percent, mode: quizMode });
      // 70점 이상 합격 시 분재 성장 (연료 공급)
      if (percent >= 70) {
        try { useBonsaiStore.getState().recordQuizPass(); } catch { /* ignore */ }
      }
      // 규정 시험 점수 저장
      if (quizMode === 'regulation' && quizRegulationId) {
        updateRegulationScore(quizRegulationId, score, questions.length);
      }
      // 등급 도전 모드일 때 점수 기록 + 서버 전송
      if (quizMode === 'level' && quizLevelId) {
        updateLevelScore(quizLevelId, percent);
        const level = levels.find(l => l.id === quizLevelId);
        if (level) {
          fetch('/api/edu/level-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              levelId: quizLevelId,
              levelName: level.name,
              score: percent,
              passed: percent >= level.passScore,
            }),
          }).catch(() => {});
        }
      }
      setPhase('result');
    }
  }, [currentIdx, questions.length, score, addQuizRecord, quizMode, quizLevelId, quizRegulationId, updateLevelScore, updateRegulationScore]);

  const nextBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (answered && nextBtnRef.current) {
      const timer = setTimeout(() => {
        nextBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [answered]);

  const score100 = toScore100(score, questions.length);

  const resultMessage = useMemo(() => {
    if (quizMode === 'wrong-only') {
      if (score100 === 100) return '오답을 모두 정복했습니다.';
      if (score100 >= 80) return '대부분 보완되었습니다.';
      return '오답 교재를 다시 확인하고 재도전하세요.';
    }
    if (quizMode === 'level' && quizLevelId) {
      const level = levels.find(l => l.id === quizLevelId);
      if (level && score100 >= level.passScore) {
        if (quizLevelId < 4) return `${level.name} 등급 통과! 다음 등급이 해금되었습니다.`;
        return '마스터기관사 등급 달성! 축하합니다.';
      }
      if (level) return `${level.passScore}점 이상이 필요합니다. 다시 도전하세요.`;
    }
    if (score100 >= 90) return '충분히 숙달되었습니다.';
    if (score100 >= 80) return '양호합니다. 취약 부분만 보완하세요.';
    if (score100 >= 70) return '복습이 필요합니다.';
    return '관련 교재를 다시 학습하세요.';
  }, [score100, quizMode, quizLevelId, levels]);

  const growth = previousScore !== null ? score100 - previousScore : null;

  // 영역별 문제 수
  const areaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of allQuestions) counts[q.area] = (counts[q.area] || 0) + 1;
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
        <div className={styles.emptyState}>미해결 오답이 없습니다.</div>
      </div>
    );
  }

  /* ── Setup ── */
  if (phase === 'setup') {
    const currentLevel = getCurrentLevel(levelScores, levels);

    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>실력 테스트</h1>
        </div>

        <div className={styles.quizSetup}>
          {/* 현재 등급 표시 */}
          {levels.length > 0 && (
            <div className={styles.currentLevelCard}>
              <LevelBadge level={currentLevel} size={28} />
              <div className={styles.currentLevelInfo}>
                <div className={styles.currentLevelName}>{currentLevel.name}</div>
                <div className={styles.currentLevelDesc}>{currentLevel.description}</div>
              </div>
            </div>
          )}

          {/* 등급 도전 */}
          <div className={styles.sectionDivider}>등급 도전</div>
          {levels.map(level => {
            const unlocked = isLevelUnlocked(level.id, levelScores, levels);
            const passed = isLevelPassed(level.id, levelScores, levels);
            const bestScore = levelScores[level.id] ?? 0;
            const qCount = allQuestions.filter(q => q.level === level.id).length;

            return (
              <button
                key={level.id}
                type="button"
                className={`${styles.levelCard} ${levelColorClass(level.color)} ${!unlocked ? styles.levelLocked : ''}`}
                disabled={!unlocked}
                onClick={() => unlocked && startLevelQuiz(level.id)}
              >
                <div className={styles.levelCardLeft}>
                  <LevelBadge level={level} size={22} />
                  <div className={styles.levelCardBody}>
                    <div className={styles.levelCardName}>{level.name}</div>
                    <div className={styles.levelCardDesc}>
                      {level.description} · {qCount}문제
                    </div>
                  </div>
                </div>
                <div className={styles.levelCardRight}>
                  {!unlocked && <Lock size={18} />}
                  {unlocked && passed && (
                    <span className={styles.levelPassBadge}>
                      <Check size={14} /> {bestScore}점
                    </span>
                  )}
                  {unlocked && !passed && bestScore > 0 && (
                    <span className={styles.levelScoreLabel}>{bestScore}점</span>
                  )}
                  {unlocked && !passed && bestScore === 0 && (
                    <span className={styles.levelGoLabel}>도전</span>
                  )}
                </div>
              </button>
            );
          })}

          {/* 영역별 연습 */}
          <div className={styles.sectionDivider}>영역별 연습</div>
          <div className={styles.areaGrid}>
            {areas.map(area => {
              const cnt = areaCounts[area.id] || 0;
              if (cnt === 0) return null;
              return (
                <button
                  key={area.id}
                  type="button"
                  className={styles.areaChip}
                  onClick={() => startAreaQuiz(area.id)}
                >
                  <span className={styles.areaChipName}>{area.name}</span>
                  <span className={styles.areaChipCount}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* 규정별 시험 */}
          <div className={styles.sectionDivider}>규정별 시험</div>
          <div className={styles.regulationList}>
            {REGULATIONS.map((reg) => {
              const rec = regulationScores[reg.id];
              const unresolved = unresolvedWrongs.filter(
                (w) => w.chapterId === `${REG_CHAPTER_PREFIX}${reg.id}`,
              ).length;
              const bestPercent = rec?.bestPercent ?? 0;
              const attempts = rec?.attempts ?? 0;
              const gradeClass = !rec ? '' : bestPercent >= 80 ? styles.gradeGreen : bestPercent >= 60 ? styles.gradeOrange : styles.gradeRed;
              return (
                <button
                  key={reg.id}
                  type="button"
                  className={styles.regulationCard}
                  onClick={() => startRegulationQuiz(reg)}
                >
                  <div className={styles.regulationCardIcon}>
                    <BookOpen size={22} />
                  </div>
                  <div className={styles.regulationCardBody}>
                    <div className={styles.regulationCardTitle}>{reg.title}</div>
                    <div className={styles.regulationCardMeta}>
                      <span>{reg.totalQuestions}문제</span>
                      {attempts > 0 && <span>· 도전 {attempts}회</span>}
                      {unresolved > 0 && (
                        <span className={styles.regulationCardWrong}>
                          <AlertCircle size={11} /> 오답 {unresolved}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.regulationCardRight}>
                    {rec ? (
                      <span className={`${styles.regulationCardScore} ${gradeClass}`}>{bestPercent}점</span>
                    ) : (
                      <span className={styles.regulationCardGo}>도전</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 시험 기록 */}
          <div className={styles.sectionDivider}>시험 기록</div>
          {totalQuizzes > 0 ? (
            <QuizHistory />
          ) : (
            <div className={styles.emptyHistory}>아직 시험 기록이 없습니다.</div>
          )}
        </div>
      </div>
    );
  }

  /* ── Result ── */
  if (phase === 'result') {
    const isWrongMode = quizMode === 'wrong-only';
    const isLevelMode = quizMode === 'level';
    const levelDef = isLevelMode && quizLevelId ? levels.find(l => l.id === quizLevelId) : null;
    const levelPassed = levelDef ? score100 >= levelDef.passScore : false;
    const isPerfect = score100 === 100;
    const RADIUS = 60;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    const ringColorClass = isPerfect
      ? styles.resultRingGold
      : score100 >= 80 ? styles.resultRingGreen
      : score100 >= 60 ? styles.resultRingAmber
      : styles.resultRingRed;

    const gradeLabel = isPerfect ? 'PERFECT' : score100 >= 80 ? '우수' : score100 >= 60 ? '보통' : '분발';
    const gradeLabelClass = isPerfect
      ? styles.resultGradePerfect
      : score100 >= 80 ? styles.resultGradeGood
      : score100 >= 60 ? styles.resultGradeOk
      : styles.resultGradeFail;

    return (
      <div className={styles.screen}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.topTitle}>
            {isWrongMode ? '오답 재시험 결과'
              : isLevelMode && levelDef ? `${levelDef.name} 결과`
              : quizMode === 'regulation' && quizRegulationId
                ? `${REGULATIONS.find((r) => r.id === quizRegulationId)?.shortName ?? '규정'} 결과`
                : '결과'}
          </h1>
        </div>

        <div className={styles.resultWrap}>
          {/* 등급 뱃지 (등급 도전 모드) */}
          {isLevelMode && levelDef && (
            <div className={styles.resultLevelBadge}>
              <LevelBadge level={levelDef} size={36} />
              {levelPassed && <span className={styles.resultLevelPass}>통과!</span>}
            </div>
          )}

          <ScoreRing
            score100={score100} radius={RADIUS} circumference={CIRCUMFERENCE}
            ringColorClass={ringColorClass} isPerfect={isPerfect}
          />

          <span className={`${styles.resultGradeLabel} ${gradeLabelClass}`}>{gradeLabel}</span>

          <div className={styles.resultStats}>
            <div className={styles.resultStatCard}>
              <span className={`${styles.resultStatValue} ${styles.resultStatValueGreen}`}>{score}</span>
              <span className={styles.resultStatLabel}>정답</span>
            </div>
            <div className={styles.resultStatCard}>
              <span className={`${styles.resultStatValue} ${styles.resultStatValueRed}`}>{questions.length - score}</span>
              <span className={styles.resultStatLabel}>오답</span>
            </div>
            <div className={styles.resultStatCard}>
              <span className={styles.resultStatValue}>{questions.length}</span>
              <span className={styles.resultStatLabel}>총 문제</span>
            </div>
          </div>

          <div className={styles.resultLabel}>
            {isWrongMode && resolvedInSession > 0 && `${resolvedInSession}문제 해결됨`}
            {!isWrongMode && wrongInSession > 0 && `${wrongInSession}문제 오답노트 저장`}
          </div>

          {!isWrongMode && growth !== null && growth !== 0 && (
            <div className={`${styles.resultGrowth} ${growth < 0 ? styles.resultDown : ''}`}>
              {growth > 0 ? `이전 대비 +${growth}점` : `이전 대비 ${growth}점`}
            </div>
          )}

          <div className={styles.resultMessage}>{resultMessage}</div>

          <div className={styles.resultActions}>
            <button type="button" className={`${styles.resultBtn} ${styles.resultBtnOutline}`} onClick={() => setPhase('setup')}>
              돌아가기
            </button>
            {isWrongMode ? (
              <button type="button" className={`${styles.resultBtn} ${styles.resultBtnPrimary}`} onClick={startWrongOnlyQuiz}>
                다시 풀기
              </button>
            ) : isLevelMode && quizLevelId ? (
              <button type="button" className={`${styles.resultBtn} ${styles.resultBtnPrimary}`} onClick={() => startLevelQuiz(quizLevelId)}>
                다시 도전
              </button>
            ) : quizMode === 'regulation' && quizRegulationId ? (
              <button type="button" className={`${styles.resultBtn} ${styles.resultBtnPrimary}`} onClick={() => {
                const reg = REGULATIONS.find((r) => r.id === quizRegulationId);
                if (reg) startRegulationQuiz(reg);
              }}>
                다시 도전
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
              if (i === q.answer) cls += ` ${styles.choiceCorrect}`;
              else if (i === selected) cls += ` ${styles.choiceWrong}`;
              else cls += ` ${styles.choiceDisabled}`;
            }
            return (
              <button key={i} type="button" className={cls} onClick={() => handleSelect(i)} disabled={answered}>
                {i + 1}. {choice}
              </button>
            );
          })}
        </div>

        {answered && (
          <>
            <div className={styles.explanation}>
              {selected === q.answer ? '정답. ' : '오답. '}{q.explanation}
            </div>
            <button ref={nextBtnRef} type="button" className={styles.nextBtn} onClick={handleNext}>
              {currentIdx < questions.length - 1 ? '다음 문제' : '결과 보기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** SVG 원형 프로그레스 */
function ScoreRing({ score100, radius, circumference, ringColorClass, isPerfect }: {
  score100: number; radius: number; circumference: number; ringColorClass: string; isPerfect: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const raf = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(raf); }, []);
  const offset = mounted ? circumference * (1 - score100 / 100) : circumference;
  return (
    <div className={`${styles.resultRing} ${isPerfect ? styles.resultRingPerfect : ''}`}>
      <svg className={styles.resultRingSvg} viewBox="0 0 140 140">
        <circle className={styles.resultRingBg} cx="70" cy="70" r={radius} />
        <circle className={`${styles.resultRingFg} ${ringColorClass}`} cx="70" cy="70" r={radius}
          strokeDasharray={circumference} strokeDashoffset={offset}
          /* STYLE-EXCEPTION: 동적 strokeDashoffset */
        />
      </svg>
      <div className={styles.resultRingCenter}>
        <span className={styles.resultRingScore}>{score100}</span>
        <span className={styles.resultRingUnit}>점</span>
      </div>
    </div>
  );
}

function QuizHistory() {
  const { progress } = useEduStore();
  const recent = [...progress.quizHistory].reverse().slice(0, 10);

  const modeLabel = (mode?: QuizMode) => {
    switch (mode) {
      case 'level': return '등급';
      case 'area': return '영역';
      case 'wrong-only': return '오답';
      default: return '시험';
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
            <span className={`${styles.historyScore} ${gradeClass}`}>{record.percent}점</span>
          </div>
        );
      })}
    </div>
  );
}
