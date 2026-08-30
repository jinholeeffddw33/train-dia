'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, UserRoundPen, Bookmark, LogOut, KeyRound, ShieldCheck, Smartphone, ClipboardList, BarChart3, Users } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { openInChrome } from '@/hooks/useInAppBrowser';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { useFontSizeStore, type FontSize } from '@/stores/fontSize';
import { useNotification } from '@/hooks/useNotification';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { Browser } from '@capacitor/browser';
import { isNativeApp } from '@/lib/native/platform';
import AlarmSettings from './AlarmSettings';
import ShortcutsOverlay from './ShortcutsOverlay';
import AdminFeedbackOverlay from './AdminFeedbackOverlay';
import AdminDashboard from './AdminDashboard';
import RosterAdmin from './RosterAdmin';
import LevelRecordsOverlay from './LevelRecordsOverlay';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { showToast } from '@/components/common/Toast';
import { APP_VERSION } from '@/lib/constants';
import { COPYRIGHT_NOTICE } from '@/lib/provenance';
import styles from '../styles/More.module.css';

const LEVEL_ADMIN_SABUN = '21711694'; // 이현구

/**
 * 설정 오버레이 — 월드허브·일정관리(내근직 홈) 양쪽 헤더의 기어에서 연다.
 * page.tsx 가 단일 인스턴스로 들고 있어 어느 홈에서 열든 같은 화면이다.
 * 이전엔 더보기 탭 안에만 있어 내근직은 기관사 화면을 거쳐 5탭을 눌러야 했다.
 */
export default function SettingsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const driver = useDriverStore((s) => s.current);
  const myDriver = useDriverStore((s) => s.myDriver);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const backToMe = useDriverStore((s) => s.backToMe);
  const driverLogout = useDriverStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const authLogout = useAuthStore((s) => s.logout);
  const { size: fontSize, setSize: setFontSize } = useFontSizeStore();
  const { supported: notifSupported, permission: notifPerm, requestPermission } = useNotification();
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription();
  const { canInstall, isInstalled, isIOS, isAndroid, isInApp, install } = useInstallPrompt();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [adminFeedbackOpen, setAdminFeedbackOpen] = useState(false);
  const [adminDashOpen, setAdminDashOpen] = useState(false);
  const [rosterAdminOpen, setRosterAdminOpen] = useState(false);
  const [levelRecordsOpen, setLevelRecordsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // 하위 오버레이가 열려 있으면 뒤로가기/ESC 는 그것부터 닫는다 (설정은 마지막)
  const anySub = shortcutsOpen || pinChangeOpen || installGuideOpen
    || adminFeedbackOpen || adminDashOpen || rosterAdminOpen || levelRecordsOpen;
  const closeSub = useCallback(() => {
    if (shortcutsOpen) setShortcutsOpen(false);
    else if (pinChangeOpen) setPinChangeOpen(false);
    else if (installGuideOpen) setInstallGuideOpen(false);
    else if (adminFeedbackOpen) setAdminFeedbackOpen(false);
    else if (adminDashOpen) setAdminDashOpen(false);
    else if (rosterAdminOpen) setRosterAdminOpen(false);
    else if (levelRecordsOpen) setLevelRecordsOpen(false);
  }, [shortcutsOpen, pinChangeOpen, installGuideOpen, adminFeedbackOpen, adminDashOpen, rosterAdminOpen, levelRecordsOpen]);

  useHistoryBack('settings', onClose, open && !anySub);
  useHistoryBack('settings-sub', closeSub, anySub);
  useEscapeClose(anySub, closeSub);
  useEscapeClose(open && !anySub, onClose);

  // 오늘 통계
  const [stats, setStats] = useState({ todayVisitors: 0, todayPosts: 0 });
  useEffect(() => {
    if (!open) return;
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="설정">
        <div className={styles.overlayHeader}>
          <button
            type="button"
            className={styles.overlayClose}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={22} />
          </button>
          <h2 className={styles.overlayTitle}>설정</h2>
        </div>
        <div className={`${styles.overlayBody} ${styles.settingsBody}`}>

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

      {/* 화면 — 다크 모드는 홈 헤더의 1탭 토글이 담당(중복 제거), 여기선 글자 크기만 */}
      <p className={styles.setGroupTitle}>화면</p>
      <div className={`${styles.ctrlRow} ${styles.ctrlRowStack}`}>
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
      <p className={styles.setGroupTitle}>알림</p>
      {/*
        근무 알람 — 2026-08-18 복원.
        엔진(useSegmentAlarm)은 계속 돌고 있었는데 켜는 UI 만 홈 재구성 때 빠져서
        기능이 통째로 죽어 있었다. 조건 없이 항상 보여 준다(웹/앱 모두 의미가 있다).
      */}
      <AlarmSettings />
      {(notifSupported || pushSupported || (isIOS && !isInstalled)) && (
        <>
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
            <button type="button" className={styles.tile} data-press onClick={() => setRosterAdminOpen(true)}>
              <span className={`${styles.tileIcon} ${styles.toolIconGreen}`}><Users size={18} /></span>
              <span className={styles.tileLabel}>명부 관리</span>
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
      {/*
        개인정보처리방침 — 법이 "정보주체가 쉽게 확인할 수 있도록 공개"를 요구하고,
        스토어 심사도 앱 안에서 닿는지를 본다. 별도 라우트(/privacy)라 로그인 없이도 열린다.
        네이티브에서는 인앱 브라우저로 띄운다 — 같은 WebView 에서 이동하면 앱이 통째로
        다시 로드돼 로그인 화면부터 다시 그려진다.
      */}
      <button
        type="button"
        className={styles.privacyLink}
        onClick={() => {
          const url = `${window.location.origin}/privacy`;
          if (isNativeApp()) Browser.open({ url }).catch(() => { window.location.href = url; });
          else window.open(url, '_blank', 'noopener');
        }}
      >
        개인정보처리방침
      </button>
      <p className={styles.setFooterText}>{APP_VERSION} · {COPYRIGHT_NOTICE}</p>

        </div>
      </div>

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
            ) : isInApp ? (
              /* ── 인앱 웹뷰(카톡·네이버 등) — 여기서는 설치가 원천적으로 안 된다 ── */
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
                      Chrome에서 다시 <strong>홈 화면 추가</strong>를 누르세요<br />
                      <span className={styles.installStepSub}>설치 창이 바로 떠요</span>
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
            ) : (
              /* ── Android Chrome — 설치는 되는데 신호가 아직 안 온 상태. 메뉴로 안내.
                   예전엔 이 자리에도 '네이버·카톡' 안내가 떠서 Chrome 사용자가
                   'Chrome으로 열기'를 눌러도 같은 화면만 다시 뜨고 설치가 안 됐다. ── */
              <div className={styles.installGuide}>
                <p className={styles.installGuideDesc}>
                  Chrome 메뉴에서 <strong>홈 화면에 추가</strong>하면<br />
                  앱처럼 바로 열 수 있어요.
                </p>
                <ol className={styles.installSteps}>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>1</span>
                    <div className={styles.installStepText}>
                      오른쪽 위 <strong>⋮ (점 3개)</strong> 탭<br />
                      <span className={styles.installStepSub}>주소창 오른쪽 끝에 있어요</span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>2</span>
                    <div className={styles.installStepText}>
                      <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong> 선택<br />
                      <span className={styles.installStepSub}>Chrome 버전에 따라 이름이 달라요</span>
                    </div>
                  </li>
                  <li className={styles.installStep}>
                    <span className={styles.installStepNum}>3</span>
                    <div className={styles.installStepText}>
                      <strong>설치</strong> 탭<br />
                      <span className={styles.installStepSub}>이름은 그대로 두면 돼요</span>
                    </div>
                  </li>
                </ol>
                <p className={styles.installGuideTip}>
                  💡 메뉴에 안 보이면 페이지를 새로고침한 뒤 다시 열어보세요
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 바로가기 오버레이 */}
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* 관리자 현황판 */}
      {adminDashOpen && (
        <AdminDashboard onClose={() => setAdminDashOpen(false)} />
      )}

      {rosterAdminOpen && (
        <RosterAdmin onClose={() => setRosterAdminOpen(false)} />
      )}

      {/* 관리자 제보 목록 오버레이 */}
      {adminFeedbackOpen && (
        <AdminFeedbackOverlay onClose={() => setAdminFeedbackOpen(false)} />
      )}

      {/* 등급도전 현황 오버레이 */}
      <LevelRecordsOverlay open={levelRecordsOpen} onClose={() => setLevelRecordsOpen(false)} />

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

    </>
  );
}
