'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronRight, BookOpen, AlertTriangle,
  Mic, TrainFront, DoorOpen, Wrench,
  GraduationCap, Award, User, ClipboardList,
  RotateCcw, Clock,
} from 'lucide-react';
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
  onMyInfo: () => void;
}

const MENU_ITEMS = [
  { id: 'duty',     label: '근무절차', icon: ClipboardList, color: 'blue'   as const, action: 'chapter', target: 'ch1' },
  { id: 'announce', label: '안내방송', icon: Mic,           color: 'purple' as const, action: 'chapter', target: 'ch8' },
  { id: 'train',    label: '전동차',   icon: TrainFront,    color: 'green'  as const, action: 'chapter', target: 'ch2' },
  { id: 'door',     label: '출입문',   icon: DoorOpen,      color: 'amber'  as const, action: 'chapter', target: 'ch6' },
  { id: 'repair',   label: '고장조치', icon: Wrench,        color: 'red'    as const, action: 'chapter', target: 'ch5' },
  { id: 'edu',      label: '교육훈련', icon: GraduationCap, color: 'blue'   as const, action: 'study',   target: ''   },
  { id: 'exam',     label: '평가',     icon: Award,         color: 'green'  as const, action: 'quiz',    target: ''   },
  { id: 'myinfo',   label: '내 정보',  icon: User,          color: 'purple' as const, action: 'myinfo',  target: ''   },
] as const;

const ICON_COLOR_MAP = {
  blue:   styles.quickIconBlue,
  purple: styles.quickIconViolet,
  green:  styles.quickIconGreen,
  amber:  styles.quickIconWarn,
  red:    styles.quickIconRed,
} as const;

const ICON_BG_MAP = {
  blue:   styles.iconBgBlue,
  purple: styles.iconBgPurple,
  green:  styles.iconBgGreen,
  amber:  styles.iconBgAmber,
  red:    styles.iconBgRed,
} as const;

function scoreGradeClass(score: number): string {
  if (score >= 80) return styles.gradeGreen;
  if (score >= 60) return styles.gradeOrange;
  return styles.gradeRed;
}

export default function EduHome({ onBack, onStudy, onQuiz, onSection, onWrongReview, onWrongQuiz, onChapter, onMyInfo }: EduHomeProps) {
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

  const handleMenuClick = (item: typeof MENU_ITEMS[number]) => {
    switch (item.action) {
      case 'chapter': onChapter(item.target); break;
      case 'study':   onStudy(); break;
      case 'quiz':    onQuiz(); break;
      case 'myinfo':  onMyInfo(); break;
    }
  };

  return (
    <div className={styles.screen}>
      {/* ── 히어로 배너 ── */}
      <div className={styles.heroBanner}>
        <button type="button" className={styles.heroBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>

        <div className={styles.heroBadge}>LINE 5</div>
        <h1 className={styles.heroTitle}>Smart Crew<br />Assistant</h1>
        <p className={styles.heroSub}>SEOUL METRO · LINE 5</p>
        <p className={styles.heroDesc}>5호선 승무원을 위한 실무 교육 시스템</p>

        {/* 5호선 심볼 */}
        <div className={styles.heroSymbol}>
          <span className={styles.heroSymbolNum}>5</span>
          <span className={styles.heroSymbolLabel}>Line 5</span>
        </div>

        <p className={styles.heroTagline}>
          현장에서 필요한 모든 정보를<br />
          한 화면에서 <strong>빠르고 설계</strong>
        </p>

        {/* 5호선 노선 미니맵 */}
        <div className={styles.heroRoute}>
          <div className={styles.routeLine} />
          <div className={styles.routeStations}>
            {['방화', '여의도', '광화문', '왕십리', '마천'].map((st, i) => (
              <div key={st} className={styles.routeStation}>
                <div className={`${styles.routeDot} ${i === 0 ? styles.routeDotFirst : ''}`} />
                <span className={styles.routeStName}>{st}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.homeContent}>
        {/* ── 8개 아이콘 메뉴 그리드 ── */}
        <div className={styles.menuGrid8}>
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={styles.menuGridItem}
                onClick={() => handleMenuClick(item)}
              >
                <div className={`${styles.menuGridIcon} ${ICON_BG_MAP[item.color]}`}>
                  <Icon size={26} className={ICON_COLOR_MAP[item.color]} />
                </div>
                <span className={styles.menuGridLabel}>{item.label}</span>
              </button>
            );
          })}
        </div>

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

        {/* 오답 재시험 */}
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

        {/* 교재 학습 / 실력 테스트 카드 */}
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

        {/* 학습 현황 미니 요약 */}
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
