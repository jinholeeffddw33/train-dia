'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrainFront, Search, GitCompareArrows, RefreshCw, Phone, CreditCard, ChevronRight, X, UserRoundPen, Bookmark, Car, LogOut, Fingerprint, KeyRound, ShieldCheck, Smartphone, MessageSquarePlus, ClipboardList, Lock, BarChart3, MapPin, Settings } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
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
import { CompareTab, CompareErrorBoundary } from '@/features/compare';
import { ContactsTab } from '@/features/contacts';
import ExchangeRequest from '@/features/calendar/components/ExchangeRequest';
// DriverSelector 제거됨 — 기관사 변경은 인증으로 고정
import HealingCardOverlay from './HealingCardOverlay';
import ShuttleScheduleOverlay from './ShuttleScheduleOverlay';
import JubakLocationOverlay from './JubakLocationOverlay';
import ShortcutsOverlay from './ShortcutsOverlay';
import FeedbackOverlay from './FeedbackOverlay';
import AdminFeedbackOverlay from './AdminFeedbackOverlay';
import AdminDashboard from './AdminDashboard';
import LevelRecordsOverlay from './LevelRecordsOverlay';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { showToast } from '@/components/common/Toast';
import { APP_VERSION } from '@/lib/constants';
import { COPYRIGHT_NOTICE } from '@/lib/provenance';
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
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [healingOpen, setHealingOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shuttleOpen, setShuttleOpen] = useState(false);
  const [jubakOpen, setJubakOpen] = useState(false);
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 오버레이 뒤로가기 지원
  const anyOverlayOpen = commuteOpen || subwayOpen || compareOpen || contactsOpen || exchangeOpen
    || healingOpen || shortcutsOpen || shuttleOpen || feedbackOpen
    || adminFeedbackOpen || adminDashOpen || levelRecordsOpen || pinChangeOpen || installGuideOpen
    || settingsOpen;
  const closeActiveOverlay = useCallback(() => {
    if (commuteOpen) setCommuteOpen(false);
    else if (subwayOpen) setSubwayOpen(false);
    else if (compareOpen) setCompareOpen(false);
    else if (contactsOpen) setContactsOpen(false);
    else if (exchangeOpen) setExchangeOpen(false);
    else if (healingOpen) setHealingOpen(false);
    else if (shortcutsOpen) setShortcutsOpen(false);
    else if (shuttleOpen) setShuttleOpen(false);
    else if (feedbackOpen) setFeedbackOpen(false);
    else if (adminFeedbackOpen) setAdminFeedbackOpen(false);
    else if (adminDashOpen) setAdminDashOpen(false);
    else if (levelRecordsOpen) setLevelRecordsOpen(false);
    else if (pinChangeOpen) setPinChangeOpen(false);
    else if (installGuideOpen) setInstallGuideOpen(false);
    // 설정 오버레이는 하위 오버레이가 모두 닫힌 뒤 마지막에 닫힘
    else if (settingsOpen) setSettingsOpen(false);
  }, [commuteOpen, subwayOpen, compareOpen, contactsOpen, exchangeOpen, healingOpen,
      shortcutsOpen, shuttleOpen, feedbackOpen, adminFeedbackOpen,
      adminDashOpen, levelRecordsOpen, pinChangeOpen, installGuideOpen, settingsOpen]);
  useHistoryBack('more-overlay', closeActiveOverlay, anyOverlayOpen);

  // ESC 닫기 — MoreTab 인라인 fullOverlay(PIN 변경/설치 안내/연락처/교번 비교).
  // Commute/Subway 는 공용 Modal 이 자체 ESC 처리하므로 제외 (이중 닫힘 방지).
  useEscapeClose(
    pinChangeOpen || installGuideOpen || contactsOpen || compareOpen || exchangeOpen || settingsOpen,
    closeActiveOverlay,
  );

  // 오늘 통계
  const [stats, setStats] = useState({ todayVisitors: 0, todayPosts: 0 });
  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={`${styles.pageTitle} z-app-header z-app-header-frost`}>
        <span>일상생활 서비스</span>
        <button
          type="button"
          className={styles.settingsGearBtn}
          onClick={() => setSettingsOpen(true)}
          aria-label="설정 열기"
        >
          <Settings size={20} />
        </button>
      </h2>

      {/* 도구 섹션 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>도구</h3>

        <button
          type="button"
          className={`${styles.toolBtn} ${styles.toolBtnHighlight}`}
          onClick={() => setExchangeOpen(true)}
          data-press
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconGreen}`}>
              <RefreshCw size={20} />
            </div>
            <span className={styles.settingLabel}>근무 교체</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={`${styles.toolBtn} ${styles.toolBtnHighlight}`}
          onClick={() => setCompareOpen(true)}
          data-press
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
          className={styles.toolBtn} data-press
          onClick={() => setShuttleOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconBlue}`}>
              <Car size={20} />
            </div>
            <span className={styles.settingLabel}>승용차 운행 시간표</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn} data-press
          onClick={() => setJubakOpen(true)}
        >
          <div className={styles.settingInfo}>
            <div className={`${styles.toolIconWrap} ${styles.toolIconGreen}`}>
              <MapPin size={20} />
            </div>
            <span className={styles.settingLabel}>5호선 주박위치</span>
          </div>
          <ChevronRight size={18} className={styles.toolArrow} />
        </button>

        <button
          type="button"
          className={styles.toolBtn} data-press
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

        <button
          type="button"
          className={styles.toolBtn} data-press
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
          className={styles.toolBtn} data-press
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
          className={styles.toolBtn} data-press
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

      </section>

      {/* 의견 / 버그 제보 버튼 — 맨 아래 */}
      <button
        type="button"
        className={styles.feedbackBanner}
        onClick={() => setFeedbackOpen(true)}
        data-press
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

      {/* ===== 설정 오버레이 (우상단 기어) ===== */}
      {settingsOpen && (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="설정">
        <div className={styles.overlayHeader}>
          <button
            type="button"
            className={styles.overlayClose}
            onClick={() => setSettingsOpen(false)}
            aria-label="닫기"
          >
            <X size={22} />
          </button>
          <h2 className={styles.overlayTitle}>설정</h2>
        </div>
        <div className={styles.overlayBody}>

      {/* 신원 스트립 */}
      <div className={styles.idStrip}>
        <div className={styles.idAvatar}>
          {authUser ? authUser.name[0] : myDriver ? myDriver.n[0] : <UserRoundPen size={18} />}
        </div>
        <div className={styles.idText}>
          <span className={styles.idName}>{authUser?.name ?? myDriver?.n ?? '기관사'}</span>
          <span className={styles.idSub}>답십리 승무사업소 · 인증됨</span>
        </div>
        {isViewMode ? (
          <button type="button" className={styles.idBack} onClick={backToMe}>내 보기로</button>
        ) : (
          <ShieldCheck size={18} className={styles.idShield} />
        )}
      </div>
      {isViewMode && (
        <p className={styles.idViewHint}>현재 <strong>{driver?.n}</strong> 조회 중</p>
      )}

      {/* 오늘의 현황 (한 줄) */}
      <div className={styles.miniStats}>
        오늘 접속 <strong>{stats.todayVisitors}</strong> · 새 소식 <strong>{stats.todayPosts}</strong>
      </div>

      {/* 화면 */}
      <p className={styles.setGroupTitle}>화면</p>
      <div className={styles.ctrlRow}>
        <span className={styles.ctrlLabel}>
          <span className={styles.ctrlIcon}>{theme === 'dark' ? '🌙' : '☀️'}</span>다크 모드
        </span>
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
      <div className={styles.ctrlRow}>
        <span className={styles.ctrlLabel}>
          <span className={styles.ctrlIcon}>🔤</span>글자 크기
        </span>
        <div
          className="z-segment"
          data-no-press
          style={{ '--seg-count': 4, '--seg-idx': (['small', 'normal', 'large', 'xlarge'] as FontSize[]).indexOf(fontSize) } as React.CSSProperties}
        >
          {([
            { key: 'small' as FontSize, label: '작게', cls: styles.fontSizeBtnSmall },
            { key: 'normal' as FontSize, label: '보통', cls: styles.fontSizeBtnNormal },
            { key: 'large' as FontSize, label: '크게', cls: styles.fontSizeBtnLarge },
            { key: 'xlarge' as FontSize, label: '특대', cls: styles.fontSizeBtnLarge },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`z-segment-item ${opt.cls} ${fontSize === opt.key ? 'is-on' : ''}`}
              onClick={() => setFontSize(opt.key)}
              aria-pressed={fontSize === opt.key}
              aria-label={`글자 크기 ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 알림 */}
      {(notifSupported || pushSupported || (isIOS && !isInstalled)) && (
        <>
          <p className={styles.setGroupTitle}>알림</p>
          {notifSupported && (
            <div className={styles.ctrlRow}>
              <span className={styles.ctrlLabel}><span className={styles.ctrlIcon}>🔔</span>알림</span>
              {notifPerm === 'granted' ? (
                <span className={styles.settingValue}>허용됨</span>
              ) : notifPerm === 'denied' ? (
                <span className={styles.settingValue}>차단됨</span>
              ) : (
                <button type="button" className={styles.notifBtn} onClick={requestPermission}>허용할게요</button>
              )}
            </div>
          )}
          {!pushSupported && isIOS && !isInstalled && (
            <div className={styles.ctrlRow}>
              <span className={styles.ctrlLabel}><span className={styles.ctrlIcon}>📲</span>푸시 알림</span>
              <button type="button" className={styles.notifBtn} onClick={() => setInstallGuideOpen(true)}>설치 안내</button>
            </div>
          )}
          {pushSupported && (
            <div className={styles.ctrlRow}>
              <span className={styles.ctrlLabel}><span className={styles.ctrlIcon}>📲</span>푸시 알림</span>
              {pushSubscribed ? (
                <button type="button" className={styles.notifBtn} onClick={pushUnsubscribe} disabled={pushLoading}>
                  {pushLoading ? '처리 중...' : '해제'}
                </button>
              ) : (
                <button type="button" className={styles.notifBtn} onClick={pushSubscribe} disabled={pushLoading}>
                  {pushLoading ? '처리 중...' : '켜기'}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* 기능 · 보안 (타일) */}
      <p className={styles.setGroupTitle}>기능 · 보안</p>
      <div className={styles.tileGrid}>
        <button type="button" className={styles.tile} data-press onClick={() => setShortcutsOpen(true)}>
          <span className={`${styles.tileIcon} ${styles.toolIconAmber}`}><Bookmark size={18} /></span>
          <span className={styles.tileLabel}>내 바로가기</span>
        </button>
        {!isInstalled && (canInstall || isIOS || isAndroid) && (
          <button
            type="button"
            className={styles.tile}
            data-press
            onClick={() => { if (canInstall) install(); else setInstallGuideOpen(true); }}
          >
            <span className={`${styles.tileIcon} ${styles.toolIconBlue}`}><Smartphone size={18} /></span>
            <span className={styles.tileLabel}>홈 화면 추가</span>
          </button>
        )}
        <button
          type="button"
          className={styles.tile}
          data-press
          onClick={() => { if (!hasBiometric) registerBiometric(); }}
        >
          <span className={`${styles.tileIcon} ${styles.toolIconGreen}`}><Fingerprint size={18} /></span>
          <span className={styles.tileLabel}>{hasBiometric ? '생체인증 ✓' : '생체인증'}</span>
        </button>
        <button
          type="button"
          className={styles.tile}
          data-press
          onClick={() => { setCurPin(''); setNewPin(''); setNewPinConfirm(''); setPinError(''); setPinChangeOpen(true); }}
        >
          <span className={`${styles.tileIcon} ${styles.toolIconBlue}`}><KeyRound size={18} /></span>
          <span className={styles.tileLabel}>PIN 변경</span>
        </button>
        {authUser?.role === 'admin' && (
          <>
            <button type="button" className={styles.tile} data-press onClick={() => setAdminDashOpen(true)}>
              <span className={`${styles.tileIcon} ${styles.toolIconBlue}`}><BarChart3 size={18} /></span>
              <span className={styles.tileLabel}>접속 현황판</span>
            </button>
            <button type="button" className={styles.tile} data-press onClick={() => setAdminFeedbackOpen(true)}>
              <span className={`${styles.tileIcon} ${styles.toolIconPurple}`}><ClipboardList size={18} /></span>
              <span className={styles.tileLabel}>제보 목록</span>
            </button>
          </>
        )}
        {authUser?.sabun === LEVEL_ADMIN_SABUN && (
          <button type="button" className={styles.tile} data-press onClick={() => setLevelRecordsOpen(true)}>
            <span className={`${styles.tileIcon} ${styles.toolIconGreen}`}><ShieldCheck size={18} /></span>
            <span className={styles.tileLabel}>등급도전</span>
          </button>
        )}
      </div>

      {/* 로그아웃 + 앱정보 */}
      <button type="button" className={styles.logoutBtnCompact} onClick={() => setLogoutConfirmOpen(true)}>
        <LogOut size={16} />
        <span>{authUser ? `${authUser.name} 로그아웃` : '로그아웃'}</span>
      </button>
      <p className={styles.setFooterText}>{APP_VERSION} · {COPYRIGHT_NOTICE}</p>

        </div>
      </div>
      )}
      {/* ===== /설정 오버레이 ===== */}

      {/* PIN 변경 모달 — 폼 입력 중 실수 방지로 배경탭 닫기는 제외 (ESC/X 만) */}
      {pinChangeOpen && (
        <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="PIN 변경">
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
                  if (newPin.length < 4) { setPinError('새 PIN은 4자리 이상이어야 해요'); return; }
                  if (newPin !== newPinConfirm) { setPinError('새 PIN이 서로 달라요. 다시 확인해주세요'); return; }
                  setPinLoading(true);
                  const res = await fetch('/api/auth/pin/change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPin: curPin, newPin }),
                  });
                  const data = await res.json();
                  setPinLoading(false);
                  if (!res.ok) { setPinError(data.message || 'PIN을 변경하지 못했어요'); return; }
                  setPinChangeOpen(false);
                  showToast('PIN을 변경했어요', 'success');
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
        <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="홈 화면에 추가 안내">
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
                <p className={styles.installGuideTip}>
                  💡 홈 화면에 추가하면 내 교번·설정이 지워지지 않고, 알림도 받을 수 있어요
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
        <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="비상 연락처">
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

      {/* 5호선 주박위치 오버레이 */}
      <JubakLocationOverlay
        open={jubakOpen}
        onClose={() => setJubakOpen(false)}
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

      {/* 근무 교체 오버레이 (탭바에서 설정으로 이동) */}
      {exchangeOpen && (
        <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="근무 교체">
          <div className={styles.overlayHeader}>
            <button
              type="button"
              className={styles.overlayClose}
              onClick={() => setExchangeOpen(false)}
              aria-label="닫기"
            >
              <X size={22} />
            </button>
            <h2 className={styles.overlayTitle}>근무 교체</h2>
          </div>
          <div className={styles.overlayBody}>
            <ExchangeRequest />
          </div>
        </div>
      )}

      {/* 교번 비교 오버레이 */}
      {compareOpen && (
        <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="교번 비교">
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
            <CompareErrorBoundary onReset={() => setCompareOpen(false)}>
              <CompareTab />
            </CompareErrorBoundary>
          </div>
        </div>
      )}

      {/* 로그아웃 확인 */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="로그아웃"
        message="로그아웃할까요? 다시 이용하려면 로그인이 필요해요."
        confirmLabel="로그아웃하기"
        variant="danger"
        onConfirm={async () => {
          setLogoutConfirmOpen(false);
          await authLogout();
          driverLogout();
        }}
        onClose={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}
