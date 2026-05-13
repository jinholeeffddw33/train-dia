'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrainFront, Search, GitCompareArrows, Phone, CreditCard, ChevronRight, X, UserRoundPen, Bookmark, Car, LogOut, Fingerprint, KeyRound, ShieldCheck, Smartphone, MessageSquarePlus, ClipboardList, Lock, BarChart3 } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { openInChrome } from '@/hooks/useInAppBrowser';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useFontSizeStore, type FontSize } from '@/stores/fontSize';
import { useNotification } from '@/hooks/useNotification';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { CommuteOverlay } from '@/features/commute';
import { SubwaySearchOverlay } from '@/features/subway';
import { CompareTab } from '@/features/compare';
import { ContactsTab } from '@/features/contacts';
// DriverSelector 제거됨 — 기관사 변경은 인증으로 고정
import HealingCardOverlay from './HealingCardOverlay';
import ShuttleScheduleOverlay from './ShuttleScheduleOverlay';
import ShortcutsOverlay from './ShortcutsOverlay';
import FeedbackOverlay from './FeedbackOverlay';
import AdminFeedbackOverlay from './AdminFeedbackOverlay';
import AdminDashboard from './AdminDashboard';
import LevelRecordsOverlay from './LevelRecordsOverlay';
import { APP_VERSION } from '@/lib/constants';
import styles from '../styles/More.module.css';

const LEVEL_ADMIN_SABUN = '21711694'; // 이현구

export default function MoreTab() {
  const driver = useDriverStore((s) => s.current);
  const myDriver = useDriverStore((s) => s.myDriver);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const backToMe = useDriverStore((s) => s.backToMe);
  const driverLogout = useDriverStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const authLogout = useAuthStore((s) => s.logout);
  const hasBiometric = useAuthStore((s) => s.hasBiometric);
  const registerBiometric = useAuthStore((s) => s.registerBiometric);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const { size: fontSize, setSize: setFontSize } = useFontSizeStore();
  const { supported: notifSupported, permission: notifPerm, requestPermission } = useNotification();
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription();
  const [commuteOpen, setCommuteOpen] = useState(false);
  const [subwayOpen, setSubwayOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [healingOpen, setHealingOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shuttleOpen, setShuttleOpen] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [adminFeedbackOpen, setAdminFeedbackOpen] = useState(false);
  const [adminDashOpen, setAdminDashOpen] = useState(false);
  const [levelRecordsOpen, setLevelRecordsOpen] = useState(false);
  const { canInstall, isInstalled, isIOS, isAndroid, install } = useInstallPrompt();
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // 오버레이 뒤로가기 지원
  const anyOverlayOpen = commuteOpen || subwayOpen || compareOpen || contactsOpen
    || healingOpen || shortcutsOpen || shuttleOpen || feedbackOpen
    || adminFeedbackOpen || adminDashOpen || levelRecordsOpen || pinChangeOpen || installGuideOpen;
  const closeActiveOverlay = useCallback(() => {
    if (commuteOpen) setCommuteOpen(false);
    else if (subwayOpen) setSubwayOpen(false);
    else if (compareOpen) setCompareOpen(false);
    else if (contactsOpen) setContactsOpen(false);
    else if (healingOpen) setHealingOpen(false);
    else if (shortcutsOpen) setShortcutsOpen(false);
    else if (shuttleOpen) setShuttleOpen(false);
    else if (feedbackOpen) setFeedbackOpen(false);
    else if (adminFeedbackOpen) setAdminFeedbackOpen(false);
    else if (adminDashOpen) setAdminDashOpen(false);
    else if (levelRecordsOpen) setLevelRecordsOpen(false);
    else if (pinChangeOpen) setPinChangeOpen(false);
    else if (installGuideOpen) setInstallGuideOpen(false);
  }, [commuteOpen, subwayOpen, compareOpen, contactsOpen, healingOpen,
      shortcutsOpen, shuttleOpen, feedbackOpen, adminFeedbackOpen,
      adminDashOpen, levelRecordsOpen, pinChangeOpen, installGuideOpen]);
  useHistoryBack('more-overlay', closeActiveOverlay, anyOverlayOpen);

  // 오늘 통계
  const [stats, setStats] = useState({ todayVisitors: 0, todayPosts: 0 });
  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>설정</h2>

      {/* 의견 / 버그 제보 버튼 */}
      <button
        type="button"
        className={styles.feedbackBanner}
        onClick={() => setFeedbackOpen(true)}
      >
        <div className={`${styles.toolIconWrap} ${styles.toolIconBlue}`}>
          <MessageSquarePlus size={20} />
        </div>
        <div className={styles.feedbackBannerText}>
          <span className={styles.feedbackBannerTitle}>의견 / 버그 제보</span>
          <span className={styles.feedbackBannerSub}>
            <Lock size={10} className={styles.feedbackLockIcon} />
            완전 익명 · 이름·사번 수집 없음
          </span>
        </div>
        <ChevronRight size={16} className={styles.toolArrow} />
      </button>

      {/* 오늘의 현황 */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{stats.todayVisitors}</span>
          <span className={styles.statLabel}>오늘 접속</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNum}>{stats.todayPosts}</span>
          <span className={styles.statLabel}>새 소식</span>
        </div>
      </div>

      {/* 내 기관사 (인증된 사용자 — 변경 불가) */}
      <div className={styles.driverCard}>
        <div className={styles.driverAvatar}>
          {authUser ? authUser.name[0] : myDriver ? myDriver.n[0] : <UserRoundPen size={20} />}
        </div>
        <div className={styles.driverInfo}>
          <span className={styles.driverNameText}>{authUser?.name ?? myDriver?.n ?? '기관사'}</span>
          <span className={styles.driverNumText}>답십리 승무사업소 · 인증됨</span>
        </div>
        <ShieldCheck size={18} className={styles.toolArrow} />
      </div>

      {/* 조회 모드 안내 */}
      {isViewMode && (
        <div className={styles.viewModeInfo}>
          <span>현재 <strong>{driver?.n}</strong> 조회 중</span>
          <button type="button" className={styles.viewModeBackBtn} onClick={backToMe}>
            내 보기로 돌아가기
          </button>
        </div>
      )}

      {/* 도구 섹션 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>도구</h3>

        <button
          type="button"
          className={`${styles.toolBtn} ${styles.toolBtnHighlight}`}
          onClick={() => setCompareOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconPurple}`}>
              <GitCompareArrows size={20} />
            </div>
            <span className={styles.settingLabel}>교번 비교</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setShuttleOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconBlue}`}>
              <Car size={20} />
            </div>
            <span className={styles.settingLabel}>승용차 운행 시간표(고덕기지 입고열차)</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setShortcutsOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconAmber}`}>
              <Bookmark size={20} />
            </div>
            <span className={styles.settingLabel}>내 바로가기</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setContactsOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconRed}`}>
              <Phone size={20} />
            </div>
            <span className={styles.settingLabel}>비상 연락처</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setSubwayOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconGreen}`}>
              <Search size={20} />
            </div>
            <span className={styles.settingLabel}>경로 검색</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setCommuteOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconBlue}`}>
              <TrainFront size={20} />
            </div>
            <span className={styles.settingLabel}>도착 정보</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setHealingOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconGreen}`}>
              <CreditCard size={20} />
            </div>
            <span className={styles.settingLabel}>힐링카드 잔액조회</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        {/* 홈 화면 추가 — 미설치 상태에서만 노출 */}
        {!isInstalled && (canInstall || isIOS || isAndroid) && (
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => {
              if (canInstall) install();
              else setInstallGuideOpen(true);
            }}
          >
            <div className={styles.settingInfo}>
              <div className={`${styles.toolIconWrap} ${styles.toolIconBlue}`}>
                <Smartphone size={20} />
              </div>
              <span className={styles.settingLabel}>홈 화면에 추가</span>
            </div>
            <ChevronRight size={18} className={styles.toolArrow} />
          </button>
        )}
      </section>

      {/* 설정 섹션 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>설정</h3>

        {/* 다크모드 토글 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className={styles.settingLabel}>다크 모드</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : ''}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="다크 모드 토글"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        {/* 글자 크기 */}
        <div className={styles.fontSizeRow}>
          <div className={styles.fontSizeInfo}>
            <span className={styles.settingIcon}>🔤</span>
            <span className={styles.settingLabel}>글자 크기</span>
          </div>
          <div className={styles.fontSizeBtnGroup}>
            {([
              { key: 'small' as FontSize, label: '작게', cls: styles.fontSizeBtnSmall },
              { key: 'normal' as FontSize, label: '보통', cls: styles.fontSizeBtnNormal },
              { key: 'large' as FontSize, label: '크게', cls: styles.fontSizeBtnLarge },
            ]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`${styles.fontSizeBtn} ${opt.cls} ${fontSize === opt.key ? styles.fontSizeBtnActive : ''}`}
                onClick={() => setFontSize(opt.key)}
                aria-pressed={fontSize === opt.key}
                aria-label={`글자 크기 ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 알림 설정 */}
        {notifSupported && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingIcon}>🔔</span>
              <span className={styles.settingLabel}>알림</span>
            </div>
            {notifPerm === 'granted' ? (
              <span className={styles.settingValue}>허용되어 있어요</span>
            ) : notifPerm === 'denied' ? (
              <span className={styles.settingValue}>차단되어 있어요</span>
            ) : (
              <button
                type="button"
                className={styles.notifBtn}
                onClick={requestPermission}
              >
                허용할게요
              </button>
            )}
          </div>
        )}

        {/* 푸시 알림 (앱 꺼져있어도 수신) */}
        {pushSupported && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingIcon}>📲</span>
              <span className={styles.settingLabel}>푸시 알림</span>
            </div>
            {pushSubscribed ? (
              <button
                type="button"
                className={styles.notifBtn}
                onClick={pushUnsubscribe}
                disabled={pushLoading}
              >
                {pushLoading ? '처리 중...' : '해제'}
              </button>
            ) : (
              <button
                type="button"
                className={styles.notifBtn}
                onClick={pushSubscribe}
                disabled={pushLoading}
              >
                {pushLoading ? '처리 중...' : '켜기'}
              </button>
            )}
          </div>
        )}

        {/* 앱 정보 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>ℹ️</span>
            <span className={styles.settingLabel}>버전</span>
          </div>
          <span className={styles.settingValue}>{APP_VERSION}</span>
        </div>

        {/* 로그아웃 */}
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={async () => {
            if (window.confirm('로그아웃 하시겠습니까?')) {
              await authLogout();
              driverLogout();
            }
          }}
        >
          <LogOut size={18} />
          <span>{authUser ? `${authUser.name} 로그아웃` : '로그아웃'}</span>
        </button>
      </section>

      {/* 보안 섹션 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>보안</h3>

        {/* 생체인증 등록/상태 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}><Fingerprint size={16} /></span>
            <span className={styles.settingLabel}>생체인증</span>
          </div>
          {hasBiometric ? (
            <span className={styles.settingValue}>등록됨 ✓</span>
          ) : (
            <button
              type="button"
              className={styles.notifBtn}
              onClick={() => registerBiometric()}
            >
              등록하기
            </button>
          )}
        </div>

        {/* PIN 변경 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}><KeyRound size={16} /></span>
            <span className={styles.settingLabel}>PIN 변경</span>
          </div>
          <button
            type="button"
            className={styles.notifBtn}
            onClick={() => {
              setCurPin(''); setNewPin(''); setNewPinConfirm(''); setPinError('');
              setPinChangeOpen(true);
            }}
          >
            변경하기
          </button>
        </div>
      </section>

      {/* 관리자 섹션 — admin role만 표시 */}
      {authUser?.role === 'admin' && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>관리자</h3>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setAdminDashOpen(true)}
          >
            <div className={styles.settingInfo}>
              <div className={`${styles.toolIconWrap} ${styles.toolIconBlue}`}>
                <BarChart3 size={20} />
              </div>
              <span className={styles.settingLabel}>접속 현황판</span>
            </div>
            <ChevronRight size={16} className={styles.toolArrow} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setAdminFeedbackOpen(true)}
          >
            <div className={styles.settingInfo}>
              <div className={`${styles.toolIconWrap} ${styles.toolIconPurple}`}>
                <ClipboardList size={20} />
              </div>
              <span className={styles.settingLabel}>제보 목록 보기</span>
            </div>
            <ChevronRight size={16} className={styles.toolArrow} />
          </button>
        </section>
      )}

      {/* 등급도전 현황 — 이현구만 */}
      {authUser?.sabun === LEVEL_ADMIN_SABUN && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>교육 관리</h3>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setLevelRecordsOpen(true)}
          >
            <div className={styles.settingInfo}>
              <div className={`${styles.toolIconWrap} ${styles.toolIconGreen}`}>
                <ShieldCheck size={20} />
              </div>
              <span className={styles.settingLabel}>등급도전 현황</span>
            </div>
            <ChevronRight size={16} className={styles.toolArrow} />
          </button>
        </section>
      )}

      {/* PIN 변경 모달 */}
      {pinChangeOpen && (
        <div className={styles.fullOverlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayClose}
              onClick={() => setPinChangeOpen(false)}
              aria-label="닫기"
            >
              <X size={22} />
            </button>
            <h2 className={styles.overlayTitle}>PIN 변경</h2>
          </div>
          <div className={styles.overlayBody}>
            <div className={styles.pinChangeForm}>
              <div className={styles.pinField}>
                <label className={styles.pinLabel}>현재 PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className={styles.pinInput}
                  placeholder="현재 PIN"
                  value={curPin}
                  onChange={(e) => { setCurPin(e.target.value); setPinError(''); }}
                  maxLength={10}
                  autoFocus
                />
              </div>
              <div className={styles.pinField}>
                <label className={styles.pinLabel}>새 PIN (4자리 이상)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className={styles.pinInput}
                  placeholder="새 PIN"
                  value={newPin}
                  onChange={(e) => { setNewPin(e.target.value); setPinError(''); }}
                  maxLength={10}
                />
              </div>
              <div className={styles.pinField}>
                <label className={styles.pinLabel}>새 PIN 확인</label>
                <input
                  type="password"
                  inputMode="numeric"
                  className={styles.pinInput}
                  placeholder="새 PIN 확인"
                  value={newPinConfirm}
                  onChange={(e) => { setNewPinConfirm(e.target.value); setPinError(''); }}
                  maxLength={10}
                />
              </div>
              {pinError && <p className={styles.pinError}>{pinError}</p>}
              <button
                type="button"
                className={styles.pinSubmit}
                disabled={pinLoading}
                onClick={async () => {
                  if (!curPin) { setPinError('현재 PIN을 입력해주세요'); return; }
                  if (newPin.length < 4) { setPinError('새 PIN은 4자리 이상이어야 합니다'); return; }
                  if (newPin !== newPinConfirm) { setPinError('새 PIN이 일치하지 않습니다'); return; }
                  setPinLoading(true);
                  const res = await fetch('/api/auth/pin/change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPin: curPin, newPin }),
                  });
                  const data = await res.json();
                  setPinLoading(false);
                  if (!res.ok) { setPinError(data.message || 'PIN 변경에 실패했습니다'); return; }
                  setPinChangeOpen(false);
                  alert('PIN이 변경되었습니다');
                }}
              >
                {pinLoading ? '변경 중...' : 'PIN 변경'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS 홈 화면 추가 안내 모달 */}
      {installGuideOpen && (
        <div className={styles.fullOverlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayClose}
              onClick={() => setInstallGuideOpen(false)}
              aria-label="닫기"
            >
              <X size={22} />
            </button>
            <h2 className={styles.overlayTitle}>홈 화면에 추가</h2>
          </div>
          <div className={styles.overlayBody}>
            {isIOS ? (
              /* ── iOS Safari 안내 ── */
              <div className={styles.installGuide}>
                <p className={styles.installGuideDesc}>
                  Safari에서 홈 화면에 추가하면 앱처럼 바로 열 수 있어요.
                </p>
                <ol className={styles.installSteps}>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>1</span>
                    <div className={styles.installStepText}>
                      <strong>Safari 하단 공유 버튼</strong> 탭<br />
                      <span className={styles.installStepSub}>화면 아래 가운데 □↑ 아이콘</span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>2</span>
                    <div className={styles.installStepText}>
                      <strong>홈 화면에 추가</strong> 선택<br />
                      <span className={styles.installStepSub}>목록을 아래로 스크롤하면 보여요</span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>3</span>
                    <div className={styles.installStepText}>
                      <strong>오른쪽 상단 추가</strong> 탭<br />
                      <span className={styles.installStepSub}>이름은 그대로 두면 돼요</span>
                    </div>
                  </li>
                </ol>
                <p className={styles.installGuideTip}>
                  💡 설치 후에는 주소창 없이 앱처럼 실행돼요
                </p>
              </div>
            ) : (
              /* ── Android 비크롬 브라우저 안내 ── */
              <div className={styles.installGuide}>
                <p className={styles.installGuideDesc}>
                  지금 보고 계신 화면(네이버·카톡 등)에서는<br />
                  <strong>홈 화면 추가가 안 돼요.</strong><br />
                  <strong>Chrome 앱</strong>으로 열어야 설치할 수 있어요.
                </p>
                <ol className={styles.installSteps}>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>1</span>
                    <div className={styles.installStepText}>
                      아래 <strong>파란 버튼</strong>을 누르세요<br />
                      <span className={styles.installStepSub}>Chrome 앱이 자동으로 열려요</span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>2</span>
                    <div className={styles.installStepText}>
                      화면 아래에 뜨는 <strong>"앱 설치"</strong>를 누르세요<br />
                      <span className={styles.installStepSub}>"홈 화면에 추가"라고 뜨기도 해요</span>
                    </div>
                  </li>
                </ol>
                <button
                  type="button"
                  className={styles.openInChromeBtn}
                  onClick={openInChrome}
                >
                  Chrome으로 열기
                </button>
                <p className={styles.installGuideTip}>
                  💡 Chrome이 없으면 자동으로 Play 스토어가 열려요
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 기관사 변경 팝업 제거됨 — 인증된 사용자로 고정 */}

      {/* 모달 오버레이 */}
      <CommuteOverlay
        open={commuteOpen}
        onClose={() => setCommuteOpen(false)}
      />
      <SubwaySearchOverlay
        open={subwayOpen}
        onClose={() => setSubwayOpen(false)}
      />

      {/* 연락처 오버레이 */}
      {contactsOpen && (
        <div className={styles.fullOverlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayClose}
              onClick={() => setContactsOpen(false)}
              aria-label="닫기"
            >
              <X size={22} />
            </button>
            <h2 className={styles.overlayTitle}>비상 연락처</h2>
          </div>
          <div className={styles.overlayBody}>
            <ContactsTab />
          </div>
        </div>
      )}

      {/* 힐링카드 오버레이 */}
      <HealingCardOverlay
        open={healingOpen}
        onClose={() => setHealingOpen(false)}
      />

      {/* 승용차 운행 시간표 오버레이 */}
      <ShuttleScheduleOverlay
        open={shuttleOpen}
        onClose={() => setShuttleOpen(false)}
      />

      {/* 바로가기 오버레이 */}
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* 익명 제보 오버레이 */}
      {feedbackOpen && (
        <FeedbackOverlay onClose={() => setFeedbackOpen(false)} />
      )}

      {/* 관리자 현황판 */}
      {adminDashOpen && (
        <AdminDashboard onClose={() => setAdminDashOpen(false)} />
      )}

      {/* 관리자 제보 목록 오버레이 */}
      {adminFeedbackOpen && (
        <AdminFeedbackOverlay onClose={() => setAdminFeedbackOpen(false)} />
      )}

      {/* 등급도전 현황 오버레이 */}
      <LevelRecordsOverlay open={levelRecordsOpen} onClose={() => setLevelRecordsOpen(false)} />

      {/* 교번 비교 오버레이 */}
      {compareOpen && (
        <div className={styles.fullOverlay}>
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayClose}
              onClick={() => setCompareOpen(false)}
              aria-label="닫기"
            >
              <X size={22} />
            </button>
            <h2 className={styles.overlayTitle}>교번 비교</h2>
          </div>
          <div className={styles.overlayBody}>
            <CompareTab />
          </div>
        </div>
      )}
    </div>
  );
}
