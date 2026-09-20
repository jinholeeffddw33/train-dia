'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Scale, CalendarDays, ListChecks, Lock, Gift, Megaphone, TrainFront } from 'lucide-react';
import { requestEntryModal } from '@/lib/entryModalGate';
import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
import { useIntegrityStore } from '@/stores/integrity';
import {
  INTEGRITY_OPEN_FROM,
  INTEGRITY_OPEN_UNTIL,
  INTEGRITY_PERIOD_LABEL,
  INTEGRITY_TOTAL,
  INTEGRITY_CHOICE_COUNT,
  INTEGRITY_OX_COUNT,
  INTEGRITY_TITLE,
  INTEGRITY_SUBTITLE,
} from '@/data/integrityQuiz';
import styles from './InternWelcomeModal.module.css';

/**
 * 9월 기간 한정 안내 팝업 — 청렴 경진대회 + 추석 연휴 근무표.
 *
 * 팝업은 한 세션에 하나만 뜬다(entryModalGate). 그래서 안내를 따로 만들면 서로 밀어내
 * 어느 한쪽을 못 보게 된다 → 한 팝업에 두 칸으로 넣는다.
 *   · 청렴 칸: 대회 기간이고 아직 응시하지 않은 사람에게만
 *   · 추석 칸: 연휴가 끝날 때까지 모두에게(이미 응시한 사람도 근무표는 알아야 한다)
 * 둘 다 해당 없으면 팝업 자체가 뜨지 않고, 날짜가 지나면 저절로 내려간다.
 */
const STORAGE_KEY = 'notice-2026-09-dismiss';

/** 추석 연휴 근무표 안내 — 연휴 마지막 날까지 */
const HOLIDAY_FROM = '2026-09-19';
const HOLIDAY_UNTIL = '2026-09-27';
const HOLIDAY_PERIOD_LABEL = '9월 23일(수) 저녁 ~ 9월 27일(일)';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dismissedToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayStr();
  } catch {
    return false;
  }
}

export default function IntegrityAnnounceModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const openQuiz = useIntegrityStore((s) => s.openQuiz);
  const ensureStatus = useIntegrityStore((s) => s.ensureStatus);
  const submitted = useIntegrityStore((s) => s.submitted);
  const statusChecked = useIntegrityStore((s) => s.statusChecked);

  const today = todayStr();
  const quizWindow = today >= INTEGRITY_OPEN_FROM && today <= INTEGRITY_OPEN_UNTIL;
  const holidayWindow = today >= HOLIDAY_FROM && today <= HOLIDAY_UNTIL;
  /** 청렴 칸은 아직 안 낸 사람에게만 — 낸 사람에게 또 권하면 성가시기만 하다 */
  const showQuiz = quizWindow && submitted !== true;

  // 응시 여부를 알아야 청렴 칸을 넣을지 정한다. 서버가 못 답하면 넣는 쪽으로 둔다
  // (안내를 못 본 채 기간이 지나는 쪽이 더 손해다).
  useEffect(() => {
    if (quizWindow) ensureStatus();
  }, [quizWindow, ensureStatus]);

  useEffect(() => {
    if (asked.current || dismissedToday()) return;
    // 청렴 기간이면 응시 여부를 확인한 뒤에 판단한다(잠깐 기다렸다 뜬다)
    if (quizWindow && !statusChecked) return;
    if (!showQuiz && !holidayWindow) return;
    asked.current = true;
    requestEntryModal('integrity-quiz-2026-09', () => setOpen(true));
  }, [statusChecked, showQuiz, quizWindow, holidayWindow]);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleDismissToday = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, todayStr()); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const handleGo = useCallback(() => {
    setOpen(false);
    openQuiz();
  }, [openQuiz]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    acquireScrollLock();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
    };
  }, [open, handleClose]);

  const head = useMemo(() => {
    if (showQuiz && holidayWindow) return { title: '공지사항', Icon: Megaphone };
    if (showQuiz) return { title: '청렴 경진대회', Icon: Scale };
    return { title: '추석 연휴 근무표', Icon: TrainFront };
  }, [showQuiz, holidayWindow]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={head.title}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <head.Icon size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>{head.title}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="닫기">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.noticeBody}>
            {showQuiz && (
              <>
                <p className={styles.noticeWhere}>{INTEGRITY_SUBTITLE}</p>
                <h3 className={styles.noticeHead}>{INTEGRITY_TITLE}</h3>
                <p className={styles.noticeWhere}>
                  <CalendarDays size={18} strokeWidth={2.2} />
                  {INTEGRITY_PERIOD_LABEL}
                </p>
                <p className={styles.noticeWhere}>
                  <ListChecks size={18} strokeWidth={2.2} />
                  모두 {INTEGRITY_TOTAL}문제 — 사지선다 {INTEGRITY_CHOICE_COUNT}, OX {INTEGRITY_OX_COUNT}
                </p>
                <p className={styles.noticeWhere}>
                  <Lock size={18} strokeWidth={2.2} />
                  응시는 한 번만 할 수 있어요
                </p>
                <p className={styles.noticeAlert}>
                  <Gift size={22} strokeWidth={2.4} aria-hidden />
                  <span>고득점 5명에게 푸짐한 상품이 있습니다!</span>
                </p>
                <p className={styles.noticeText}>많이 응시해 주세요 🙌</p>
              </>
            )}

            {showQuiz && holidayWindow && <div className={styles.noticeDivider} aria-hidden />}

            {holidayWindow && (
              <>
                <h3 className={styles.noticeSubHead}>
                  <TrainFront size={20} strokeWidth={2.2} aria-hidden />
                  추석 연휴 근무표 적용
                </h3>
                <p className={styles.noticeWhere}>
                  <CalendarDays size={18} strokeWidth={2.2} />
                  {HOLIDAY_PERIOD_LABEL}
                </p>
                <p className={styles.noticeText}>
                  연휴 동안 <b>다이아가 줄어</b> 쉬는 번호(운휴)가 생겼어요.
                  <br />
                  달력에서 날짜를 누르면 그날 <b>출퇴근 시각과 행로표</b>를 볼 수 있어요.
                </p>
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`z-glass-pill ${styles.btnSecondary}`}
            onClick={handleDismissToday}
            data-press
          >
            오늘 그만 보기
          </button>
          <button
            type="button"
            className={`z-cta ${styles.btnPrimary}`}
            onClick={showQuiz ? handleGo : handleClose}
            data-press
          >
            {showQuiz ? '바로 응시하기' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
