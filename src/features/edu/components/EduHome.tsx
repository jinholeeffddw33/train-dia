'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronRight,
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
  onChapters: (chapterIds: string[]) => void;
  onMyInfo: () => void;
}

const MENU_ITEMS = [
  { id: 'duty',     label: '근무절차', icon: ClipboardList, color: 'blue'   as const, action: 'chapters' as const, targets: ['ch1', 'ch4'] },
  { id: 'announce', label: '안내방송', icon: Mic,           color: 'purple' as const, action: 'chapters' as const, targets: ['ch8'] },
  { id: 'train',    label: '전동차',   icon: TrainFront,    color: 'green'  as const, action: 'chapters' as const, targets: ['ch2', 'ch3', 'ch6'] },
  { id: 'door',     label: '출입문',   icon: DoorOpen,      color: 'amber'  as const, action: 'coming'   as const, targets: [] },
  { id: 'repair',   label: '고장조치', icon: Wrench,        color: 'red'    as const, action: 'chapters' as const, targets: ['ch5', 'ch7'] },
  { id: 'edu',      label: '교육훈련', icon: GraduationCap, color: 'blue'   as const, action: 'coming'   as const, targets: [] },
  { id: 'exam',     label: '평가',     icon: Award,         color: 'green'  as const, action: 'quiz'     as const, targets: [] },
  { id: 'myinfo',   label: '내 정보',  icon: User,          color: 'purple' as const, action: 'myinfo'   as const, targets: [] },
];

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

export default function EduHome({ onBack, onStudy, onQuiz, onSection, onWrongReview, onWrongQuiz, onChapter, onChapters, onMyInfo }: EduHomeProps) {
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
      case 'chapters':
        onChapters([...item.targets]);
        break;
      case 'quiz':    onQuiz(); break;
      case 'myinfo':  onMyInfo(); break;
      case 'coming':  break; // 준비 중
    }
  };

  return (
    <div className={styles.screen}>
      {/* ── 히어로 배너 ── */}
      <div className={styles.heroBanner}>
        <button type="button" className={styles.heroBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className={styles.heroHaze} />

        <div className={styles.heroBadge}>LINE 5</div>
        <h1 className={styles.heroTitle}>Smart Crew Assistant</h1>
        <p className={styles.heroSub}>SEOUL METRO · LINE 5</p>
        <p className={styles.heroDesc}>5호선 승무원을 위한 실무 교육 시스템</p>

        {/* 열차 비주얼 */}
        <div className={styles.heroVisual}>
          {/* 스카이라인 */}
          <div className={styles.heroSkyline}>
            <div className={styles.skyBar1} />
            <div className={styles.skyBar2} />
            <div className={styles.skyBar3} />
            <div className={styles.skyBar4} />
            <div className={styles.skyBar5} />
            <div className={styles.skyBar6} />
          </div>

          {/* 다리 */}
          <div className={styles.heroBridge}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={styles.bridgePillar} style={{ left: `${i * 33}%` }} />
            ))}
          </div>

          {/* 노선 곡선 SVG */}
          <svg viewBox="0 0 380 140" className={styles.heroLineSvg} fill="none">
            <path
              d="M-10 88C48 94 84 103 130 102C177 100 216 72 263 73C307 74 346 92 392 86"
              stroke="url(#heroLineGlow)"
              strokeWidth="18"
              strokeLinecap="round"
              opacity="0.18"
            />
            <path
              d="M-10 88C48 94 84 103 130 102C177 100 216 72 263 73C307 74 346 92 392 86"
              stroke="url(#heroLineMain)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="heroLineMain" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a855f7" />
                <stop offset="0.45" stopColor="#7c3aed" />
                <stop offset="1" stopColor="#d8b4fe" />
              </linearGradient>
              <linearGradient id="heroLineGlow" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c084fc" />
                <stop offset="1" stopColor="#e9d5ff" />
              </linearGradient>
            </defs>
          </svg>

          {/* 열차 */}
          <div className={styles.heroTrain}>
            <div className={styles.trainBody}>
              <div className={styles.trainNose} />
              <div className={styles.trainWindow} />
              <div className={styles.trainLight} />
              <div className={styles.trainLight} />
              <div className={styles.trainBumper} />
              <div className={styles.trainStripe} />
              <div className={styles.trainWindows}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={styles.trainWin} />
                ))}
              </div>
            </div>
          </div>

          {/* 역 점 */}
          <div className={`${styles.heroStationDot} ${styles.heroStationDot1}`} />
          <div className={`${styles.heroStationDot} ${styles.heroStationDot2}`} />
          <div className={`${styles.heroStationDot} ${styles.heroStationDot3}`} />

          {/* 5번 배지 */}
          <div className={styles.heroBigBadge}>
            <div className={styles.heroBigNum}>5</div>
            <span className={styles.heroBigLabel}>Line 5</span>
          </div>
        </div>

        {/* 메시지 */}
        <p className={styles.heroMessage}>
          현장에서 필요한 모든 정보를<br />
          한 화면에서 <span className={styles.heroAccent}>빠르고 쉽게</span>
        </p>

        {/* 하단 노선도 */}
        <div className={styles.heroBottom}>
          <div className={styles.heroBottomGlow} />
          <svg viewBox="0 0 380 60" className={styles.heroWaveSvg} fill="none">
            <path
              d="M0 30C45 18 87 14 126 18C166 22 205 37 252 35C300 33 335 20 380 13V60H0V30Z"
              fill="url(#heroBottomWave)"
              opacity="0.6"
            />
            <path
              d="M0 39C41 29 83 25 129 28C171 31 214 43 259 41C307 39 343 29 380 22"
              stroke="#c4b5fd"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="heroBottomWave" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f3e8ff" />
                <stop offset="1" stopColor="#ede9fe" />
              </linearGradient>
            </defs>
          </svg>

          <div className={styles.heroStations}>
            {[
              { ko: '방화', en: 'Banghwa' },
              { ko: '여의도', en: 'Yeouido' },
              { ko: '광화문', en: 'Gwanghwamun' },
              { ko: '왕십리', en: 'Wangsimni' },
              { ko: '마천', en: 'Macheon' },
            ].map((st, i) => (
              <div key={st.ko} className={styles.heroSt}>
                <div className={i === 0 ? styles.heroStDotFirst : styles.heroStDot}>
                  {i === 0 && '5'}
                </div>
                <span className={styles.heroStKo}>{st.ko}</span>
                <span className={styles.heroStEn}>{st.en}</span>
              </div>
            ))}
          </div>

          <div className={styles.heroLogo}>
            <div className={styles.heroLogoCircle}>S</div>
            <div className={styles.heroLogoText}>
              <div className={styles.heroLogoKo}>서울교통공사</div>
              <div className={styles.heroLogoEn}>Seoul Metro</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.homeContent}>
        {/* ── 8개 아이콘 메뉴 그리드 ── */}
        <div className={styles.menuGrid8}>
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const isComing = item.action === 'coming';
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.menuGridItem} ${isComing ? styles.menuGridItemDisabled : ''}`}
                onClick={() => handleMenuClick(item)}
                disabled={isComing}
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

        {/* 오답 재시험 바로가기 (오답 있을 때만) */}
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
