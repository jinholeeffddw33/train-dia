'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft, ChevronRight, X,
  Mic, TrainFront, DoorOpen, Wrench,
  GraduationCap, Award, User, ClipboardList,
  RotateCcw, Clock, GitCompareArrows,
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
  { id: 'announce', label: '안내방송', icon: Mic,           color: 'purple' as const, action: 'chapters' as const, targets: ['ch8', 'ch9', 'ch10'] },
  { id: 'train',    label: '전동차',   icon: TrainFront,    color: 'green'  as const, action: 'chapters' as const, targets: ['ch2', 'ch6'] },
  { id: 'door',     label: '출입문',   icon: DoorOpen,      color: 'amber'  as const, action: 'coming'   as const, targets: [] },
  { id: 'repair',   label: '고장조치', icon: Wrench,        color: 'red'    as const, action: 'submenu'  as const, targets: [] },
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

  const [repairOpen, setRepairOpen] = useState(false);

  const REPAIR_SUB = [
    { id: 'abb',     label: 'ABB\n전동차',   color: 'blue'   as const, targets: ['ch5a'],       coming: false },
    { id: 'woojin',  label: '우진\n전동차',   color: 'green'  as const, targets: ['ch5b'],       coming: false },
    { id: 'rotem',   label: '로템\n전동차',   color: 'amber'  as const, targets: [],             coming: true },
    { id: 'compare', label: '전동차\n비교',   color: 'purple' as const, targets: ['ch5'],       coming: false },
  ];

  const handleMenuClick = (item: typeof MENU_ITEMS[number]) => {
    switch (item.action) {
      case 'chapters':
        onChapters([...item.targets]);
        break;
      case 'submenu':
        if (item.id === 'repair') setRepairOpen(true);
        break;
      case 'quiz':    onQuiz(); break;
      case 'myinfo':  onMyInfo(); break;
      case 'coming':  break;
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

        {/* 지하철 + 데이터 네트워크 비주얼 */}
        <div className={styles.heroVisual}>
          <svg viewBox="0 0 320 160" className={styles.heroTrainSvg} fill="none">
            {/* 그리드 배경 — 연구실/데이터 느낌 */}
            <line x1="0" y1="40" x2="320" y2="40" stroke="url(#gridLine)" strokeWidth="0.5" opacity="0.08" />
            <line x1="0" y1="80" x2="320" y2="80" stroke="url(#gridLine)" strokeWidth="0.5" opacity="0.08" />
            <line x1="0" y1="120" x2="320" y2="120" stroke="url(#gridLine)" strokeWidth="0.5" opacity="0.08" />
            <line x1="80" y1="0" x2="80" y2="160" stroke="url(#gridLine)" strokeWidth="0.5" opacity="0.06" />
            <line x1="160" y1="0" x2="160" y2="160" stroke="url(#gridLine)" strokeWidth="0.5" opacity="0.06" />
            <line x1="240" y1="0" x2="240" y2="160" stroke="url(#gridLine)" strokeWidth="0.5" opacity="0.06" />

            {/* 레일 */}
            <line x1="0" y1="108" x2="320" y2="108" stroke="#7c3aed" strokeWidth="2" opacity="0.3" />
            <line x1="0" y1="112" x2="320" y2="112" stroke="#7c3aed" strokeWidth="2" opacity="0.3" />

            {/* 지하철 차량 실루엣 */}
            <rect x="85" y="72" width="150" height="34" rx="8" fill="url(#trainBody)" />
            <rect x="82" y="70" width="156" height="38" rx="10" stroke="url(#trainStroke)" strokeWidth="1.5" fill="none" />
            {/* 창문 4개 */}
            <rect x="98" y="78" width="22" height="14" rx="3" fill="#a855f7" opacity="0.5" />
            <rect x="126" y="78" width="22" height="14" rx="3" fill="#a855f7" opacity="0.4" />
            <rect x="154" y="78" width="22" height="14" rx="3" fill="#a855f7" opacity="0.4" />
            <rect x="182" y="78" width="22" height="14" rx="3" fill="#a855f7" opacity="0.5" />
            {/* 5호선 번호 */}
            <text x="160" y="91" textAnchor="middle" fontSize="13" fontWeight="800" fill="#e9d5ff" opacity="0.9">5</text>
            {/* 전조등 */}
            <circle cx="234" cy="88" r="3" fill="#c4b5fd" opacity="0.8" />
            {/* 바퀴 */}
            <circle cx="108" cy="112" r="5" fill="#7c3aed" opacity="0.4" />
            <circle cx="212" cy="112" r="5" fill="#7c3aed" opacity="0.4" />

            {/* 데이터 노드 — 연구 네트워크 느낌 */}
            <circle cx="40" cy="50" r="3" fill="#a855f7" opacity="0.6" className={styles.nodeP1} />
            <circle cx="280" cy="45" r="3" fill="#c084fc" opacity="0.5" className={styles.nodeP2} />
            <circle cx="55" cy="130" r="2.5" fill="#7c3aed" opacity="0.4" className={styles.nodeP3} />
            <circle cx="265" cy="135" r="2.5" fill="#a855f7" opacity="0.4" className={styles.nodeP1} />
            {/* 연결선 */}
            <line x1="40" y1="50" x2="85" y2="72" stroke="#a855f7" strokeWidth="0.8" opacity="0.15" strokeDasharray="3 3" />
            <line x1="280" y1="45" x2="238" y2="72" stroke="#c084fc" strokeWidth="0.8" opacity="0.15" strokeDasharray="3 3" />
            <line x1="55" y1="130" x2="108" y2="112" stroke="#7c3aed" strokeWidth="0.8" opacity="0.12" strokeDasharray="3 3" />
            <line x1="265" y1="135" x2="212" y2="112" stroke="#a855f7" strokeWidth="0.8" opacity="0.12" strokeDasharray="3 3" />

            {/* 속도 흔적 */}
            <line x1="240" y1="82" x2="300" y2="82" stroke="#c4b5fd" strokeWidth="1" opacity="0.2" className={styles.speedLine} />
            <line x1="245" y1="88" x2="290" y2="88" stroke="#c4b5fd" strokeWidth="0.8" opacity="0.15" className={styles.speedLine} />

            <defs>
              <linearGradient id="trainBody" x1="85" y1="72" x2="235" y2="106" gradientUnits="userSpaceOnUse">
                <stop stopColor="rgba(124, 58, 237, 0.2)" />
                <stop offset="1" stopColor="rgba(168, 85, 247, 0.1)" />
              </linearGradient>
              <linearGradient id="trainStroke" x1="82" y1="70" x2="238" y2="108" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a855f7" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
              <linearGradient id="gridLine" x1="0" y1="0" x2="320" y2="0">
                <stop stopColor="#a855f7" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={styles.heroFade} />
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
                const iconMap = {
                  abb: Wrench,
                  woojin: Wrench,
                  rotem: Wrench,
                  compare: GitCompareArrows,
                } as const;
                const SubIcon = iconMap[sub.id as keyof typeof iconMap];
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className={`${styles.subMenuItem} ${sub.coming ? styles.menuGridItemDisabled : ''}`}
                    disabled={sub.coming}
                    onClick={() => {
                      if (!sub.coming) {
                        setRepairOpen(false);
                        onChapters([...sub.targets]);
                      }
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
    </div>
  );
}
