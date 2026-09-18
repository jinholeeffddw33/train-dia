'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Scale, CalendarDays, ListChecks, Lock, Gift } from 'lucide-react';
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
 * 청렴 경진대회 안내 팝업 (2026-09-18 ~ 09-27).
 *
 * 대회 기간에만 뜨고, 기간이 지나면 저절로 내려간다.
 * «바로 응시하기» 는 팝업을 닫고 곧장 문제 시트를 연다 — 홈에서 아이콘을 찾게 하지 않는다.
 * 이미 응시한 사람에게는 뜨지 않는다(응시는 한 번뿐이라 또 부르면 성가시기만 하다).
 */
const STORAGE_KEY = 'integrity-quiz-2026-09-dismiss';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inWindow(): boolean {
  const today = todayStr();
  if (today < INTEGRITY_OPEN_FROM || today > INTEGRITY_OPEN_UNTIL) return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === today) return false;
  } catch { /* ignore */ }
  return true;
}

export default function IntegrityAnnounceModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const openQuiz = useIntegrityStore((s) => s.openQuiz);
  const ensureStatus = useIntegrityStore((s) => s.ensureStatus);
  const submitted = useIntegrityStore((s) => s.submitted);
  const statusChecked = useIntegrityStore((s) => s.statusChecked);

  // 이미 낸 사람인지 알아야 부를지 정할 수 있다. 서버가 못 답해 끝까지 null 이면
  // 그냥 띄운다 — 안내를 못 본 채 기간이 지나는 쪽이 더 손해다.
  useEffect(() => {
    if (!inWindow()) return;
    ensureStatus();
  }, [ensureStatus]);

  useEffect(() => {
    if (!statusChecked || asked.current || submitted === true || !inWindow()) return;
    asked.current = true;
    requestEntryModal('integrity-quiz-2026-09', () => setOpen(true));
  }, [statusChecked, submitted]);

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

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="청렴 경진대회 안내"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Scale size={18} className={styles.titleIcon} />
            <h2 className={styles.title}>청렴 경진대회</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="닫기">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.noticeBody}>
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
            onClick={handleGo}
            data-press
          >
            바로 응시하기
          </button>
        </div>
      </div>
    </div>
  );
}
