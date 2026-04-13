'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, RotateCcw, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import styles from '../styles/edu.module.css';

interface RescueSimulationProps {
  onBack: () => void;
}

/* ── 시나리오 데이터 ── */
interface SimStep {
  situation: string;        // 상황 설명
  question: string;         // 질문
  choices: {
    text: string;
    correct: boolean;
    feedback: string;       // 결과 화면에서 보여줄 해설
  }[];
}

const STEPS: SimStep[] = [
  {
    situation: '관제로부터 구원연결 지시를 받았습니다. 고장열차 전부운전실에서 가장 먼저 해야 할 조치는?',
    question: '전동방지를 위해 어떤 제동을 체결해야 하나요?',
    choices: [
      { text: '보안제동 체결', correct: true, feedback: '보안제동은 기관사만 해제 가능하여 전동방지에 가장 확실합니다.' },
      { text: '비상제동 체결', correct: false, feedback: '비상제동은 공기압 소진 시 자동 완해되어 전동방지가 불확실합니다.' },
      { text: '주차제동 체결 후 역전기 중립', correct: false, feedback: '주차제동만으로는 구원연결 중 충격 시 전동방지가 불충분합니다.' },
    ],
  },
  {
    situation: '보안제동을 체결했습니다. 후부 운전실로 이동하기 전에 해야 할 일은?',
    question: '운전실을 떠나기 전 반드시 챙겨야 할 것은?',
    choices: [
      { text: '무전기만 챙기고 바로 이동', correct: false, feedback: '출입문 키가 없으면 비상 시 승객 대피에 문제가 생깁니다.' },
      { text: '출입문 키 휴대 + 운전실 쇄정', correct: true, feedback: '출입문 키 휴대와 운전실 쇄정은 안전 및 보안을 위해 필수입니다.' },
      { text: '출입문 전체 개방 후 이동', correct: false, feedback: '구원연결 중 출입문 개방은 승객 안전사고 위험이 있습니다.' },
    ],
  },
  {
    situation: '출입문 키를 챙기고 운전실을 잠갔습니다. 구원열차와 연결하기 위해 어디로 이동해야 하나요?',
    question: '이동할 위치는?',
    choices: [
      { text: '고장열차 전부운전실에서 대기', correct: false, feedback: '구원열차는 후부에서 연결되므로, 전부에서 대기하면 연결 작업이 불가합니다.' },
      { text: '고장열차 후부 운전실로 이동', correct: true, feedback: '구원열차와의 연결은 고장열차 후부에서 이루어집니다.' },
      { text: '승강장으로 하차하여 외부에서 확인', correct: false, feedback: '터널 구간에서 하차는 극도로 위험하며, 운전실 간 이동이 원칙입니다.' },
    ],
  },
  {
    situation: '후부 운전실에 도착했습니다. 구원열차 접근 전 필수 조치는?',
    question: '구원열차 기관사에게 위치를 알리기 위한 조치는?',
    choices: [
      { text: '비상전조등 On + 전호기 지참', correct: true, feedback: '비상전조등으로 위치를 알리고, 전호기로 수신호를 보냅니다.' },
      { text: '전조등 Off 상태 유지 + 무전 대기', correct: false, feedback: '전조등이 꺼져 있으면 구원열차 기관사가 정확한 위치를 파악하기 어렵습니다.' },
      { text: '실내등 전체 점등 + 경적 취명', correct: false, feedback: '실내등은 위치 식별에 불충분하고, 경적은 구원열차 접근 시 신호 체계가 아닙니다.' },
    ],
  },
  {
    situation: '구원열차가 접근하여 연결 준비가 되었습니다. 기계적 연결의 올바른 순서는?',
    question: 'MR마개와 연결기 취급 순서는?',
    choices: [
      { text: '구원차간 연결 → MR마개 제거 → 연결기 확인', correct: false, feedback: 'MR마개를 먼저 제거해야 공기관 연결이 가능합니다. 순서가 바뀌면 연결 불량의 원인이 됩니다.' },
      { text: 'MR코크 개방 → MR마개 제거 → 구원차간 연결', correct: false, feedback: 'MR코크는 연결 완료 후 개방합니다. 먼저 개방하면 공기가 누출됩니다.' },
      { text: 'MR마개 제거 → 구원차간 연결 → 근소퇴거(연결기 확인)', correct: true, feedback: 'MR마개 제거 → 연결 → 퇴거하여 연결기 상태를 확인하는 것이 정확한 순서입니다.' },
    ],
  },
  {
    situation: '기계적 연결이 완료되었습니다. 공기 공급을 위해 어떤 코크를 먼저 개방하나요?',
    question: '연결 직후 개방할 코크는?',
    choices: [
      { text: 'SR코크 개방', correct: false, feedback: 'SR(보조공기)코크는 방송시험 후에 개방합니다. 먼저 열면 절차 위반입니다.' },
      { text: 'MR코크 개방', correct: true, feedback: 'MR(주공기)코크를 먼저 개방하여 구원열차에서 공기를 공급받습니다.' },
      { text: 'MR코크 + SR코크 동시 개방', correct: false, feedback: '동시 개방은 공기압 이상을 유발할 수 있습니다. MR 먼저, 방송시험 후 SR 순서입니다.' },
    ],
  },
  {
    situation: 'MR코크를 개방하여 공기가 공급되고 있습니다. 다음 절차는?',
    question: '방송시험과 SR코크 취급 순서는?',
    choices: [
      { text: 'SR코크 개방 → 구원차간 방송시험', correct: false, feedback: '방송시험을 먼저 해야 구원열차와의 통신 연결 상태를 확인할 수 있습니다.' },
      { text: '구원차간 방송시험 → SR코크 개방', correct: true, feedback: '방송시험으로 통신을 확인한 뒤 SR코크를 개방하는 것이 올바른 순서입니다.' },
      { text: '관제 보고 → SR코크 개방 → 방송시험', correct: false, feedback: '관제보고는 모든 연결 작업 완료 후 최종 단계에서 합니다.' },
    ],
  },
  {
    situation: '방송시험 완료, SR코크도 개방했습니다. 최종 마무리 절차의 올바른 순서는?',
    question: '전부운전실로 복귀 후의 순서는?',
    choices: [
      { text: '전부운전실 이동 → 통화시험 → 보안제동 해방 → 관제보고', correct: false, feedback: '보안제동을 먼저 해방해야 열차 이동이 가능합니다. 통화시험 전에 해방이 우선입니다.' },
      { text: '전부운전실 이동 → 보안제동 해방 → 통화시험 → 관제보고', correct: true, feedback: '보안제동 해방 → 통화시험으로 구원열차와 최종 확인 → 관제보고가 정확한 순서입니다.' },
      { text: '후부운전실에서 관제보고 → 전부운전실 이동 → 보안제동 해방', correct: false, feedback: '관제보고는 모든 준비가 완료된 전부운전실에서 최종적으로 합니다.' },
    ],
  },
];

/* ── 선택지 셔플 (매 시도마다 순서 랜덤) ── */
function shuffleChoices(steps: SimStep[]): SimStep[] {
  return steps.map(step => {
    const shuffled = [...step.choices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return { ...step, choices: shuffled };
  });
}

export default function RescueSimulation({ onBack }: RescueSimulationProps) {
  const [shuffledSteps, setShuffledSteps] = useState(() => shuffleChoices(STEPS));
  const [current, setCurrent] = useState(0);
  const [selections, setSelections] = useState<number[]>([]);
  const [phase, setPhase] = useState<'play' | 'result'>('play');

  const totalSteps = shuffledSteps.length;

  const handleSelect = useCallback((choiceIdx: number) => {
    const next = [...selections, choiceIdx];
    setSelections(next);

    if (next.length < totalSteps) {
      setCurrent(c => c + 1);
    } else {
      setPhase('result');
    }
  }, [selections, totalSteps]);

  const wrongSteps = useMemo(() => {
    if (phase !== 'result') return [];
    return selections
      .map((sel, i) => ({ stepIdx: i, selected: sel, isCorrect: shuffledSteps[i].choices[sel].correct }))
      .filter(r => !r.isCorrect);
  }, [phase, selections, shuffledSteps]);

  const isSuccess = phase === 'result' && wrongSteps.length === 0;
  const score = totalSteps - wrongSteps.length;

  const handleRetry = useCallback(() => {
    setShuffledSteps(shuffleChoices(STEPS));
    setCurrent(0);
    setSelections([]);
    setPhase('play');
  }, []);

  const progressPercent = phase === 'result' ? 100 : (current / totalSteps) * 100;

  return (
    <div className={`${styles.screen} ${styles.rescueScreen}`}>
      {/* 상단 바 */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
        <span className={styles.topTitle}>구원연결 시뮬레이션</span>
        {phase === 'play' && (
          <span className={styles.rescueCounter}>{current + 1} / {totalSteps}</span>
        )}
      </div>

      {/* 프로그레스 바 */}
      <div className={styles.rescueProgressBar}>
        <div
          className={`${styles.rescueProgressFill} ${isSuccess ? styles.simProgressSuccess : ''} ${phase === 'result' && !isSuccess ? styles.simProgressFail : ''}`}
          /* STYLE-EXCEPTION: 동적 width 퍼센트 값 */
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {phase === 'play' ? (
        /* ── 플레이 화면 ── */
        <div className={styles.simPlayArea}>
          {/* 상황 설명 */}
          <div className={styles.simSituation}>
            <div className={styles.simStepBadge}>상황 {current + 1}</div>
            <p className={styles.simSituationText}>{shuffledSteps[current].situation}</p>
          </div>

          {/* 질문 */}
          <div className={styles.simQuestion}>
            <AlertTriangle size={18} className={styles.simQuestionIcon} />
            <span>{shuffledSteps[current].question}</span>
          </div>

          {/* 선택지 */}
          <div className={styles.simChoices}>
            {shuffledSteps[current].choices.map((choice, i) => (
              <button
                key={i}
                type="button"
                className={styles.simChoiceBtn}
                onClick={() => handleSelect(i)}
              >
                <span className={styles.simChoiceNum}>{String.fromCharCode(65 + i)}</span>
                <span className={styles.simChoiceText}>{choice.text}</span>
                <ChevronRight size={18} className={styles.simChoiceArrow} />
              </button>
            ))}
          </div>

          {/* 경고 */}
          <div className={styles.simHint}>
            잘못 선택해도 다음 단계로 진행됩니다. 최종 결과에서 판정합니다.
          </div>
        </div>
      ) : (
        /* ── 결과 화면 ── */
        <div className={styles.simResultArea}>
          {isSuccess ? (
            /* 성공 */
            <div className={styles.simResultHeader}>
              <div className={styles.simSuccessIcon}>
                <CheckCircle2 size={56} />
              </div>
              <h2 className={styles.simSuccessTitle}>구원연결 성공!</h2>
              <p className={styles.simSuccessMsg}>
                축하합니다! 🎉<br />
                8단계 모든 조치를 정확하게 수행했습니다.<br />
                실전에서도 이 순서를 기억하세요!
              </p>
              <div className={styles.simScoreBadge}>
                <span className={styles.simScoreNum}>{score}</span>
                <span className={styles.simScoreLabel}>/ {totalSteps} 정답</span>
              </div>
            </div>
          ) : (
            /* 실패 */
            <div className={styles.simResultHeader}>
              <div className={styles.simFailIcon}>
                <XCircle size={56} />
              </div>
              <h2 className={styles.simFailTitle}>구원연결 실패</h2>
              <p className={styles.simFailMsg}>
                {wrongSteps.length}개 단계에서 잘못된 조치를 선택했습니다.<br />
                아래에서 틀린 부분을 확인하세요.
              </p>
              <div className={styles.simScoreBadge}>
                <span className={styles.simScoreNum}>{score}</span>
                <span className={styles.simScoreLabel}>/ {totalSteps} 정답</span>
              </div>
            </div>
          )}

          {/* 전체 복기 */}
          <div className={styles.simReviewList}>
            {shuffledSteps.map((step, i) => {
              const sel = selections[i];
              const chosen = step.choices[sel];
              const isCorrect = chosen.correct;
              const correctChoice = step.choices.find(c => c.correct)!;

              return (
                <div
                  key={i}
                  className={`${styles.simReviewItem} ${isCorrect ? styles.simReviewCorrect : styles.simReviewWrong}`}
                >
                  <div className={styles.simReviewHead}>
                    <span className={styles.simReviewStep}>
                      {isCorrect
                        ? <CheckCircle2 size={18} className={styles.simReviewIconOk} />
                        : <XCircle size={18} className={styles.simReviewIconFail} />
                      }
                      {i + 1}단계
                    </span>
                    <span className={styles.simReviewLabel}>
                      {isCorrect ? '정답' : '오답'}
                    </span>
                  </div>
                  <div className={styles.simReviewQuestion}>{step.question}</div>
                  <div className={styles.simReviewSelected}>
                    내 선택: {chosen.text}
                  </div>
                  {!isCorrect && (
                    <>
                      <div className={styles.simReviewAnswer}>
                        정답: {correctChoice.text}
                      </div>
                      <div className={styles.simReviewFeedback}>
                        {correctChoice.feedback}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div className={styles.simResultActions}>
            <button type="button" className={styles.simRetryBtn} onClick={handleRetry}>
              <RotateCcw size={20} />
              <span>다시 도전하기</span>
            </button>
            <button type="button" className={styles.simBackBtn} onClick={onBack}>
              <span>나가기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
