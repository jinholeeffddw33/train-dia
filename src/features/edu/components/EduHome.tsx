'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { LottieRefCurrentProps } from 'lottie-react';
import {
  ArrowLeft, ChevronRight, X,
  Mic, DoorOpen, Wrench,
  Award, User, ClipboardList,
  RotateCcw, GitCompareArrows, Link, Zap, Wind,
  Clapperboard, BookOpen, FileText,
} from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';
import trainBgAnimation from '@/assets/animations/train-background.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EduHomeProps {
  onBack: () => void;
  onStudy: () => void;
  onQuiz: () => void;
  onSection: (sectionId: string) => void;
  onWrongReview: () => void;
  onWrongQuiz: () => void;
  onChapter: (chapterId: string) => void;
  onChapters: (chapterIds: string[], title?: string) => void;
  onMyInfo: () => void;
  onVideo: () => void;
  onTraining: () => void;
  onRescueProcedure: () => void;
  onRescueSimulation: () => void;
  onMrBurst: () => void;
  onNewcomerVideo: () => void;
  onNewcomerHandbook: () => void;
}

const MENU_ITEMS = [
  { id: 'duty',           label: '승무 기본',  icon: ClipboardList, action: 'chapters' as const, targets: ['ch1'] },
  { id: 'announce',       label: '안내방송',   icon: Mic,           action: 'chapters' as const, targets: ['ch8', 'ch9', 'ch10'] },
  { id: 'video-guide',    label: '교육 영상',  icon: Clapperboard,  action: 'video-guide' as const, targets: [] },
  { id: 'repair',         label: '장애 조치',  icon: Wrench,        action: 'submenu'  as const, targets: [] },
  { id: 'newcomer',       label: '신규 교육',  icon: DoorOpen,      action: 'newcomer-handbook' as const, targets: [] },
  { id: 'edu',            label: '운행 규정',  icon: BookOpen,      action: 'training' as const, targets: [] },
  { id: 'exam',           label: '평가',      icon: Award,         action: 'quiz'     as const, targets: [] },
  { id: 'myinfo',         label: '내 정보',   icon: User,          action: 'myinfo'   as const, targets: [] },
];

// 고장조치 서브메뉴는 단일 회색 톤 (전역 ICON_BG_MAP 제거)
const SUBMENU_COLOR_MAP = {
  blue:   styles.iconBgBlue,
  purple: styles.iconBgPurple,
  green:  styles.iconBgGreen,
  amber:  styles.iconBgAmber,
  red:    styles.iconBgRed,
} as const;

export default function EduHome({ onBack, onStudy: _onStudy, onQuiz, onSection, onWrongReview, onWrongQuiz: _onWrongQuiz, onChapter: _onChapter, onChapters, onMyInfo, onVideo: _onVideo, onTraining, onRescueProcedure, onRescueSimulation, onMrBurst, onNewcomerVideo, onNewcomerHandbook }: EduHomeProps) {
  const {
    readCount, totalQuizzes, bestScore,
    progress, wrongCount, unresolvedWrongCount,
  } = useEduStore();

  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // prefers-reduced-motion 존중 — 모션 줄임 설정 시 애니메이션 정지
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const hasLastRead = !!progress.lastReadSectionId;

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
    { id: 'rotem',   label: '로템\n전동차',   color: 'amber'  as const, targets: ['ch5c'],       coming: false },
    { id: 'compare', label: '전동차\n비교',   color: 'purple' as const, targets: ['ch5'],       coming: false },
    { id: 'rescue',  label: '구원연결\n조치순서', color: 'red' as const,    targets: [],            coming: false },
    { id: 'rescue-sim', label: '구원연결\n시뮬레이션', color: 'amber' as const, targets: [],            coming: false },
    { id: 'mr-burst',   label: '주공기관\n파열 훈련', color: 'red'   as const, targets: [],            coming: false },
  ];

  const handleMenuClick = (item: typeof MENU_ITEMS[number]) => {
    switch (item.action) {
      case 'chapters':
        onChapters([...item.targets], item.label);
        break;
      case 'submenu':
        if (item.id === 'repair') setRepairOpen(true);
        break;
      case 'video-guide':       onNewcomerVideo(); break;
      case 'newcomer-handbook': onNewcomerHandbook(); break;
      case 'training':          onTraining(); break;
      case 'quiz':              onQuiz(); break;
      case 'myinfo':            onMyInfo(); break;
    }
  };

  return (
    <div className={styles.screen}>
      {/* ── 풀스크린 Lottie 배경 (기차 애니메이션) ── */}
      <div className={styles.lottieBgLayer} aria-hidden="true">
        <Lottie
          lottieRef={lottieRef}
          animationData={trainBgAnimation}
          loop
          autoplay={!reducedMotion}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
          style={{ width: '100%', height: '100%' }}
          onDOMLoaded={() => {
            if (lottieRef.current) lottieRef.current.setSpeed(0.5);
          }}
        />
      </div>
      {/* 가독성 오버레이 — 본문 텍스트 가독성 확보 */}
      <div className={styles.lottieBgOverlay} aria-hidden="true" />

      {/* ── 절제된 히어로: 단색 배경 + 좌측 정렬 텍스트 + 소형 LINE5 pill ── */}
      <header className={styles.heroV3}>
        <button type="button" className={styles.heroBackV3} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={24} strokeWidth={2} />
        </button>

        <div className={styles.heroTextV3}>
          <span className={styles.heroPill} aria-hidden="true">
            <span className={styles.heroPillDot} />
            LINE 5
          </span>
          <h1 className={styles.heroTitleV3}>5호선 승무 교육</h1>
          <p className={styles.heroDescV3}>운행 전 필요한 절차와 장애 대응 기준을 확인하세요</p>
        </div>
      </header>

      <div className={styles.homeContentV3}>
        {/* ── 8개 메뉴 — 통일된 회색 카드 ── */}
        <nav className={styles.menuGridV3} aria-label="교육 메뉴">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={styles.menuTileV3}
                onClick={() => handleMenuClick(item)}
              >
                <span className={styles.menuTileIconV3} aria-hidden="true">
                  <Icon size={26} strokeWidth={1.8} />
                </span>
                <span className={styles.menuTileLabelV3}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── 이어서 보기 — 텍스트 중심 CTA ── */}
        {hasLastRead && (
          <button
            type="button"
            className={styles.resumeV3}
            onClick={() => onSection(progress.lastReadSectionId!)}
          >
            <div className={styles.resumeBodyV3}>
              <span className={styles.resumeLabelV3}>이어서 보기</span>
              <span className={styles.resumeTitleV3}>
                {sectionNames[progress.lastReadSectionId!] ?? progress.lastReadSectionId}
              </span>
            </div>
            <span className={styles.resumeArrowV3} aria-hidden="true">
              <ChevronRight size={24} strokeWidth={2.2} />
            </span>
          </button>
        )}

        {/* ── 오답노트 — 있을 때만 한 줄 리스트 ── */}
        {wrongCount > 0 && (
          <button type="button" className={styles.listRowV3} onClick={onWrongReview}>
            <span className={styles.listRowIconV3} aria-hidden="true">
              <RotateCcw size={22} strokeWidth={1.8} />
            </span>
            <span className={styles.listRowBodyV3}>
              <span className={styles.listRowTitleV3}>오답노트</span>
              <span className={styles.listRowMetaV3}>
                {unresolvedWrongCount > 0
                  ? `미해결 ${unresolvedWrongCount}문제 · 전체 ${wrongCount}문제`
                  : `전체 ${wrongCount}문제 (모두 해결)`}
              </span>
            </span>
            <ChevronRight size={22} className={styles.listRowArrowV3} />
          </button>
        )}

        {/* ── 학습 현황 — 숫자 중심 3카드, 그래프 없음 ── */}
        {(totalQuizzes > 0 || readCount > 0) && (
          <section className={styles.statsSectionV3} aria-label="학습 현황">
            <h2 className={styles.statsHeadingV3}>학습 현황</h2>
            <div className={styles.statsRowV3}>
              <div className={styles.statCellV3}>
                <BookOpen size={20} strokeWidth={1.8} className={styles.statCellIconV3} aria-hidden="true" />
                <span className={styles.statCellValueV3}>{readCount}</span>
                <span className={styles.statCellLabelV3}>학습 섹션</span>
              </div>
              <div className={styles.statCellV3}>
                <FileText size={20} strokeWidth={1.8} className={styles.statCellIconV3} aria-hidden="true" />
                <span className={styles.statCellValueV3}>{totalQuizzes}</span>
                <span className={styles.statCellLabelV3}>시험 응시</span>
              </div>
              <div className={styles.statCellV3}>
                <Award size={20} strokeWidth={1.8} className={styles.statCellIconV3} aria-hidden="true" />
                <span className={styles.statCellValueV3}>
                  {totalQuizzes > 0 ? bestScore : '-'}
                </span>
                <span className={styles.statCellLabelV3}>최고 점수</span>
              </div>
            </div>
          </section>
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
                  compare: GitCompareArrows,
                  rescue: Link,
                  'rescue-sim': Zap,
                  'mr-burst': Wind,
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
                      if (sub.id === 'rescue') {
                        onRescueProcedure();
                        return;
                      }
                      if (sub.id === 'rescue-sim') {
                        onRescueSimulation();
                        return;
                      }
                      if (sub.id === 'mr-burst') {
                        onMrBurst();
                        return;
                      }
                      onChapters([...sub.targets], sub.label);
                    }}
                  >
                    <div className={`${styles.menuGridIcon} ${SUBMENU_COLOR_MAP[sub.color]}`}>
                      <SubIcon size={26} />
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
