'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import styles from '../styles/edu.module.css';

interface RescueProcedureProps {
  onBack: () => void;
}

const STEPS = [
  {
    label: '1',
    title: '보안제동 체결',
    desc: '전부운전실 보안제동 체결 (전동방지)',
    detail: '고장열차가 밀리지 않도록 전부운전실에서 보안제동을 확실히 체결합니다.',
    icon: '🛑',
  },
  {
    label: '2',
    title: '출입문 키 휴대',
    desc: '출입문 키 휴대, 운전실 쇄정',
    detail: '운전실을 잠그고, 출입문 비상열림에 대비하여 키를 반드시 지참합니다.',
    icon: '🔑',
  },
  {
    label: '3',
    title: '후부 운전실 이동',
    desc: '후부 운전실로 이동',
    detail: '구원열차와 연결되는 후부 운전실로 이동합니다.',
    icon: '🚶',
  },
  {
    label: '4',
    title: '비상전조등·전호기',
    desc: '비상전조등 On 및 전호기 지참',
    detail: '후부에서 비상전조등을 켜고, 구원열차 기관사와 신호를 주고받기 위해 전호기를 지참합니다.',
    icon: '🔦',
  },
  {
    label: '5',
    title: 'MR마개·연결기',
    desc: 'MR마개 제거 → 구원차간 연결 → 근소퇴거(연결기 확인)',
    detail: 'MR(주공기) 관 마개를 제거하고, 구원열차와 기계적 연결을 수행합니다. 연결 후 안전거리를 확보하고 연결기 상태를 눈으로 확인합니다.',
    icon: '🔗',
  },
  {
    label: '6',
    title: 'MR코크 개방',
    desc: 'MR코크 개방',
    detail: '주공기관(MR) 코크를 열어 구원열차에서 고장열차로 공기가 공급되도록 합니다.',
    icon: '💨',
  },
  {
    label: '7',
    title: '방송시험·SR코크',
    desc: '구원차간 방송시험 → SR코크 개방',
    detail: '구원열차와 고장열차 간 방송 연결을 시험한 뒤, SR(보조공기) 코크를 개방합니다.',
    icon: '📢',
  },
  {
    label: '8',
    title: '최종 확인·관제보고',
    desc: '전부운전실 이동 → 보안제동 해방 → 통화시험 → 관제보고',
    detail: '다시 전부운전실로 돌아가서 보안제동을 해방하고, 구원열차 기관사와 통화시험 후 관제에 준비완료를 보고합니다.',
    icon: '✅',
  },
];

const TRAIN_TABLE = {
  headers: ['조합', '고장차 KEY', '고장차 PAN', '고장차 EROS', '구원차 EROS'],
  rows: [
    ['ABB — 우진/로템', 'On', '상승', '없음', 'N'],
    ['우진/로템 — ABB', 'On', '하강', 'N', '없음'],
    ['로템 — 우진', 'On', '상승', 'N', 'R1(전동차)'],
    ['우진 — 로템', 'On', '상승', 'N', 'R1(전동차)'],
    ['우진 — 우진', 'On', '하강', 'N', 'R1(전동차)'],
    ['로템 — 로템', 'On', '상승', 'N', 'R1(전동차)'],
    ['ABB — ABB', 'On', '상승', '없음', '없음'],
  ],
};

export default function RescueProcedure({ onBack }: RescueProcedureProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const total = STEPS.length + 1; // +1 for table summary page

  const isLastStep = current === STEPS.length; // table page

  const goTo = useCallback((idx: number, dir: 'next' | 'prev') => {
    setDirection(dir);
    setCurrent(idx);
  }, []);

  const goPrev = useCallback(() => {
    if (current > 0) goTo(current - 1, 'prev');
  }, [current, goTo]);

  const goNext = useCallback(() => {
    if (current < total - 1) goTo(current + 1, 'next');
  }, [current, total, goTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchRef.current = null;
  };

  const progressPercent = ((current + 1) / total) * 100;

  return (
    <div className={`${styles.screen} ${styles.rescueScreen}`}>
      {/* 상단 바 */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
        <span className={styles.topTitle}>구원연결 조치순서</span>
        <span className={styles.rescueCounter}>{current + 1} / {total}</span>
      </div>

      {/* 프로그레스 바 */}
      <div className={styles.rescueProgressBar}>
        <div
          className={styles.rescueProgressFill}
          /* STYLE-EXCEPTION: 동적 width 퍼센트 값 */
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 스텝 도트 인디케이터 */}
      <div className={styles.rescueDots}>
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.rescueDot} ${i === current ? styles.rescueDotActive : ''} ${i < current ? styles.rescueDotDone : ''}`}
            onClick={() => goTo(i, i > current ? 'next' : 'prev')}
            aria-label={i < STEPS.length ? `${i + 1}단계: ${STEPS[i].title}` : '차종별 설정표'}
          />
        ))}
      </div>

      {/* 경고 배너 */}
      <div className={styles.rescueWarning}>
        <AlertTriangle size={16} />
        <span>폐색방식: 지령식 · 밀기운전 제한속도 25km/h 이하</span>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div
        className={styles.rescueBody}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {!isLastStep ? (
          /* ── 개별 스텝 카드 ── */
          <div
            key={current}
            className={`${styles.rescueCard} ${direction === 'next' ? styles.rescueSlideIn : styles.rescueSlideInReverse}`}
          >
            <div className={styles.rescueStepIcon}>{STEPS[current].icon}</div>
            <div className={styles.rescueStepNum}>STEP {STEPS[current].label}</div>
            <h2 className={styles.rescueStepTitle}>{STEPS[current].title}</h2>
            <p className={styles.rescueStepDesc}>{STEPS[current].desc}</p>
            <div className={styles.rescueStepDetail}>{STEPS[current].detail}</div>
          </div>
        ) : (
          /* ── 차종별 설정 테이블 (마지막 페이지) ── */
          <div
            key="table"
            className={`${styles.rescueCard} ${styles.rescueSlideIn}`}
          >
            <div className={styles.rescueStepIcon}>
              <CheckCircle2 size={40} className={styles.rescueCompleteIcon} />
            </div>
            <div className={styles.rescueStepNum}>참고자료</div>
            <h2 className={styles.rescueStepTitle}>차종별 구원운전 설정</h2>
            <div className={styles.rescueTableWrap}>
              <table className={styles.rescueTable}>
                <thead>
                  <tr>
                    {TRAIN_TABLE.headers.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAIN_TABLE.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className={j === 0 ? styles.rescueTableCombo : undefined}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div className={styles.rescueNav}>
        <button
          type="button"
          className={`${styles.rescueNavBtn} ${styles.rescueNavPrev}`}
          onClick={goPrev}
          disabled={current === 0}
          aria-label="이전 단계"
        >
          <ChevronLeft size={20} />
          <span>이전</span>
        </button>

        {!isLastStep ? (
          <button
            type="button"
            className={`${styles.rescueNavBtn} ${styles.rescueNavNext}`}
            onClick={goNext}
            aria-label="다음 단계"
          >
            <span>다음</span>
            <ChevronRight size={20} />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.rescueNavBtn} ${styles.rescueNavDone}`}
            onClick={onBack}
          >
            <span>완료</span>
            <CheckCircle2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
