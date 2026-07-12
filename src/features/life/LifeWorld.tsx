'use client';

import { useState, useCallback, Component, lazy, Suspense, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Gamepad2, Sprout, Music2, Zap, Bug, Brain, Palette, Bell, Users, Trophy, Sparkles, Stamp, Bike, UtensilsCrossed } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import LoadingDots from '@/components/common/LoadingDots';
import styles from './styles/Life.module.css';

const ReactionTest = lazy(() => import('./games/ReactionTest'));
const SnakeGame = lazy(() => import('./games/SnakeGame'));
const MentalMath = lazy(() => import('./games/MentalMath'));
const SimonSays = lazy(() => import('./games/SimonSays'));
const HalliGalli = lazy(() => import('./games/HalliGalli'));
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

type GameId = 'reaction' | 'snake' | 'mental' | 'simon' | 'halli' | 'multi' | 'apex';
type View = 'home' | 'games' | { type: 'game'; gameId: GameId } | 'bonsai' | 'asmr' | 'hof' | 'fortune' | 'stamp' | 'menu';

const GAMES: { id: GameId; label: string; icon: typeof Zap; color: string; desc: string }[] = [
  { id: 'reaction', label: '반응속도 테스트', icon: Zap, color: 'amber', desc: '초록색이 되면 터치! 얼마나 빠른지 측정' },
  { id: 'snake', label: '사과 먹기', icon: Bug, color: 'green', desc: '사과를 먹고 장애물을 피하세요!' },
  { id: 'mental', label: '암산 스프린트', icon: Brain, color: 'blue', desc: '60초 안에 계산 문제 최대한 많이!' },
  { id: 'simon', label: '색깔 따라하기', icon: Palette, color: 'purple', desc: '순서를 기억하고 똑같이 눌러보세요' },
  { id: 'halli', label: '할리갈리', icon: Bell, color: 'amber', desc: '같은 과일 5개면 종을 쳐라!' },
];

export default function LifeWorld({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('home');

  // 뒤로가기 Level 1: 비-홈 뷰 → 홈
  const goLifeHome = useCallback(() => setView('home'), []);
  useHistoryBack('life-l1', goLifeHome, view !== 'home');

  // 뒤로가기 Level 2: game/hof → games
  const isDepth2 = (typeof view === 'object' && view.type === 'game') || view === 'hof';
  const goToParent2 = useCallback(() => {
    if ((typeof view === 'object' && view.type === 'game') || view === 'hof') setView('games');
  }, [view]);
  useHistoryBack('life-l2', goToParent2, isDepth2);

  // ── 홈 화면 (DAB 휴식 모듈) ──
  if (view === 'home') {
    return (
      <div className={styles.dabPage}>
        <div className={styles.dabHero}>
          <button type="button" className={styles.heroBackBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div className={styles.dabHeroHaze} />

          <p className={styles.dabBrand}>DAB · Define Answer Beyond</p>
          <h1 className={styles.dabTitle}>휴식 모듈</h1>
          <p className={styles.dabSub}>운행 사이, 잠시 숨을 고르세요</p>
        </div>

        <div className={styles.dabCardWrap}>
          <button type="button" className={`${styles.dabCard} ${styles.dabCardMenu}`} onClick={() => setView('menu')}>
            <div className={styles.dabCardIcon}>
              <UtensilsCrossed size={26} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>이번주 식당 메뉴 <span className={styles.dabCardNewBadge}>NEW</span></span>
              <span className={styles.dabCardDesc}>이번주 식단표를 등록하고 함께 확인해요</span>
            </div>
            <ChevronRight size={18} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardSage}`} onClick={() => setView('fortune')}>
            <div className={styles.dabCardIcon}>
              <Sparkles size={26} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>오늘의 운세 <span className={styles.dabCardNewBadge}>NEW</span></span>
              <span className={styles.dabCardDesc}>5호선 기관사를 위한 오늘의 한 줄</span>
            </div>
            <ChevronRight size={18} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardSky}`} onClick={() => setView('stamp')}>
            <div className={styles.dabCardIcon}>
              <Stamp size={26} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>무사고 출근 도장 <span className={styles.dabCardNewBadge}>NEW</span></span>
              <span className={styles.dabCardDesc}>매일 도장 찍고 마일스톤 응원 받기</span>
            </div>
            <ChevronRight size={18} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardMint}`} onClick={() => setView('bonsai')}>
            <div className={styles.dabCardIcon}>
              <Sprout size={26} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>젠 분재</span>
              <span className={styles.dabCardDesc}>휴식을 완료할 때마다 한 단계씩 자라나는 나무</span>
            </div>
            <ChevronRight size={18} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardLavender}`} onClick={() => setView('asmr')}>
            <div className={styles.dabCardIcon}>
              <Music2 size={26} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>ASMR 테라피</span>
              <span className={styles.dabCardDesc}>빗소리·숲바람·장작 타는 소리</span>
            </div>
            <ChevronRight size={18} className={styles.dabCardArrow} />
          </button>

          <button type="button" className={`${styles.dabCard} ${styles.dabCardPeach}`} onClick={() => setView('games')}>
            <div className={styles.dabCardIcon}>
              <Gamepad2 size={26} strokeWidth={2} />
            </div>
            <div className={styles.dabCardText}>
              <span className={styles.dabCardLabel}>미니 게임</span>
              <span className={styles.dabCardDesc}>가벼운 두뇌 게임으로 기분 전환</span>
            </div>
            <ChevronRight size={18} className={styles.dabCardArrow} />
          </button>
        </div>
      </div>
    );
  }

  // ── 게임 목록 (기존 유지) ──
  if (view === 'games') {
    return (
      <div className={styles.wrap}>
        <div className={styles.lifeHeader}>
          <button type="button" className={styles.backBtn} onClick={() => setView('home')} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className={styles.headerTitle}>미니 게임</h2>
        </div>
        <div className={styles.menuContent}>
          <button
            type="button"
            className={`${styles.gameCard} ${styles.gameCardHof}`}
            onClick={() => setView('hof')}
          >
            <div className={`${styles.gameCardIcon} ${styles.iconBgAmber}`}>
              <Trophy size={24} />
            </div>
            <div className={styles.gameCardText}>
              <span className={styles.gameCardLabel}>
                <span className={styles.hofCrown} aria-hidden>👑</span>
                명예의 전당
              </span>
              <span className={styles.gameCardDesc}>매월 1·2·3등 영구 기록</span>
            </div>
            <ChevronRight size={18} className={styles.gameEntryArrow} />
          </button>

          <button
            type="button"
            className={`${styles.gameCard} ${styles.gameCardMulti}`}
            onClick={() => setView({ type: 'game', gameId: 'multi' })}
          >
            <div className={`${styles.gameCardIcon} ${styles.iconBgPurple}`}>
              <Users size={24} />
            </div>
            <div className={styles.gameCardText}>
              <span className={styles.gameCardLabel}>
                온라인 대전
                <span className={styles.liveBadge}>LIVE</span>
              </span>
              <span className={styles.gameCardDesc}>동료와 함께! 오목 · 오델로</span>
            </div>
            <ChevronRight size={18} className={styles.gameEntryArrow} />
          </button>

          <div className={styles.sectionLabel}>혼자 즐기기</div>

          {/* APEX RUSH — 3D 게임, 최상단 full 그라데이션 강조 카드 (진호 2026-07-08) */}
          <button
            type="button"
            className={`${styles.gameCard} ${styles.gameCardApex}`}
            onClick={() => setView({ type: 'game', gameId: 'apex' })}
          >
            <div className={styles.gameCardIcon}>
              <Bike size={24} />
            </div>
            <div className={styles.gameCardText}>
              <span className={styles.gameCardLabel}>
                APEX RUSH
                <span className={styles.apexBadge}>3D</span>
              </span>
              <span className={styles.gameCardDesc}>3D 다운힐 라이딩 · 트릭 &amp; 슈퍼부스트</span>
            </div>
            <ChevronRight size={18} className={styles.gameEntryArrow} />
          </button>

          {GAMES.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                type="button"
                className={styles.gameCard}
                onClick={() => setView({ type: 'game', gameId: g.id })}
              >
                <div className={`${styles.gameCardIcon} ${
                  g.color === 'amber' ? styles.iconBgAmber :
                  g.color === 'blue' ? styles.iconBgBlue :
                  g.color === 'purple' ? styles.iconBgPurple :
                  styles.iconBgGreen
                }`}>
                  <Icon size={24} />
                </div>
                <div className={styles.gameCardText}>
                  <span className={styles.gameCardLabel}>{g.label}</span>
                  <span className={styles.gameCardDesc}>{g.desc}</span>
                </div>
                <ChevronRight size={18} className={styles.gameEntryArrow} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 게임 플레이 (기존 유지) ──
  if (typeof view === 'object' && view.type === 'game') {
    const goBack = () => setView('games');
    return (
      <LifeErrorBoundary onBack={goBack}>
        <Suspense fallback={lifeLoading}>
          {view.gameId === 'reaction' && <ReactionTest onBack={goBack} />}
          {view.gameId === 'snake' && <SnakeGame onBack={goBack} />}
          {view.gameId === 'mental' && <MentalMath onBack={goBack} />}
          {view.gameId === 'simon' && <SimonSays onBack={goBack} />}
          {view.gameId === 'halli' && <HalliGalli onBack={goBack} />}
          {view.gameId === 'apex' && <ApexRush onBack={goBack} />}
          {view.gameId === 'multi' && <MultiLobby onBack={goBack} />}
        </Suspense>
      </LifeErrorBoundary>
    );
  }

  // ── 명예의 전당 ──
  if (view === 'hof') {
    const goBack = () => setView('games');
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
