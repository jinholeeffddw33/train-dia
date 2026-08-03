'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { LottieRefCurrentProps } from 'lottie-react';
import {
  ArrowLeft, ChevronRight, X, Home, GraduationCap,
  Mic, DoorOpen, Wrench,
  Award, User, ClipboardList,
  RotateCcw, GitCompareArrows, Link, Zap, Wind,
  Clapperboard, BookOpen,
} from 'lucide-react';
import { useEduStore } from '../hooks/useEduStore';
import styles from '../styles/edu.module.css';

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

/**
 * 4열 그리드 = 2행. 행 단위로 성격을 묶고, 행 안에서는 배우는 순서대로 둔다.
 *  1행 = 읽고 배우는 것 : 입문(새내기·영상) → 일상 업무(기본업무·안내방송)
 *  2행 = 찾아보고 점검하는 것 : 이상 상황(고장조치) → 근거(규정) → 평가 → 기록
 * 예전 순서는 '새내기'가 2행 맨 앞이라, 정작 새내기용인 '영상 가이드'(1행)와 갈라져 있었다.
 */
const MENU_ITEMS = [
  // 1행 — 입문 → 일상 업무
  { id: 'newcomer',       label: '새내기',     icon: DoorOpen,      color: 'amber'  as const, action: 'newcomer-handbook' as const, targets: [] },
  { id: 'video-guide',    label: '영상 가이드', icon: Clapperboard,  color: 'green'  as const, action: 'video-guide' as const, targets: [] },
  { id: 'duty',           label: '기본업무',   icon: ClipboardList, color: 'blue'   as const, action: 'chapters' as const, targets: ['ch1'] },
  { id: 'announce',       label: '안내방송',   icon: Mic,           color: 'purple' as const, action: 'chapters' as const, targets: ['ch8', 'ch9', 'ch10', 'ch11'] },
  // 2행 — 이상 상황 → 근거 → 점검
  { id: 'repair',         label: '고장조치',   icon: Wrench,        color: 'red'    as const, action: 'submenu'  as const, targets: [] },
  { id: 'edu',            label: '규정',      icon: BookOpen,      color: 'blue'   as const, action: 'training' as const, targets: [] },
  { id: 'exam',           label: '평가',      icon: Award,         color: 'green'  as const, action: 'quiz'     as const, targets: [] },
  { id: 'myinfo',         label: '내 정보',   icon: User,          color: 'purple' as const, action: 'myinfo'   as const, targets: [] },
];

// SVG 그라데이션 URL 매핑 — 아이콘 stroke에 그라데이션 적용
const ICON_GRADIENT_MAP = {
  blue:   'url(#eduIconGradBlue)',
  purple: 'url(#eduIconGradPurple)',
  green:  'url(#eduIconGradGreen)',
  amber:  'url(#eduIconGradAmber)',
  red:    'url(#eduIconGradRed)',
} as const;

// 고장조치 서브메뉴는 기존 3D 쿠션 스타일 유지 (서브메뉴는 박스 컨테이너 그대로)
const SUBMENU_COLOR_MAP = {
  blue:   styles.iconBgBlue,
  purple: styles.iconBgPurple,
  green:  styles.iconBgGreen,
  amber:  styles.iconBgAmber,
  red:    styles.iconBgRed,
} as const;

export default function EduHome({ onBack, onStudy: _onStudy, onQuiz, onSection: _onSection, onWrongReview, onWrongQuiz: _onWrongQuiz, onChapter: _onChapter, onChapters, onMyInfo, onVideo: _onVideo, onTraining, onRescueProcedure, onRescueSimulation, onMrBurst, onNewcomerVideo, onNewcomerHandbook }: EduHomeProps) {
  const { wrongCount, unresolvedWrongCount } = useEduStore();

  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // Lottie 배경 JSON 지연 로드 (164KB) — 번들 인라인 대신 public에서 fetch
  const [trainBgAnimation, setTrainBgAnimation] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/lottie/train-background.json')
      .then((r) => r.json())
      .then((data) => { if (alive) setTrainBgAnimation(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

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
    <div className={`${styles.screen} ${styles.screenHome}`}>
      {/* ── 풀스크린 Lottie 배경 (기차 애니메이션) ── */}
      <div className={styles.lottieBgLayer} aria-hidden="true">
        {trainBgAnimation && (
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
        )}
      </div>
      {/* 가독성 오버레이 — 본문 텍스트 가독성 확보 */}
      <div className={styles.lottieBgOverlay} aria-hidden="true" />

      {/* SVG 그라데이션 defs — 흰 카드 위에서도 또렷하도록 진한 톤만 사용 */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="eduIconGradBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <linearGradient id="eduIconGradPurple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#5B21B6" />
          </linearGradient>
          <linearGradient id="eduIconGradGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
          <linearGradient id="eduIconGradAmber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="eduIconGradRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── 절제된 히어로: 단색 배경 + 좌측 정렬 텍스트 + 소형 LINE5 pill ── */}
      <header className={styles.heroV3}>
        <div className={styles.heroTopRow}>
          <button type="button" className={styles.heroBackV3} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={24} strokeWidth={2} />
          </button>
          <button type="button" className={styles.heroHomeV3} onClick={onBack} aria-label="홈으로">
            <Home size={22} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.heroTextV3}>
          <span className={styles.heroPill} aria-hidden="true">
            <span className={styles.heroPillDot} />
            LINE 5
          </span>
          <div className={styles.heroTitleRow}>
            <span className={styles.heroIconTile} aria-hidden="true">
              <GraduationCap size={26} strokeWidth={2.2} />
            </span>
            <h1 className={styles.heroTitleV3}>교육</h1>
          </div>
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
                className={`${styles.menuTileV3} ${styles[`menuTileV3_${item.color}`]}`}
                onClick={() => handleMenuClick(item)}
              >
                <span className={styles.menuTileIconV3} aria-hidden="true">
                  <Icon size={34} strokeWidth={2.4} color={ICON_GRADIENT_MAP[item.color]} />
                </span>
                <span className={styles.menuTileLabelV3}>{item.label}</span>
              </button>
            );
          })}
        </nav>

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

      </div>

      {/* 고장조치 서브메뉴 */}
      {repairOpen && (
        <div className={styles.subMenuOverlay} onClick={() => setRepairOpen(false)}>
          <div className={styles.subMenuPanel} role="dialog" aria-modal="true" aria-label="고장조치 메뉴" onClick={(e) => e.stopPropagation()}>
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
