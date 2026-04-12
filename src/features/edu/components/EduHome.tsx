'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronRight, X,
  Mic, TrainFront, DoorOpen, Wrench,
  GraduationCap, Award, User, ClipboardList,
  RotateCcw, Clock, GitCompareArrows, Play,
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
  onVideo: () => void;
  onTraining: () => void;
}

const MENU_ITEMS = [
  { id: 'duty',     label: '기본업무', icon: ClipboardList, color: 'blue'   as const, action: 'chapters' as const, targets: ['ch1', 'ch4'] },
  { id: 'announce', label: '안내방송', icon: Mic,           color: 'purple' as const, action: 'chapters' as const, targets: ['ch8', 'ch9', 'ch10'] },
  { id: 'train',    label: '전동차',   icon: TrainFront,    color: 'green'  as const, action: 'chapters' as const, targets: ['ch2', 'ch6'] },
  { id: 'repair',   label: '고장조치', icon: Wrench,        color: 'red'    as const, action: 'submenu'  as const, targets: [] },
  { id: 'roadmap',  label: '새내기',   icon: DoorOpen,      color: 'amber'  as const, action: 'roadmap'  as const, targets: [] },
  { id: 'edu',      label: '교육훈련', icon: GraduationCap, color: 'blue'   as const, action: 'training' as const, targets: [] },
  { id: 'exam',     label: '평가',     icon: Award,         color: 'green'  as const, action: 'quiz'     as const, targets: [] },
  { id: 'myinfo',   label: '내 정보',  icon: User,          color: 'purple' as const, action: 'myinfo'   as const, targets: [] },
];

// 3D 배경 위 흰색 아이콘 — 개별 색상 클래스 불필요
const ICON_COLOR_MAP = {
  blue:   '',
  purple: '',
  green:  '',
  amber:  '',
  red:    '',
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

export default function EduHome({ onBack, onStudy, onQuiz, onSection, onWrongReview, onWrongQuiz, onChapter, onChapters, onMyInfo, onVideo, onTraining }: EduHomeProps) {
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

  const [repairOpen, setRepairOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  const REPAIR_SUB = [
    { id: 'abb',      label: 'ABB\n전동차',     color: 'blue'   as const, targets: ['ch5a'],       coming: false },
    { id: 'woojin',   label: '우진\n전동차',     color: 'green'  as const, targets: ['ch5b'],       coming: false },
    { id: 'rotem',    label: '로템\n전동차',     color: 'amber'  as const, targets: ['ch5c'],       coming: false },
    { id: 'startup',  label: '출고 시\n고장',    color: 'red'    as const, targets: ['ch5e'],       coming: false },
    { id: 'critical', label: '우진\n중고장',     color: 'purple' as const, targets: ['ch5d'],       coming: false },
    { id: 'compare',  label: '전동차\n비교',     color: 'blue'   as const, targets: ['ch5'],        coming: false },
  ];

  const ROADMAP_STEPS = [
    { step: 1, label: '기본업무 익히기',      desc: '출근 후 해야 할 기본 절차', targets: ['ch1', 'ch4'], color: 'blue' as const },
    { step: 2, label: '전동차 기초 이해',     desc: '5호선 전동차 구조와 운전', targets: ['ch2'], color: 'green' as const },
    { step: 3, label: '안내방송·관제 통화',   desc: '방송 문안과 관제 보고 요령', targets: ['ch8', 'ch9', 'ch10'], color: 'purple' as const },
    { step: 4, label: '출고 시 고장조치',     desc: '출고 전 발생하는 고장 대처', targets: ['ch5e'], color: 'amber' as const },
    { step: 5, label: '우진 고장조치',        desc: '운행 중 주요 고장 처리', targets: ['ch5b'], color: 'red' as const },
    { step: 6, label: '중고장 코드',          desc: 'TCMS 중고장 경보 이해', targets: ['ch5d'], color: 'red' as const },
    { step: 7, label: '사고사례·퀵가이드',    desc: '실제 사례와 빠른 참조', targets: ['ch7', 'ch6'], color: 'amber' as const },
  ];

  const handleMenuClick = (item: typeof MENU_ITEMS[number]) => {
    switch (item.action) {
      case 'chapters':
        onChapters([...item.targets]);
        break;
      case 'submenu':
        if (item.id === 'repair') setRepairOpen(true);
        break;
      case 'roadmap':  setRoadmapOpen(true); break;
      case 'training': onTraining(); break;
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
        <div className={styles.heroHaze} />

        <h1 className={styles.heroTitle}>Smart Crew<br />Assistant</h1>
        <p className={styles.heroSub}>SEOUL METRO · LINE 5</p>
        <p className={styles.heroDesc}>5호선 승무원을 위한 실무 교육 시스템</p>

        {/* 5호선 심볼 */}
        <div className={styles.heroVisual}>
          <svg viewBox="0 0 380 100" className={styles.heroLineSvg} fill="none">
            <path
              d="M-10 50C60 58 120 65 190 50C260 35 320 55 392 48"
              stroke="url(#heroLineGlow)"
              strokeWidth="16"
              strokeLinecap="round"
              opacity="0.12"
            />
            <path
              d="M-10 50C60 58 120 65 190 50C260 35 320 55 392 48"
              stroke="url(#heroLineMain)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* 역 노드 */}
            <circle cx="60" cy="56" r="4" fill="#c084fc" opacity="0.6" />
            <circle cx="130" cy="62" r="4" fill="#a855f7" opacity="0.7" />
            <circle cx="190" cy="50" r="5" fill="#7c3aed" opacity="0.9" />
            <circle cx="250" cy="40" r="4" fill="#a855f7" opacity="0.7" />
            <circle cx="320" cy="52" r="4" fill="#c084fc" opacity="0.6" />
            <defs>
              <linearGradient id="heroLineMain" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a855f7" />
                <stop offset="0.5" stopColor="#7c3aed" />
                <stop offset="1" stopColor="#c4b5fd" />
              </linearGradient>
              <linearGradient id="heroLineGlow" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c084fc" />
                <stop offset="1" stopColor="#e9d5ff" />
              </linearGradient>
            </defs>
          </svg>

          <div className={styles.heroBigBadge}>
            <div className={styles.heroBigNum}>5</div>
            <span className={styles.heroBigLabel}>Line 5</span>
          </div>
        </div>

        <div className={styles.heroFade} />
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

        {/* 최근 본 섹션 — 1건만 표시 */}
        {recentList.length > 0 && (
          <button
            type="button"
            className={styles.recentItem}
            onClick={() => onSection(recentList[0])}
          >
            <Clock size={14} className={styles.recentIcon} />
            <span className={styles.recentTitle}>
              {sectionNames[recentList[0]] ?? recentList[0]}
            </span>
            <ChevronRight size={14} className={styles.resumeArrow} />
          </button>
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

      {/* 고장조치 서브메뉴 */}
      {repairOpen && (
        <div className={styles.subMenuOverlay} onClick={() => setRepairOpen(false)}>
          <div className={styles.subMenuPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.subMenuHeader}>
              <Wrench size={20} className={styles.quickIconRed} />
              <h3 className={styles.subMenuTitle}>고장조치</h3>
              <button type="button" className={styles.subMenuClose} onClick={() => setRepairOpen(false)} aria-label="닫기">
                <X size={20} />
              </button>
            </div>
            <div className={styles.subMenuGrid}>
              {REPAIR_SUB.map((sub) => {
                const iconMap: Record<string, typeof Wrench> = {
                  abb: Wrench,
                  woojin: Wrench,
                  rotem: Wrench,
                  startup: Wrench,
                  critical: Wrench,
                  compare: GitCompareArrows,
                };
                const SubIcon = iconMap[sub.id] ?? Wrench;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className={`${styles.subMenuItem} ${sub.coming ? styles.menuGridItemDisabled : ''}`}
                    disabled={sub.coming}
                    onClick={() => {
                      if (sub.coming) return;
                      setRepairOpen(false);
                      onChapters([...sub.targets]);
                    }}
                  >
                    <div className={`${styles.menuGridIcon} ${ICON_BG_MAP[sub.color]}`}>
                      <SubIcon size={26} className={ICON_COLOR_MAP[sub.color]} />
                    </div>
                    <span className={styles.subMenuLabel}>{sub.label}</span>
                    {sub.coming && <span className={styles.subMenuComing}>준비중</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 새내기 학습 로드맵 */}
      {roadmapOpen && (
        <div className={styles.subMenuOverlay} onClick={() => setRoadmapOpen(false)}>
          <div className={styles.roadmapPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.subMenuHeader}>
              <DoorOpen size={20} className={styles.quickIconAmber} />
              <h3 className={styles.subMenuTitle}>신규 기관사 학습 순서</h3>
              <button type="button" className={styles.subMenuClose} onClick={() => setRoadmapOpen(false)} aria-label="닫기">
                <X size={20} />
              </button>
            </div>
            <p className={styles.roadmapDesc}>처음이라면 이 순서대로 학습하세요</p>
            <div className={styles.roadmapList}>
              {ROADMAP_STEPS.map((step) => (
                <button
                  key={step.step}
                  type="button"
                  className={styles.roadmapItem}
                  onClick={() => {
                    setRoadmapOpen(false);
                    onChapters([...step.targets]);
                  }}
                >
                  <div className={`${styles.roadmapStep} ${ICON_BG_MAP[step.color]}`}>
                    {step.step}
                  </div>
                  <div className={styles.roadmapItemBody}>
                    <div className={styles.roadmapItemLabel}>{step.label}</div>
                    <div className={styles.roadmapItemDesc}>{step.desc}</div>
                  </div>
                  <ChevronRight size={16} className={styles.resumeArrow} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
