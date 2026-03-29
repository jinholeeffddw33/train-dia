'use client';

import { useState } from 'react';
import { TrainFront, Search, GitCompareArrows, Phone, CreditCard, ChevronRight, X, UserRoundPen, Bookmark, Car, LogOut } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { useThemeStore } from '@/stores/theme';
import { useFontSizeStore, type FontSize } from '@/stores/fontSize';
import { useNotification } from '@/hooks/useNotification';
import { CommuteOverlay } from '@/features/commute';
import { SubwaySearchOverlay } from '@/features/subway';
import { CompareTab } from '@/features/compare';
import { ContactsTab } from '@/features/contacts';
import { DriverSelector } from '@/features/home';
import HealingCardOverlay from './HealingCardOverlay';
import ShuttleScheduleOverlay from './ShuttleScheduleOverlay';
import ShortcutsOverlay from './ShortcutsOverlay';
import styles from '../styles/More.module.css';

export default function MoreTab() {
  const driver = useDriverStore((s) => s.current);
  const myDriver = useDriverStore((s) => s.myDriver);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const setMyDriver = useDriverStore((s) => s.setMyDriver);
  const backToMe = useDriverStore((s) => s.backToMe);
  const logout = useDriverStore((s) => s.logout);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const { size: fontSize, setSize: setFontSize } = useFontSizeStore();
  const { supported: notifSupported, permission: notifPerm, requestPermission } = useNotification();
  const [commuteOpen, setCommuteOpen] = useState(false);
  const [subwayOpen, setSubwayOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [healingOpen, setHealingOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shuttleOpen, setShuttleOpen] = useState(false);
  const [confirmChangeOpen, setConfirmChangeOpen] = useState(false);

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>설정</h2>

      {/* 내 기관사 (행위 주체) */}
      <button
        type="button"
        className={styles.driverCard}
        onClick={() => {
          if (myDriver) {
            setConfirmChangeOpen(true);
          } else {
            setDriverOpen(true);
          }
        }}
        aria-label="내 기관사 변경"
      >
        <div className={styles.driverAvatar}>
          {myDriver ? myDriver.n[0] : driver ? driver.n[0] : <UserRoundPen size={20} />}
        </div>
        <div className={styles.driverInfo}>
          <span className={styles.driverNameText}>{myDriver ? myDriver.n : driver ? driver.n : '기관사 선택'}</span>
          <span className={styles.driverNumText}>답십리 승무사업소 · 내 계정</span>
        </div>
        <ChevronRight size={18} className={styles.toolArrow} />
      </button>

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
          className={styles.toolBtn}
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

        {/* 앱 정보 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>ℹ️</span>
            <span className={styles.settingLabel}>버전</span>
          </div>
          <span className={styles.settingValue}>v2.1.0</span>
        </div>

        {/* 로그아웃 */}
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={() => {
            if (window.confirm('로그아웃 하시겠습니까?')) {
              logout();
            }
          }}
        >
          <LogOut size={18} />
          <span>로그아웃</span>
          {myDriver && <span className={styles.logoutUser}>{myDriver.n}</span>}
        </button>
      </section>

      {/* 내 기관사 변경 확인 팝업 */}
      {confirmChangeOpen && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmChangeOpen(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>내 기관사를 변경하시겠어요?</h3>
            <p className={styles.confirmDesc}>
              변경하면 게시글 작성, 교대 요청 등이<br />
              새 기관사 이름으로 동작합니다.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => setConfirmChangeOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirmOk}
                onClick={() => {
                  setConfirmChangeOpen(false);
                  setDriverOpen(true);
                }}
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기관사 선택 모달 (설정에서 열면 myDriver로 설정) */}
      <DriverSelector
        open={driverOpen}
        onClose={() => setDriverOpen(false)}
        onSelectOverride={(person) => {
          setMyDriver(person);
          setDriverOpen(false);
        }}
      />

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
