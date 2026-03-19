'use client';

import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

interface EduHomeProps {
  onBack: () => void;
  onStudy: () => void;
  onQuiz: () => void;
}

function scoreGradeClass(score: number): string {
  if (score >= 80) return styles.gradeGreen;
  if (score >= 60) return styles.gradeOrange;
  return styles.gradeRed;
}

export default function EduHome({ onBack, onStudy, onQuiz }: EduHomeProps) {
  const { readCount, totalQuizzes, bestScore, latestScore, previousScore, streak, avgScore } = useEduStore();

  const growth = latestScore !== null && previousScore !== null
    ? latestScore - previousScore
    : null;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>스마트승무원</h1>
      </div>

      <div className={styles.homeContent}>
        {/* 통계 */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{readCount}</div>
            <div className={styles.statLabel}>학습한 섹션</div>
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

        {/* 성장 피드백 */}
        {growth !== null && (
          <div className={`${styles.growthBanner} ${growth < 0 ? styles.growthBannerDown : ''}`}>
            <div className={styles.growthText}>
              {growth > 0
                ? `이전보다 ${growth}점 올랐어요! 계속 성장 중!`
                : growth === 0
                  ? '이전과 동일한 점수예요. 한 번 더 도전!'
                  : `이전보다 ${Math.abs(growth)}점 내렸어요. 복습하면 금방 올라요!`}
            </div>
            {streak >= 2 && (
              <div className={styles.streakBadge}>🔥 {streak}일 연속 학습 중</div>
            )}
          </div>
        )}

        {totalQuizzes > 0 && avgScore > 0 && (
          <div className={styles.avgBanner}>
            <span className={`${styles.avgScore} ${scoreGradeClass(avgScore)}`}>{avgScore}점</span>
            <span className={styles.avgLabel}>평균 · {totalQuizzes}회 시험</span>
          </div>
        )}

        {/* 메뉴 */}
        <button type="button" className={styles.menuCard} onClick={onStudy}>
          <div className={`${styles.menuIcon} ${styles.menuIconStudy}`}>📖</div>
          <div className={styles.menuInfo}>
            <div className={styles.menuTitle}>교재 학습</div>
            <div className={styles.menuDesc}>신규기관사 핸드북 읽기</div>
          </div>
          <ChevronRight size={20} className={styles.menuArrow} />
        </button>

        <button type="button" className={styles.menuCard} onClick={onQuiz}>
          <div className={`${styles.menuIcon} ${styles.menuIconQuiz}`}>🎯</div>
          <div className={styles.menuInfo}>
            <div className={styles.menuTitle}>실력 테스트</div>
            <div className={styles.menuDesc}>객관식 퀴즈로 역량 점검</div>
          </div>
          <ChevronRight size={20} className={styles.menuArrow} />
        </button>
      </div>
    </div>
  );
}
