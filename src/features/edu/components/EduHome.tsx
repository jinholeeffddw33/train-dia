'use client';

import { ArrowLeft, ChevronRight, BookOpen, AlertTriangle, Radio, GitCompare, Bookmark, RotateCcw } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

interface EduHomeProps {
  onBack: () => void;
  onStudy: () => void;
  onQuiz: () => void;
  onSection?: (sectionId: string) => void;
  onWrongReview?: () => void;
  onChapter?: (chapterId: string) => void;
}

function scoreGradeClass(score: number): string {
  if (score >= 80) return styles.gradeGreen;
  if (score >= 60) return styles.gradeOrange;
  return styles.gradeRed;
}

export default function EduHome({ onBack, onStudy, onQuiz, onSection, onWrongReview, onChapter }: EduHomeProps) {
  const {
    readCount, totalQuizzes, bestScore, latestScore, previousScore,
    streak, avgScore, progress, wrongCount,
  } = useEduStore();

  const growth = latestScore !== null && previousScore !== null
    ? latestScore - previousScore
    : null;

  const hasLastRead = !!progress.lastReadSection;
  const hasWrong = wrongCount > 0;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>스마트승무원</h1>
      </div>

      <div className={styles.homeContent}>
        {/* 이어보기 */}
        {hasLastRead && (
          <button
            type="button"
            className={styles.resumeCard}
            onClick={() => onSection?.(progress.lastReadSection!)}
          >
            <div className={styles.resumeLabel}>이어서 보기</div>
            <div className={styles.resumeSection}>{progress.lastReadSection}</div>
            <ChevronRight size={18} className={styles.resumeArrow} />
          </button>
        )}

        {/* 오답 다시 풀기 */}
        {hasWrong && (
          <button
            type="button"
            className={styles.wrongReviewCard}
            onClick={() => onWrongReview?.()}
          >
            <RotateCcw size={18} />
            <span>틀린 문제 다시 풀기 ({wrongCount}문제)</span>
            <ChevronRight size={16} className={styles.resumeArrow} />
          </button>
        )}

        {/* 바로가기 */}
        <div className={styles.quickGrid}>
          <button type="button" className={styles.quickCard} onClick={() => onChapter?.('ch5')}>
            <AlertTriangle size={22} className={styles.quickIconWarn} />
            <span className={styles.quickLabel}>이례사항</span>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => onChapter?.('ch8')}>
            <Radio size={22} className={styles.quickIconBlue} />
            <span className={styles.quickLabel}>방송문안</span>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => onChapter?.('ch3')}>
            <GitCompare size={22} className={styles.quickIconViolet} />
            <span className={styles.quickLabel}>차종 비교</span>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => onChapter?.('ch4')}>
            <Bookmark size={22} className={styles.quickIconGreen} />
            <span className={styles.quickLabel}>기지/주박</span>
          </button>
        </div>

        {/* 메뉴 */}
        <button type="button" className={styles.menuCard} onClick={onStudy}>
          <div className={`${styles.menuIcon} ${styles.menuIconStudy}`}>
            <BookOpen size={24} />
          </div>
          <div className={styles.menuInfo}>
            <div className={styles.menuTitle}>교재 학습</div>
            <div className={styles.menuDesc}>핸드북 전체 · 검색 · 즐겨찾기</div>
          </div>
          <ChevronRight size={20} className={styles.menuArrow} />
        </button>

        <button type="button" className={styles.menuCard} onClick={onQuiz}>
          <div className={`${styles.menuIcon} ${styles.menuIconQuiz}`}>
            <AlertTriangle size={24} />
          </div>
          <div className={styles.menuInfo}>
            <div className={styles.menuTitle}>실력 테스트</div>
            <div className={styles.menuDesc}>
              {totalQuizzes > 0
                ? `최근 ${latestScore}점 · ${totalQuizzes}회 응시`
                : '역량 점검 · 오답 분석'}
            </div>
          </div>
          <ChevronRight size={20} className={styles.menuArrow} />
        </button>

        {/* 학습 현황 — 하단 */}
        {(totalQuizzes > 0 || readCount > 0) && (
          <>
            <div className={styles.sectionDivider}>학습 현황</div>
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{readCount}</div>
                <div className={styles.statLabel}>학습 섹션</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{totalQuizzes}</div>
                <div className={styles.statLabel}>시험 횟수</div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statValue} ${totalQuizzes > 0 ? scoreGradeClass(bestScore) : ''}`}>
                  {totalQuizzes > 0 ? `${bestScore}점` : '-'}
                </div>
                <div className={styles.statLabel}>최고 점수</div>
              </div>
            </div>

            {growth !== null && (
              <div className={`${styles.growthBanner} ${growth < 0 ? styles.growthBannerDown : ''}`}>
                <div className={styles.growthText}>
                  {growth > 0
                    ? `이전보다 ${growth}점 향상`
                    : growth === 0
                      ? '이전과 동일한 점수'
                      : `이전보다 ${Math.abs(growth)}점 하락 · 복습 추천`}
                </div>
                {streak >= 2 && (
                  <div className={styles.streakBadge}>{streak}일 연속 학습</div>
                )}
              </div>
            )}

            {totalQuizzes > 0 && avgScore > 0 && (
              <div className={styles.avgBanner}>
                <span className={`${styles.avgScore} ${scoreGradeClass(avgScore)}`}>{avgScore}점</span>
                <span className={styles.avgLabel}>평균 · {totalQuizzes}회</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
