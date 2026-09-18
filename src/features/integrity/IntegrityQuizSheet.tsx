'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Scale, CalendarDays, ListChecks, Lock, Gift, CheckCircle2, Send, AlertTriangle, BarChart3 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import LoadingDots from '@/components/common/LoadingDots';
import { useIntegrityStore } from '@/stores/integrity';
import {
  INTEGRITY_QUESTIONS,
  INTEGRITY_TOTAL,
  INTEGRITY_CHOICE_COUNT,
  INTEGRITY_OX_COUNT,
  INTEGRITY_TITLE,
  INTEGRITY_SUBTITLE,
  INTEGRITY_PERIOD_LABEL,
  INTEGRITY_AWARD_LABEL,
} from '@/data/integrityQuiz';
import styles from './Integrity.module.css';

const IntegrityResults = dynamic(() => import('./IntegrityResults'), { ssr: false });

type Stage = 'loading' | 'error' | 'intro' | 'quiz' | 'done' | 'already' | 'before' | 'closed';

interface StatusResponse {
  phase: 'before' | 'open' | 'closed';
  submitted: boolean;
  submittedAt: string | null;
  isAdmin: boolean;
}

function dateLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 청렴 문제풀기 경진대회 — 응시 시트.
 *
 * 규칙 세 가지가 화면을 결정한다.
 *   · 한 번만 응시한다 → 이미 낸 사람에게는 문제를 아예 보여주지 않는다
 *   · 정답도 점수도 공개하지 않는다 → 제출 뒤 화면에 점수가 없다(서버도 안 돌려준다)
 *   · 9월 18일 ~ 27일에만 연다 → 기간 밖이면 안내만
 * 점수를 보는 문은 관리자용 결과 화면 하나뿐이다.
 */
export default function IntegrityQuizSheet() {
  const open = useIntegrityStore((s) => s.open);
  const closeQuiz = useIntegrityStore((s) => s.closeQuiz);
  const setSubmitted = useIntegrityStore((s) => s.setSubmitted);

  const [stage, setStage] = useState<Stage>('loading');
  const [answers, setAnswers] = useState<(number | null)[]>(() => INTEGRITY_QUESTIONS.map(() => null));
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const loadStatus = useCallback(async () => {
    setStage('loading');
    try {
      const r = await fetch('/api/integrity/status', { cache: 'no-store' });
      if (!r.ok) throw new Error('status');
      const s: StatusResponse = await r.json();
      setIsAdmin(s.isAdmin);
      setSubmittedAt(s.submittedAt);
      setSubmitted(s.submitted); // 홈 아이콘의 «안 낸 사람» 점과 팝업이 같은 사실을 보게
      if (s.submitted) setStage('already');
      else if (s.phase === 'before') setStage('before');
      else if (s.phase === 'closed') setStage('closed');
      else setStage('intro');
    } catch {
      setStage('error');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setShowResults(false);
    setSendError(null);
    loadStatus();
  }, [open, loadStatus]);

  const answered = answers.filter((a) => a !== null).length;
  const allAnswered = answered === INTEGRITY_TOTAL;

  const pick = (index: number, option: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = option;
      return next;
    });
  };

  const submit = async () => {
    if (!allAnswered || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await fetch('/api/integrity/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (r.ok) {
        setSubmitted(true);
        setStage('done');
        return;
      }
      const body = await r.json().catch(() => null);
      const message = typeof body?.message === 'string' ? body.message : '답안을 내지 못했어요. 잠시 후 다시 시도해주세요';
      if (r.status === 409) {
        setSubmitted(true);
        setStage('already');
        return;
      }
      setSendError(message);
    } catch {
      setSendError('연결이 끊겼어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  const adminAction = isAdmin ? (
    <button
      type="button"
      className={`z-glass-pill ${styles.iqAdminBtn}`}
      onClick={() => setShowResults((v) => !v)}
      data-press
    >
      <BarChart3 size={16} strokeWidth={2.4} aria-hidden />
      {showResults ? '문제로' : '결과'}
    </button>
  ) : undefined;

  /** 문제 화면일 때만 하단바 — 다 풀기 전에는 «몇 개 남았는지», 다 풀면 제출하기 */
  const footer =
    stage === 'quiz' && !showResults ? (
      <div className={styles.iqFooter}>
        <span className={styles.iqProgress}>
          {INTEGRITY_TOTAL}문제 중 <strong>{answered}</strong>개 풀었어요
        </span>
        {allAnswered ? (
          <button type="button" className={`z-cta ${styles.iqSubmit}`} onClick={submit} disabled={sending} data-press>
            <Send size={18} strokeWidth={2.4} aria-hidden />
            {sending ? '내는 중…' : '제출하기'}
          </button>
        ) : (
          <span className={styles.iqProgressHint}>{INTEGRITY_TOTAL - answered}개 남았어요</span>
        )}
      </div>
    ) : undefined;

  return (
    <Modal open={open} onClose={closeQuiz} title="청렴 경진대회" headerAction={adminAction} footer={footer}>
      <div className={styles.iqWrap}>
        {showResults ? (
          <IntegrityResults />
        ) : (
          <>
            {stage === 'loading' && (
              <div className={styles.iqCenter}>
                <LoadingDots />
                <p className={styles.iqCenterText}>불러오는 중</p>
              </div>
            )}

            {stage === 'error' && (
              <div className={styles.iqCenter}>
                <AlertTriangle size={28} strokeWidth={2.2} aria-hidden />
                <p className={styles.iqCenterText}>응시 여부를 확인하지 못했어요</p>
                <button type="button" className={`z-glass-pill ${styles.iqRetry}`} onClick={loadStatus} data-press>
                  다시 시도
                </button>
              </div>
            )}

            {(stage === 'intro' || stage === 'before' || stage === 'closed') && (
              <section className={styles.iqIntro}>
                <span className={styles.iqBadgeIcon}>
                  <Scale size={28} strokeWidth={2.2} aria-hidden />
                </span>
                <p className={styles.iqSubtitle}>{INTEGRITY_SUBTITLE}</p>
                <h3 className={styles.iqTitle}>{INTEGRITY_TITLE}</h3>

                <ul className={styles.iqFacts}>
                  <li className={`z-glass-surface ${styles.iqFact}`}>
                    <CalendarDays size={20} strokeWidth={2.2} aria-hidden className={styles.iqFactIcon} />
                    <span className={styles.iqFactText}>
                      <strong>{INTEGRITY_PERIOD_LABEL}</strong>
                      <span>이 기간에만 응시할 수 있어요</span>
                    </span>
                  </li>
                  <li className={`z-glass-surface ${styles.iqFact}`}>
                    <ListChecks size={20} strokeWidth={2.2} aria-hidden className={styles.iqFactIcon} />
                    <span className={styles.iqFactText}>
                      <strong>모두 {INTEGRITY_TOTAL}문제</strong>
                      <span>사지선다 {INTEGRITY_CHOICE_COUNT}문제 · OX 퀴즈 {INTEGRITY_OX_COUNT}문제</span>
                    </span>
                  </li>
                  <li className={`z-glass-surface ${styles.iqFact}`}>
                    <Lock size={20} strokeWidth={2.2} aria-hidden className={styles.iqFactIcon} />
                    <span className={styles.iqFactText}>
                      <strong>응시는 한 번만</strong>
                      <span>정답은 공개하지 않아요</span>
                    </span>
                  </li>
                </ul>

                {/* 상품 — 응시할 마음이 드는 자리. 다른 안내와 같은 무게로 두면 묻힌다.
                    대회가 끝난 뒤(closed)에는 걸지 않는다 — 이제 와서 권할 일이 아니다. */}
                {stage !== 'closed' && (
                  <>
                    <p className={styles.iqPrize}>
                      <Gift size={24} strokeWidth={2.4} aria-hidden />
                      <span>
                        고득점 <strong>5명</strong>에게
                        <br />
                        푸짐한 상품이 있습니다!
                      </span>
                    </p>
                    <p className={styles.iqPrizeWhen}>{INTEGRITY_AWARD_LABEL} 점수로 시상해요</p>
                  </>
                )}

                {stage === 'intro' && (
                  <>
                    <p className={styles.iqCall}>많이 응시해 주세요 🙌</p>
                    <button
                      type="button"
                      className={`z-cta ${styles.iqStart}`}
                      onClick={() => setStage('quiz')}
                      data-press
                    >
                      시작하기
                    </button>
                  </>
                )}
                {stage === 'before' && <p className={styles.iqNotice}>아직 응시 기간이 아니에요.</p>}
                {stage === 'closed' && <p className={styles.iqNotice}>응시 기간이 끝났어요.</p>}
              </section>
            )}

            {stage === 'quiz' && (
              <section className={styles.iqList} aria-label="청렴 문제">
                {INTEGRITY_QUESTIONS.map((q, i) => (
                  <article key={q.no} className={`z-glass-surface ${styles.iqCard}`}>
                    <header className={styles.iqQHead}>
                      <span className={styles.iqQNo}>{q.no}</span>
                      <span className={styles.iqQKind}>{q.type === 'ox' ? 'OX' : '사지선다'}</span>
                    </header>
                    <p className={styles.iqQText}>{q.q}</p>
                    <div className={q.type === 'ox' ? styles.iqOxRow : styles.iqOptions}>
                      {q.options.map((opt, oi) => {
                        const value = oi + 1;
                        const chosen = answers[i] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`${q.type === 'ox' ? styles.iqOx : styles.iqOption} ${chosen ? styles.iqChosen : ''}`}
                            onClick={() => pick(i, value)}
                            aria-pressed={chosen}
                            data-press
                          >
                            {q.type === 'ox' ? (
                              <span className={styles.iqOxMark}>{opt}</span>
                            ) : (
                              <>
                                <span className={styles.iqOptionNo}>{value}</span>
                                <span className={styles.iqOptionText}>{opt}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                ))}
                {sendError && (
                  <p className={styles.iqError} role="alert">
                    {sendError}
                  </p>
                )}
              </section>
            )}

            {stage === 'done' && (
              <section className={styles.iqCenter}>
                <span className={`${styles.iqBadgeIcon} ${styles.iqBadgeDone}`}>
                  <CheckCircle2 size={28} strokeWidth={2.2} aria-hidden />
                </span>
                <h3 className={styles.iqTitle}>제출이 끝났어요</h3>
                <p className={styles.iqCenterText}>
                  응시해 주셔서 고맙습니다.
                  <br />
                  점수는 {INTEGRITY_AWARD_LABEL}에 알려드려요.
                </p>
                <button type="button" className={`z-cta ${styles.iqStart}`} onClick={closeQuiz} data-press>
                  닫기
                </button>
              </section>
            )}

            {stage === 'already' && (
              <section className={styles.iqCenter}>
                <span className={`${styles.iqBadgeIcon} ${styles.iqBadgeDone}`}>
                  <CheckCircle2 size={28} strokeWidth={2.2} aria-hidden />
                </span>
                <h3 className={styles.iqTitle}>이미 응시하셨어요</h3>
                <p className={styles.iqCenterText}>
                  {submittedAt ? `${dateLabel(submittedAt)}에 답안을 내셨어요. ` : ''}
                  응시는 한 번만 할 수 있어요.
                  <br />
                  점수는 {INTEGRITY_AWARD_LABEL}에 알려드려요.
                </p>
                <button type="button" className={`z-cta ${styles.iqStart}`} onClick={closeQuiz} data-press>
                  닫기
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
