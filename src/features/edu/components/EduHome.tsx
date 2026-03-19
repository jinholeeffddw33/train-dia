'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, BookOpen, AlertTriangle, Radio, GitCompare, ClipboardList, RotateCcw, Clock } from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EduHomeProps {
  onBack: () => void;
  onStudy: () => void;
  onQuiz: () => void;
  onSection: (sectionId: string) => void;
  onWrongReview: () => void;
  onWrongQuiz: () => void;
  onChapter: (chapterId: string) => void;
}

function scoreGradeClass(score: number): string {
  if (score >= 80) return styles.gradeGreen;
  if (score >= 60) return styles.gradeOrange;
  return styles.gradeRed;
}

export default function EduHome({ onBack, onStudy, onQuiz, onSection, onWrongReview, onWrongQuiz, onChapter }: EduHomeProps) {
  const {
    readCount, totalQuizzes, bestScore, latestScore, previousScore,
    streak, avgScore, progress, wrongCount, unresolvedWrongCount,
  } = useEduStore();

  const [docMeta, setDocMeta] = useState<{ version?: string; updatedAt?: string } | null>(null);

  // handbook.json에서 메타 정보만 로드
  useEffect(() => {
    fetch('/data/edu/handbook.json')
      .then(r => r.json())
      .then(data => {
        setDocMeta({
          version: data.version,
          updatedAt: data.updatedAt,
        });
      })
      .catch(() => {});
  }, []);

  const growth = latestScore !== null && previousScore !== null
    ? latestScore - previousScore
    : null;

  const hasLastRead = !!progress.lastReadSectionId;
  const hasUnresolvedWrong = unresolvedWrongCount > 0;

  // 최근 본 섹션 (이어보기 제외, 최대 5개)
  const recentList = progress.recentSections
    .filter(id => id !== progress.lastReadSectionId)
    .slice(0, 5);

  // allSections는 handbook 데이터 로드 후에만 사용 가능하므로,
  // 섹션 이름은 ID를 표시하고 DocumentViewer에서 resolve
  // → 대안: handbook 데이터를 로드해서 이름 매핑
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/data/edu/handbook.json')
      .then(r => r.json())
      .then(data => {
        const names: Record<string, string> = {};
        for (const ch of data.chapters) {
          for (const sec of ch.sections) {
            names[sec.id] = sec.title;
          }
        }
        setSectionNames(names);
      })
      .catch(() => {});
  }, []);

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
            onClick={() => onSection(progress.lastReadSectionId!)}
          >
            <div className={styles.resumeLabel}>이어서 보기</div>
            <div className={styles.resumeSection}>
              {sectionNames[progress.lastReadSectionId!] ?? progress.lastReadSectionId}
            </div>
            <ChevronRight size={18} className={styles.resumeArrow} />
          </button>
        )}

        {/* 오답 재시험 — 진짜 오답 퀴즈 모드로 진입 */}
        {hasUnresolvedWrong && (
          <button
            type="button"
            className={styles.wrongReviewCard}
            onClick={onWrongQuiz}
          >
            <RotateCcw size={18} />
            <span>오답 다시 풀기 ({unresolvedWrongCount}문제)</span>
            <ChevronRight size={16} className={styles.resumeArrow} />
          </button>
        )}

        {/* 바로가기 — 5개: 근무절차(ch1) + 이례사항(ch5) + 방송문안(ch8) + 차종비교(ch3) + 기지/주박(ch4) */}
        <div className={styles.quickGrid}>
          <button type="button" className={styles.quickCard} onClick={() => onChapter('ch1')}>
            <ClipboardList size={22} className={styles.quickIconBlue} />
            <span className={styles.quickLabel}>근무절차</span>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => onChapter('ch5')}>
            <AlertTriangle size={22} className={styles.quickIconWarn} />
            <span className={styles.quickLabel}>이례사항</span>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => onChapter('ch8')}>
            <Radio size={22} className={styles.quickIconBlue} />
            <span className={styles.quickLabel}>방송문안</span>
          </button>
          <button type="button" className={styles.quickCard} onClick={() => onChapter('ch3')}>
            <GitCompare size={22} className={styles.quickIconViolet} />
            <span className={styles.quickLabel}>차종비교</span>
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
                : '역량 점검 · 챕터별 시험'}
            </div>
          </div>
          <ChevronRight size={20} className={styles.menuArrow} />
        </button>

        {wrongCount > 0 && (
          <button type="button" className={styles.menuCard} onClick={onWrongReview}>
            <div className={`${styles.menuIcon} ${styles.menuIconWrong}`}>
              <RotateCcw size={24} />
            </div>
            <div className={styles.menuInfo}>
              <div className={styles.menuTitle}>오답노트</div>
              <div className={styles.menuDesc}>
                {unresolvedWrongCount > 0
                  ? `미해결 ${unresolvedWrongCount}문제 · 전체 ${wrongCount}문제`
                  : `전체 ${wrongCount}문제 (모두 해결)`}
              </div>
            </div>
            <ChevronRight size={20} className={styles.menuArrow} />
          </button>
        )}

        {/* 최근 본 섹션 */}
        {recentList.length > 0 && (
          <>
            <div className={styles.sectionDivider}>최근 본 항목</div>
            <div className={styles.recentList}>
              {recentList.map(secId => (
                <button
                  key={secId}
                  type="button"
                  className={styles.recentItem}
                  onClick={() => onSection(secId)}
                >
                  <Clock size={14} className={styles.recentIcon} />
                  <span className={styles.recentTitle}>
                    {sectionNames[secId] ?? secId}
                  </span>
                  <ChevronRight size={14} className={styles.resumeArrow} />
                </button>
              ))}
            </div>
          </>
        )}

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
                      : `이전보다 ${Math.abs(growth)}점 하락`}
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

        {/* 교육자료 기준일 */}
        {docMeta?.version && (
          <div className={styles.docVersionBanner}>
            교육자료 기준: {docMeta.version}
            {docMeta.updatedAt && ` · 최종 개정 ${docMeta.updatedAt}`}
          </div>
        )}
      </div>
    </div>
  );
}
