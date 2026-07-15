'use client';

import { useState, useCallback } from 'react';
import { GitCompareArrows, RefreshCw, Phone, CreditCard, ChevronRight, X, Car, MessageSquarePlus, Lock, MapPin } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { CompareTab, CompareErrorBoundary } from '@/features/compare';
import { ContactsTab } from '@/features/contacts';
import ExchangeRequest from '@/features/calendar/components/ExchangeRequest';
import HealingCardOverlay from './HealingCardOverlay';
import ShuttleScheduleOverlay from './ShuttleScheduleOverlay';
import JubakLocationOverlay from './JubakLocationOverlay';
import FeedbackOverlay from './FeedbackOverlay';
import styles from '../styles/More.module.css';

/** 더보기 탭 — 도구 모음. 설정은 SettingsOverlay 로 분리됐다(양쪽 홈 헤더의 기어에서 연다). */
export default function MoreTab() {
  const [compareOpen, setCompareOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [healingOpen, setHealingOpen] = useState(false);
  const [shuttleOpen, setShuttleOpen] = useState(false);
  const [jubakOpen, setJubakOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const anyOverlayOpen = compareOpen || contactsOpen || exchangeOpen
    || healingOpen || shuttleOpen || jubakOpen || feedbackOpen;
  const closeActiveOverlay = useCallback(() => {
    if (compareOpen) setCompareOpen(false);
    else if (contactsOpen) setContactsOpen(false);
    else if (exchangeOpen) setExchangeOpen(false);
    else if (healingOpen) setHealingOpen(false);
    else if (shuttleOpen) setShuttleOpen(false);
    else if (jubakOpen) setJubakOpen(false);
    else if (feedbackOpen) setFeedbackOpen(false);
  }, [compareOpen, contactsOpen, exchangeOpen, healingOpen, shuttleOpen, jubakOpen, feedbackOpen]);
  useHistoryBack('more-overlay', closeActiveOverlay, anyOverlayOpen);

  useEscapeClose(contactsOpen || compareOpen || exchangeOpen, closeActiveOverlay);

  return (
    <div className={styles.container}>
      <h2 className={`${styles.pageTitle} z-app-header z-app-header-frost`}>
        <span>일상생활 서비스</span>
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

      {/* 익명 제보 오버레이 */}
      {feedbackOpen && (
        <FeedbackOverlay onClose={() => setFeedbackOpen(false)} />
      )}

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
    </div>
  );
}
