'use client';

import { useState, useCallback, Component, lazy, Suspense, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Sprout, Music2, Zap, Bug, Brain, Palette, Bell, Users, Trophy, Sparkles, Stamp, Bike, UtensilsCrossed, Gauge, ToggleLeft } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import LoadingDots from '@/components/common/LoadingDots';
import styles from './styles/Life.module.css';

const ReactionTest = lazy(() => import('./games/ReactionTest'));
const SnakeGame = lazy(() => import('./games/SnakeGame'));
const MentalMath = lazy(() => import('./games/MentalMath'));
const SimonSays = lazy(() => import('./games/SimonSays'));
const HalliGalli = lazy(() => import('./games/HalliGalli'));
const SpeedMaster = lazy(() => import('./games/SpeedMaster'));
const BreakerMaster = lazy(() => import('./games/BreakerMaster'));
const MultiLobby = lazy(() => import('./games/multi/MultiLobby'));
const HallOfFame = lazy(() => import('./games/HallOfFame'));
const ApexRush = lazy(() => import('./games/ApexRush'));
const ZenBonsai = lazy(() => import('./dab/ZenBonsai'));
const AsmrTherapy = lazy(() => import('./dab/AsmrTherapy'));
const TodayFortune = lazy(() => import('./fortune/TodayFortune'));
const AttendanceStamp = lazy(() => import('./stamp/AttendanceStamp'));
const WeeklyMenu = lazy(() => import('./menu/WeeklyMenu'));

/** 지연 로드 청크 공통 폴백 — 점 3개 로딩 (문구 통일: "불러오고 있어요") */
const lifeLoading = (
  <div className={styles.wrap}>
    <div className={styles.emptyWrap}>
      <LoadingDots label="불러오고 있어요" />
    </div>
  </div>
);

class LifeErrorBoundary extends Component<{ children: ReactNode; onBack: () => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onBack: () => void }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <div className={styles.emptyWrap}>
            <span className={styles.emptyIcon}>⚠️</span>
            <span className={styles.emptyText}>화면을 불러올 수 없어요</span>
            <button type="button" className={styles.addBtn} onClick={this.props.onBack}>돌아가기</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type GameId = 'reaction' | 'snake' | 'mental' | 'simon' | 'halli' | 'multi' | 'apex' | 'speed' | 'breaker';
type View = 'home' | { type: 'game'; gameId: GameId } | 'bonsai' | 'asmr' | 'hof' | 'fortune' | 'stamp' | 'menu';

// 홈에 직접 노출하는 게임 타일 — 1탭에 바로 실행. 중간 목록 화면 없음.
// 게임 7개 먼저 → 온라인대전(8) → 명예의전당(9, 게임 아님 → 골드로 차별화).
// 스피드 마스터는 규정 학습을 겸하는 게임이라 맨 앞에 둔다.
type HomeGameKey = GameId | 'hof';
const HOME_GAMES: { key: HomeGameKey; label: string; icon: typeof Zap; bg: string; variant?: 'hof' }[] = [
  { key: 'speed',    label: '스피드 마스터', icon: Gauge, bg: 'iconBgBlue' },
  { key: 'breaker',  label: '차단기 마스터', icon: ToggleLeft, bg: 'iconBgBlue' },
  { key: 'apex',     label: 'APEX',       icon: Bike,    bg: 'iconBgAmber' },
  { key: 'reaction', label: '반응속도',    icon: Zap,     bg: 'iconBgAmber' },
  { key: 'snake',    label: '사과 먹기',   icon: Bug,     bg: 'iconBgGreen' },
  { key: 'mental',   label: '암산',        icon: Brain,   bg: 'iconBgBlue' },
  { key: 'simon',    label: '색깔 맞추기', icon: Palette,  bg: 'iconBgPurple' },
  { key: 'halli',    label: '할리갈리',    icon: Bell,    bg: 'iconBgAmber' },
  { key: 'multi',    label: '온라인 대전', icon: Users,   bg: 'iconBgPurple' },
  { key: 'hof',      label: '명예의 전당', icon: Trophy,  bg: 'iconBgAmber', variant: 'hof' },
];

export default function LifeWorld({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('home');

  // 뒤로가기: 비-홈 뷰(게임/명예전당/분재/…) → 홈. 게임이 홈에서 1탭 실행이라 중간 단계 없음.
  const goLifeHome = useCallback(() => setView('home'), []);
  useHistoryBack('life-l1', goLifeHome, view !== 'home');

  // 홈 게임 타일 → 바로 실행(명예의전당은 hof 뷰).
  const launchHomeGame = useCallback((key: HomeGameKey) => {
    if (key === 'hof') setView('hof');
    else setView({ type: 'game', gameId: key });
  }, []);

  // ── 홈 화면 (DAB 휴식 모듈) ──
  if (view === 'home') {
    return (
      <div className={styles.dabPage}>
        <div className={styles.dabHero}>
          <div className={styles.dabHeroHaze} />

          {/* 뒤로가기와 제목을 한 줄에 — 버튼 아래로 제목을 내리면 히어로만 60px 넘게 먹는다 */}
          <div className={styles.dabHeroTop}>
            <button type="button" className={`${styles.heroBackBtn} ${styles.dabBackInline}`} onClick={onBack} aria-label="뒤로가기">
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <h1 className={styles.dabTitle}>휴식 모듈</h1>
          </div>
          <p className={styles.dabSub}>운행 사이, 잠시 숨을 고르세요</p>
        </div>

        <div className={styles.dabCardWrap}>
          <button type="button" className={`${styles.dabCard} ${styles.dabCardMenu}`} onClick={() => setView('menu')}>
            <div className={styles.dabCardIcon}>
              <UtensilsCrossed size={22} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>이번주 식당 메뉴 <span className={styles.dabCardNewBadge}>NEW</span></span>
              <span className={styles.dabCardDesc}>이번주 식단표 보고 등록하기</span>
            </div>
            <ChevronRight size={16} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardSage}`} onClick={() => setView('fortune')}>
            <div className={styles.dabCardIcon}>
              <Sparkles size={22} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>오늘의 운세 <span className={styles.dabCardNewBadge}>NEW</span></span>
              <span className={styles.dabCardDesc}>기관사를 위한 오늘의 한 줄</span>
            </div>
            <ChevronRight size={16} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardSky}`} onClick={() => setView('stamp')}>
            <div className={styles.dabCardIcon}>
              <Stamp size={22} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>무사고 출근 도장 <span className={styles.dabCardNewBadge}>NEW</span></span>
              <span className={styles.dabCardDesc}>매일 도장 찍고 응원 받기</span>
            </div>
            <ChevronRight size={16} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardMint}`} onClick={() => setView('bonsai')}>
            <div className={styles.dabCardIcon}>
              <Sprout size={22} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>젠 분재</span>
              <span className={styles.dabCardDesc}>쉴 때마다 한 단계씩 자라는 나무</span>
            </div>
            <ChevronRight size={16} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardLavender}`} onClick={() => setView('asmr')}>
            <div className={styles.dabCardIcon}>
              <Music2 size={22} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>ASMR 테라피</span>
              <span className={styles.dabCardDesc}>빗소리·숲바람·장작 타는 소리</span>
            </div>
            <ChevronRight size={16} className={styles.dabCardArrow} />
          </button>

        </div>

        {/* 🎮 게임 — 홈에 직접 노출. 타일 1탭에 바로 실행(중간 목록 화면 없음). */}
        <div className={styles.menuContent}>
          <div className={styles.sectionLabel}>🎮 게임 — 눌러서 바로 시작</div>
          <div className={styles.homeGameGrid}>
            {HOME_GAMES.map((g) => {
              const Icon = g.icon;
              return (
                <button
                  key={g.key}
                  type="button"
                  className={`${styles.homeGameTile} ${g.variant === 'hof' ? styles.homeGameTileHof : ''}`}
                  onClick={() => launchHomeGame(g.key)}
                  aria-label={g.label}
                >
                  {g.variant === 'hof' && <span className={styles.hofCrownTop} aria-hidden>👑</span>}
                  <span className={`${styles.gameCardIcon} ${styles[g.bg]}`}>
                    <Icon size={20} />
                  </span>
                  <span className={`${styles.homeGameTileLabel} ${g.variant === 'hof' ? styles.homeGameTileLabelHof : ''}`}>{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── 게임 플레이 ── (뒤로가기 = 홈, 중간 목록 화면 없음)
  if (typeof view === 'object' && view.type === 'game') {
    const goBack = () => setView('home');
    return (
      <LifeErrorBoundary onBack={goBack}>
        <Suspense fallback={lifeLoading}>
          {view.gameId === 'reaction' && <ReactionTest onBack={goBack} />}
          {view.gameId === 'snake' && <SnakeGame onBack={goBack} />}
          {view.gameId === 'mental' && <MentalMath onBack={goBack} />}
          {view.gameId === 'simon' && <SimonSays onBack={goBack} />}
          {view.gameId === 'halli' && <HalliGalli onBack={goBack} />}
          {view.gameId === 'speed' && <SpeedMaster onBack={goBack} />}
          {view.gameId === 'breaker' && <BreakerMaster onBack={goBack} />}
          {view.gameId === 'apex' && <ApexRush onBack={goBack} />}
          {view.gameId === 'multi' && <MultiLobby onBack={goBack} />}
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── 명예의 전당 ── (뒤로가기 = 홈)
  if (view === 'hof') {
    const goBack = () => setView('home');
    return (
      <LifeErrorBoundary onBack={goBack}>
        <Suspense fallback={lifeLoading}>
          <HallOfFame onBack={goBack} />
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── 젠 분재 ──
  if (view === 'bonsai') {
    return (
      <LifeErrorBoundary onBack={goLifeHome}>
        <Suspense fallback={lifeLoading}>
          <ZenBonsai onBack={goLifeHome} />
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── ASMR 테라피 ──
  if (view === 'asmr') {
    return (
      <LifeErrorBoundary onBack={goLifeHome}>
        <Suspense fallback={lifeLoading}>
          <AsmrTherapy onBack={goLifeHome} />
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── 오늘의 운세 ──
  if (view === 'fortune') {
    return (
      <LifeErrorBoundary onBack={goLifeHome}>
        <Suspense fallback={lifeLoading}>
          <TodayFortune onBack={goLifeHome} />
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── 이번주 식당 메뉴 ──
  if (view === 'menu') {
    return (
      <LifeErrorBoundary onBack={goLifeHome}>
        <Suspense fallback={lifeLoading}>
          <WeeklyMenu onBack={goLifeHome} />
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── 무사고 출근 도장 ──
  if (view === 'stamp') {
    return (
      <LifeErrorBoundary onBack={goLifeHome}>
        <Suspense fallback={lifeLoading}>
          <AttendanceStamp onBack={goLifeHome} />
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  return null;
}
