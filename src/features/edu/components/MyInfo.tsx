'use client';

import { ArrowLeft, Trophy, Target, TrendingUp, TrendingDown, Minus, BookOpen, RotateCcw, Crosshair } from 'lucide-react';
import { useEduStore, QuizRecord } from '../hooks/useEduStore';
import { useWeakAreas } from '../hooks/useWeakAreas';
import styles from '../styles/edu.module.css';

interface MyInfoProps {
  onBack: () => void;
  onWrongReview: () => void;
  /** 취약 영역 카드에서 그 영역만 다시 풀기 */
  onAreaQuiz?: (areaId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${mi}`;
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'quick': return '빠른';
    case 'standard': return '표준';
    case 'full': return '전체';
    case 'chapter': return '챕터';
    case 'wrong-only': return '오답';
    default: return mode;
  }
}

function scoreColor(percent: number): string {
  if (percent >= 80) return styles.gradeGreen;
  if (percent >= 60) return styles.gradeOrange;
  return styles.gradeRed;
}

function GrowthIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp size={16} className={styles.gradeGreen} />;
  if (value < 0) return <TrendingDown size={16} className={styles.gradeRed} />;
  return <Minus size={16} className={styles.gradeOrange} />;
}

export default function MyInfo({ onBack, onWrongReview, onAreaQuiz }: MyInfoProps) {
  const {
    progress, readCount, totalQuizzes, bestScore, avgScore,
    latestScore, previousScore, streak, wrongCount, unresolvedWrongCount,
  } = useEduStore();
  const { areas: weakAreas } = useWeakAreas();

  const quizHistory = [...progress.quizHistory].reverse(); // 최신순
  const growth = latestScore !== null && previousScore !== null
    ? latestScore - previousScore
    : null;

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>내 정보</h1>
      </div>

      <div className={styles.homeContent}>
        {/* ── 요약 카드 ── */}
        <div className={styles.myInfoSummary}>
          <div className={`${styles.myInfoStat} ${styles.myInfoStatAmber}`}>
            <Trophy size={20} className={styles.myInfoStatIcon} />
            <div className={styles.myInfoStatValue}>
              {totalQuizzes > 0 ? `${bestScore}점` : '-'}
            </div>
            <div className={styles.myInfoStatLabel}>최고 점수</div>
          </div>
          <div className={`${styles.myInfoStat} ${styles.myInfoStatBlue}`}>
            <Target size={20} className={styles.myInfoStatIcon} />
            <div className={styles.myInfoStatValue}>
              {totalQuizzes > 0 ? `${avgScore}점` : '-'}
            </div>
            <div className={styles.myInfoStatLabel}>평균 점수</div>
          </div>
          <div className={`${styles.myInfoStat} ${styles.myInfoStatGreen}`}>
            <BookOpen size={20} className={styles.myInfoStatIcon} />
            <div className={styles.myInfoStatValue}>{readCount}</div>
            <div className={styles.myInfoStatLabel}>학습 섹션</div>
          </div>
        </div>

        {/* ── 성장/스트릭 ── */}
        {(growth !== null || streak >= 2) && (
          <div className={styles.myInfoGrowthRow}>
            {growth !== null && (
              <div className={`${styles.myInfoGrowthChip} ${
                growth > 0 ? styles.myInfoGrowthUp
                  : growth < 0 ? styles.myInfoGrowthDown
                  : styles.myInfoGrowthFlat
              }`}>
                <GrowthIcon value={growth} />
                <span>
                  {growth > 0 ? `+${growth}점` : growth === 0 ? '동일' : `${growth}점`}
                </span>
              </div>
            )}
            {streak >= 2 && (
              <div className={styles.streakBadge}>🔥 {streak}일 연속 학습</div>
            )}
          </div>
        )}

        {/* ── 오답 현황 ── */}
        {wrongCount > 0 && (
          <button type="button" className={styles.myInfoWrongCard} onClick={onWrongReview}>
            <RotateCcw size={18} />
            <div className={styles.myInfoWrongInfo}>
              <span className={styles.myInfoWrongTitle}>오답노트</span>
              <span className={styles.myInfoWrongDesc}>
                {unresolvedWrongCount > 0
                  ? `미해결 ${unresolvedWrongCount}문제 · 전체 ${wrongCount}문제`
                  : `전체 ${wrongCount}문제 (모두 해결)`}
              </span>
            </div>
            <span className={styles.resumeArrow}>›</span>
          </button>
        )}

        {/* ── 취약 영역 ──
             미해결 오답을 문제은행의 영역으로 되돌려 묶는다. 막대는 '영역 문항 수 대비
             아직 못 잡은 문제 비율'이다 — 정답률이 아니다(푼 문제 수를 영역별로
             기록하지 않아 진짜 정답률은 낼 수 없다). 과장하지 않으려고 문구도 그렇게 썼다. */}
        {weakAreas.length > 0 && (
          <>
            <div className={styles.sectionDivider}>취약 영역 ({weakAreas.length}개)</div>
            <p className={styles.weakAreaHint}>
              아직 못 잡은 오답이 많은 순서예요. 눌러서 그 영역만 다시 풀 수 있어요.
            </p>
            <div className={styles.weakAreaList}>
              {weakAreas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={styles.weakAreaRow}
                  onClick={() => onAreaQuiz?.(a.id)}
                  disabled={!onAreaQuiz}
                  aria-label={`${a.name} — 미해결 오답 ${a.wrong}문제, 전체 ${a.total}문항`}
                >
                  <span className={styles.weakAreaTop}>
                    <Crosshair size={15} className={styles.weakAreaIcon} aria-hidden />
                    <span className={styles.weakAreaName}>{a.name}</span>
                    <span className={styles.weakAreaCount}>
                      {a.wrong} / {a.total}
                    </span>
                  </span>
                  <span className={styles.weakAreaBarWrap}>
                    {/* STYLE-EXCEPTION: 비율 막대 — 런타임 값이라 CSS 로 표현 불가 */}
                    <span
                      className={styles.weakAreaBar}
                      style={{ width: `${Math.max(4, Math.round(a.ratio * 100))}%` }}
                    />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── 시험 이력 ── */}
        <div className={styles.sectionDivider}>시험 이력 ({totalQuizzes}회)</div>

        {totalQuizzes === 0 ? (
          <div className={styles.myInfoEmpty}>
            아직 시험 기록이 없어요.<br />평가 메뉴에서 시험을 시작해 보세요!
          </div>
        ) : (
          <div className={styles.myInfoHistoryList}>
            {quizHistory.map((rec: QuizRecord, i: number) => {
              const prev = i < quizHistory.length - 1 ? quizHistory[i + 1] : null;
              const diff = prev ? rec.percent - prev.percent : null;
              const isBest = rec.percent === bestScore && bestScore > 0;
              const gradeClass = rec.percent >= 80
                ? styles.myInfoHistoryItemGreen
                : rec.percent >= 60
                  ? styles.myInfoHistoryItemOrange
                  : styles.myInfoHistoryItemRed;
              return (
                <div
                  key={`${rec.solvedAt}-${i}`}
                  className={`${styles.myInfoHistoryItem} ${gradeClass} ${isBest ? styles.myInfoHistoryItemBest : ''}`}
                >
                  <div className={styles.myInfoHistoryLeft}>
                    <span className={styles.myInfoHistoryDate}>{formatDate(rec.solvedAt)}</span>
                    <span className={styles.myInfoHistoryMode}>{modeLabel(rec.mode)}</span>
                  </div>
                  <div className={styles.myInfoHistoryRight}>
                    <span className={`${styles.myInfoHistoryScore} ${scoreColor(rec.percent)}`}>
                      {rec.percent}점
                    </span>
                    <span className={styles.myInfoHistoryDetail}>
                      {rec.score}/{rec.total}
                    </span>
                    {diff !== null && (
                      <span className={`${styles.myInfoHistoryDiff} ${diff > 0 ? styles.gradeGreen : diff < 0 ? styles.gradeRed : styles.gradeOrange}`}>
                        {diff > 0 ? `+${diff}` : diff === 0 ? '±0' : `${diff}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
