'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import styles from '../styles/edu.module.css';

interface MrBurstSimulationProps {
  onBack: () => void;
}

/* ── 편성 구조 (이미지 기준 밸브 위치) ── */
// pos: 'top' = 상단(MR관), 'bottom' = 하단(SR관)
interface Valve { num: number; pos: 'top' | 'bottom' }
interface Car { name: string; label: string; valves: Valve[] }

const CARS: Car[] = [
  { name: 'TC1', label: '100대', valves: [{ num: 1, pos: 'bottom' }, { num: 2, pos: 'bottom' }] },
  { name: 'M1',  label: '200대', valves: [{ num: 3, pos: 'top' },    { num: 4, pos: 'bottom' }] },
  { name: 'M2',  label: '300대', valves: [{ num: 5, pos: 'top' },    { num: 6, pos: 'bottom' }] },
  { name: 'M3',  label: '400대', valves: [{ num: 7, pos: 'top' },    { num: 8, pos: 'bottom' }] },
  { name: 'M4',  label: '500대', valves: [{ num: 9, pos: 'top' },    { num: 10, pos: 'bottom' }] },
  { name: 'M5',  label: '600대', valves: [{ num: 11, pos: 'top' },   { num: 12, pos: 'bottom' }] },
  { name: 'M6',  label: '700대', valves: [{ num: 13, pos: 'top' },   { num: 14, pos: 'bottom' }] },
  { name: 'TC2', label: '0대',   valves: [{ num: 15, pos: 'top' },   { num: 16, pos: 'top' }] },
];

/* ── 시나리오 정의 (16가지) ── */
interface Scenario {
  id: string;
  trainType: 'ABB' | '로템';
  ruptureDesc: string;
  ruptureCars: number[]; // 0~7 index into CARS
  correctCuts: number[]; // CUT valve numbers
  speedLimit: number;
  explanation: string;
}

const ALL_SCENARIOS: Scenario[] = [
  // ── ABB 차량 (5가지 — PPT 슬라이드 4,5,6,10,11 기준) ──
  {
    id: 'abb-1', trainType: 'ABB',
    ruptureDesc: '5200대(M1) 차량에서 주공기관 파열!',
    ruptureCars: [1], correctCuts: [3],
    speedLimit: 60,
    explanation: '5200대 파열 → 5200대 차량 ③ CUT. 제동축수 80%↑ → 60km/h.',
  },
  {
    id: 'abb-2', trainType: 'ABB',
    ruptureDesc: '5300대(M2) 차량에서 주공기관 파열!',
    ruptureCars: [2], correctCuts: [5],
    speedLimit: 45,
    explanation: '5300대 파열 → 5300대 차량 을 ⑤ CUT. PAN 하강·출력 반감. 제동축수 80%↓ → 45km/h.',
  },
  {
    id: 'abb-3', trainType: 'ABB',
    ruptureDesc: '5400대(M3) 차량에서 주공기관 파열!',
    ruptureCars: [3], correctCuts: [7],
    speedLimit: 45,
    explanation: '5400대 파열 → 5400대 차량 을 ⑦ CUT. 제동축수 80%↓ → 45km/h.',
  },
  {
    id: 'abb-4', trainType: 'ABB',
    ruptureDesc: '5600대(M5) 차량에서 주공기관 파열!',
    ruptureCars: [5], correctCuts: [12],
    speedLimit: 45,
    explanation: '5600대 파열 → 5600대 차량 을 ⑫ CUT. 제동축수 80%↓ → 45km/h.',
  },
  {
    id: 'abb-5', trainType: 'ABB',
    ruptureDesc: '5700대(M6) 차량에서 주공기관 파열!',
    ruptureCars: [6], correctCuts: [12],
    speedLimit: 60,
    explanation: '5700대 파열 → 5600대 차량 을 ⑫ CUT. 제동축수 80%↑ → 60km/h.',
  },
  // ── 로템 차량 (6가지 — PPT 슬라이드 13,17,18,19,20,22 기준) ──
  {
    id: 'rotem-1', trainType: '로템',
    ruptureDesc: '5200대(M1) 차량에서 주공기관 파열!',
    ruptureCars: [1], correctCuts: [3],
    speedLimit: 60,
    explanation: '로템 5200대 파열 → 5200대 차량 을 ③ CUT. 5100대 CMN, CMSBN 차단 필요.',
  },
  {
    id: 'rotem-2', trainType: '로템',
    ruptureDesc: '5300대(M2) 차량에서 주공기관 파열!',
    ruptureCars: [2], correctCuts: [4, 7],
    speedLimit: 60,
    explanation: '로템 5300대 파열 → 5200대 을 ④, 5400대 ⑦ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-3', trainType: '로템',
    ruptureDesc: '5400대(M3) 차량에서 주공기관 파열!',
    ruptureCars: [3], correctCuts: [6, 9],
    speedLimit: 60,
    explanation: '로템 5400대 파열 → 5300대 을 ⑥, 5500대 ⑨ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-4', trainType: '로템',
    ruptureDesc: '5500대(M4) 차량에서 주공기관 파열!',
    ruptureCars: [4], correctCuts: [8, 11],
    speedLimit: 60,
    explanation: '로템 5500대 파열 → 5400대 을 ⑧, 5600대 ⑪ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-5', trainType: '로템',
    ruptureDesc: '5600대(M5) 차량에서 주공기관 파열!',
    ruptureCars: [5], correctCuts: [10, 13],
    speedLimit: 60,
    explanation: '로템 5600대 파열 → 5500대 을 ⑩, 5700대 ⑬ CUT으로 양쪽 격리. PAN 하강·출력 반감.',
  },
  {
    id: 'rotem-6', trainType: '로템',
    ruptureDesc: '5700대(M6) 차량에서 주공기관 파열!',
    ruptureCars: [6], correctCuts: [14],
    speedLimit: 60,
    explanation: '로템 5700대 단일 파열 → ⑭ CUT. 5000대 CMN, CMSBN 차단 필요.',
  },
];

const VALVE_LABELS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯'];

const TOTAL_ROUNDS = 8;

function pickRandom(scenarios: Scenario[], count: number): Scenario[] {
  const shuffled = [...scenarios].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export default function MrBurstSimulation({ onBack }: MrBurstSimulationProps) {
  const [rounds, setRounds] = useState<Scenario[]>(() => pickRandom(ALL_SCENARIOS, TOTAL_ROUNDS));
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [phase, setPhase] = useState<'play' | 'result'>('play');
  const [wrongAttempt, setWrongAttempt] = useState(false); // 오답 표시
  const [showAnswer, setShowAnswer] = useState(false); // 3회 실패 시 정답 공개
  const [retryCount, setRetryCount] = useState<number[]>([]); // 각 문제 재시도 횟수

  const scenario = rounds[current];
  const currentRetries = retryCount[current] ?? 0;

  const toggleValve = useCallback((valve: number) => {
    if (wrongAttempt || showAnswer) return;
    setSelected(prev =>
      prev.includes(valve) ? prev.filter(v => v !== valve) : [...prev, valve]
    );
  }, [wrongAttempt, showAnswer]);

  const handleConfirm = useCallback(() => {
    if (selected.length === 0) return;
    if (wrongAttempt || showAnswer) return;

    const isCorrect = setsEqual(selected, scenario.correctCuts);

    if (!isCorrect) {
      const newCount = (retryCount[current] ?? 0) + 1;
      setRetryCount(prev => {
        const next = [...prev];
        next[current] = newCount;
        return next;
      });

      if (newCount >= 3) {
        // 3번 틀림 → 정답 공개
        setShowAnswer(true);
      } else {
        setWrongAttempt(true);
      }
      return;
    }

    // 정답 → 다음 문제로
    goNext(selected);
  }, [selected, answers, scenario, wrongAttempt, showAnswer, current, retryCount]);

  const goNext = useCallback((sel: number[]) => {
    const nextAnswers = [...answers, sel];
    setAnswers(nextAnswers);

    if (nextAnswers.length < TOTAL_ROUNDS) {
      setCurrent(c => c + 1);
      setSelected([]);
      setWrongAttempt(false);
      setShowAnswer(false);
    } else {
      setPhase('result');
    }
  }, [answers]);

  const handleRetryQuestion = useCallback(() => {
    setSelected([]);
    setWrongAttempt(false);
  }, []);

  // 정답 확인 후 다음으로 넘어가기
  const handleSkipWithAnswer = useCallback(() => {
    goNext(scenario.correctCuts);
  }, [scenario, goNext]);

  const results = useMemo(() => {
    if (phase !== 'result') return [];
    return rounds.map((sc, i) => ({
      scenario: sc,
      userAnswer: answers[i] ?? [],
      isCorrect: true, // 모든 문제를 맞혀야 넘어가므로 항상 정답
      retries: retryCount[i] ?? 0,
    }));
  }, [phase, rounds, answers, retryCount]);

  const perfectCount = results.filter(r => r.retries === 0).length;

  const handleRetry = useCallback(() => {
    setRounds(pickRandom(ALL_SCENARIOS, TOTAL_ROUNDS));
    setCurrent(0);
    setSelected([]);
    setAnswers([]);
    setRetryCount([]);
    setWrongAttempt(false);
    setPhase('play');
  }, []);

  const progressPercent = phase === 'result' ? 100 : (current / TOTAL_ROUNDS) * 100;

  return (
    <div className={`${styles.screen} ${styles.rescueScreen}`}>
      {/* 상단 바 */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
        <span className={styles.topTitle}>주공기관 파열 시뮬레이션</span>
        {phase === 'play' && (
          <span className={styles.rescueCounter}>{current + 1} / {TOTAL_ROUNDS}</span>
        )}
      </div>

      {/* 프로그레스 바 */}
      <div className={styles.rescueProgressBar}>
        <div
          className={`${styles.rescueProgressFill} ${phase === 'result' ? (perfectCount === TOTAL_ROUNDS ? styles.simProgressSuccess : styles.simProgressFail) : ''}`}
          /* STYLE-EXCEPTION: 동적 width 퍼센트 값 */
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {phase === 'play' ? (
        <div className={styles.mrPlayArea}>
          {/* 차종 배지 — 크게 */}
          <div className={styles.mrTrainTypeHeader}>
            <span className={`${styles.mrTrainTypeBig} ${scenario.trainType === 'ABB' ? styles.mrTypeBigAbb : styles.mrTypeBigRotem}`}>
              {scenario.trainType} 차량
            </span>
          </div>

          {/* 상황 */}
          <div className={styles.mrSituation}>
            <p className={styles.mrSituationText}>{scenario.ruptureDesc}</p>
          </div>

          {/* 편성도 — 가로 다이어그램 (이미지와 동일한 배치) */}
          <div className={styles.mrDiagram}>
            <div className={styles.mrDiagramLabel}>▼ CUT할 번호를 선택하세요 (복수 선택 가능)</div>
            <div className={styles.mrTrainScroll}>
              <div className={styles.mrTrainBody}>
                {/* 열차 머리 (좌) */}
                <div className={styles.mrTrainNose} />
                {CARS.map((car, ci) => {
                  const isRuptured = scenario.ruptureCars.includes(ci);
                  const topValves = car.valves.filter(v => v.pos === 'top');
                  const bottomValves = car.valves.filter(v => v.pos === 'bottom');
                  return (
                    <div key={ci} className={`${styles.mrCarCell} ${isRuptured ? styles.mrCarCellRuptured : ''}`}>
                      {/* 상단 밸브 */}
                      <div className={styles.mrValveTop}>
                        {topValves.map(v => {
                          const isSel = selected.includes(v.num);
                          return (
                            <button
                              key={v.num}
                              type="button"
                              className={`${styles.mrValve} ${isSel ? styles.mrValveOn : ''}`}
                              onClick={() => toggleValve(v.num)}
                              aria-label={`CUT ${VALVE_LABELS[v.num - 1]}`}
                              aria-pressed={isSel}
                            >
                              {VALVE_LABELS[v.num - 1]}
                            </button>
                          );
                        })}
                      </div>
                      {/* 차량 본체 */}
                      <div className={styles.mrCarBody}>
                        <span className={styles.mrCarLabel}>{car.label}</span>
                      </div>
                      {/* 하단 밸브 */}
                      <div className={styles.mrValveBottom}>
                        {bottomValves.map(v => {
                          const isSel = selected.includes(v.num);
                          return (
                            <button
                              key={v.num}
                              type="button"
                              className={`${styles.mrValve} ${isSel ? styles.mrValveOn : ''}`}
                              onClick={() => toggleValve(v.num)}
                              aria-label={`CUT ${VALVE_LABELS[v.num - 1]}`}
                              aria-pressed={isSel}
                            >
                              {VALVE_LABELS[v.num - 1]}
                            </button>
                          );
                        })}
                      </div>
                      {/* 파열 표시 */}
                      {isRuptured && <div className={styles.mrRuptureMarker}>💥</div>}
                    </div>
                  );
                })}
                {/* 열차 꼬리 (우) */}
                <div className={styles.mrTrainTail} />
              </div>
            </div>
          </div>

          {/* 선택 현황 */}
          <div className={styles.mrSelectionInfo}>
            {!wrongAttempt && !showAnswer && selected.length === 0 ? (
              <span className={styles.mrSelectionEmpty}>CUT 번호를 선택해주세요</span>
            ) : !wrongAttempt && !showAnswer ? (
              <span className={styles.mrSelectionList}>
                선택: {[...selected].sort((a, b) => a - b).map(v => VALVE_LABELS[v - 1]).join(', ')} CUT
              </span>
            ) : null}
          </div>

          {/* 오답 피드백 (1~2회) */}
          {wrongAttempt && !showAnswer && (
            <div className={styles.mrWrongFeedback}>
              <XCircle size={20} />
              <div className={styles.mrWrongText}>
                <strong>오답입니다! ({currentRetries}/3회)</strong>
                <span>
                  선택: {[...selected].sort((a, b) => a - b).map(v => VALVE_LABELS[v - 1]).join(', ')}
                  {' → '}다시 생각해보세요.
                </span>
              </div>
            </div>
          )}

          {/* 3회 실패 → 정답 공개 */}
          {showAnswer && (
            <div className={styles.mrAnswerReveal}>
              <AlertTriangle size={20} />
              <div className={styles.mrAnswerText}>
                <strong>3회 오답 — 정답을 확인하세요</strong>
                <span className={styles.mrAnswerCorrect}>
                  정답: {scenario.correctCuts.sort((a, b) => a - b).map(v => VALVE_LABELS[v - 1]).join(', ')} CUT
                </span>
                <span className={styles.mrAnswerExplain}>{scenario.explanation}</span>
              </div>
            </div>
          )}

          {/* 경고 */}
          {!wrongAttempt && !showAnswer && (
            <div className={styles.rescueWarning}>
              <AlertTriangle size={16} />
              <span>파열된 차량의 공기관을 격리할 CUT 번호를 정확히 선택하세요</span>
            </div>
          )}

          {/* 확인/다시풀기/다음 버튼 */}
          <div className={styles.mrConfirmWrap}>
            {showAnswer ? (
              <button
                type="button"
                className={styles.mrConfirmBtn}
                onClick={handleSkipWithAnswer}
              >
                정답 확인, 다음 문제로
              </button>
            ) : wrongAttempt ? (
              <button
                type="button"
                className={styles.mrRetryQuestionBtn}
                onClick={handleRetryQuestion}
              >
                <RotateCcw size={20} />
                다시 풀기 ({currentRetries}/3)
              </button>
            ) : (
              <button
                type="button"
                className={styles.mrConfirmBtn}
                onClick={handleConfirm}
                disabled={selected.length === 0}
              >
                확인 ({current + 1}/{TOTAL_ROUNDS})
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── 결과 화면 ── */
        <div className={styles.simResultArea}>
          <div className={styles.simResultHeader}>
            {perfectCount === TOTAL_ROUNDS ? (
              <>
                <div className={styles.simSuccessIcon}><CheckCircle2 size={56} /></div>
                <h2 className={styles.simSuccessTitle}>완벽합니다!</h2>
                <p className={styles.simSuccessMsg}>
                  축하합니다! 🎉<br />
                  {TOTAL_ROUNDS}문제 모두 한 번에 정답!<br />
                  주공기관 파열 시 침착하게 대응할 수 있습니다!
                </p>
              </>
            ) : perfectCount >= TOTAL_ROUNDS * 0.7 ? (
              <>
                <div className={styles.simSuccessIcon}><CheckCircle2 size={56} /></div>
                <h2 className={styles.simSuccessTitle}>잘했습니다!</h2>
                <p className={styles.simSuccessMsg}>
                  대부분 한 번에 맞혔지만, 재시도한 문제를 복습하세요.
                </p>
              </>
            ) : (
              <>
                <div className={styles.simFailIcon}><AlertTriangle size={56} /></div>
                <h2 className={styles.simFailTitle}>추가 학습이 필요합니다</h2>
                <p className={styles.simFailMsg}>
                  여러 문제에서 재시도가 있었습니다.<br />
                  편성도와 밸브 위치를 다시 확인하세요.
                </p>
              </>
            )}
            <div className={styles.simScoreBadge}>
              <span className={styles.simScoreNum}>{perfectCount}</span>
              <span className={styles.simScoreLabel}>/ {TOTAL_ROUNDS} 한 번에 정답</span>
            </div>
          </div>

          {/* 전체 복기 */}
          <div className={styles.simReviewList}>
            {results.map((r, i) => (
              <div
                key={i}
                className={`${styles.mrReviewItem} ${r.retries === 0 ? styles.simReviewCorrect : styles.simReviewWrong}`}
              >
                <div className={styles.simReviewHead}>
                  <span className={styles.simReviewStep}>
                    {r.retries === 0
                      ? <CheckCircle2 size={18} className={styles.simReviewIconOk} />
                      : <RotateCcw size={18} className={styles.simReviewIconFail} />
                    }
                    {i + 1}번
                    {r.retries > 0 && <span className={styles.mrRetryBadge}>{r.retries}회 재시도</span>}
                  </span>
                  <span className={`${styles.mrTrainBadge} ${r.scenario.trainType === 'ABB' ? styles.mrBadgeAbb : styles.mrBadgeRotem}`}>
                    {r.scenario.trainType}
                  </span>
                </div>

                <div className={styles.simReviewQuestion}>{r.scenario.ruptureDesc}</div>

                {/* 미니 편성도 */}
                <div className={styles.mrMiniDiagram}>
                  {CARS.map((car, ci) => {
                    const isRuptured = r.scenario.ruptureCars.includes(ci);
                    return (
                      <div key={ci} className={styles.mrMiniCarCol}>
                        <div className={styles.mrMiniValves}>
                          {car.valves.filter(v => v.pos === 'top').map(v => {
                            const wasSelected = r.userAnswer.includes(v.num);
                            const isCorrectV = r.scenario.correctCuts.includes(v.num);
                            let cls = styles.mrMiniValve;
                            if (isCorrectV && wasSelected) cls += ` ${styles.mrMiniValveOk}`;
                            else if (isCorrectV && !wasSelected) cls += ` ${styles.mrMiniValveMissed}`;
                            else if (!isCorrectV && wasSelected) cls += ` ${styles.mrMiniValveWrong}`;
                            return <span key={v.num} className={cls}>{VALVE_LABELS[v.num - 1]}</span>;
                          })}
                        </div>
                        <div className={`${styles.mrMiniCar} ${isRuptured ? styles.mrMiniCarRuptured : ''}`}>
                          {car.label}
                        </div>
                        <div className={styles.mrMiniValves}>
                          {car.valves.filter(v => v.pos === 'bottom').map(v => {
                            const wasSelected = r.userAnswer.includes(v.num);
                            const isCorrectV = r.scenario.correctCuts.includes(v.num);
                            let cls = styles.mrMiniValve;
                            if (isCorrectV && wasSelected) cls += ` ${styles.mrMiniValveOk}`;
                            else if (isCorrectV && !wasSelected) cls += ` ${styles.mrMiniValveMissed}`;
                            else if (!isCorrectV && wasSelected) cls += ` ${styles.mrMiniValveWrong}`;
                            return <span key={v.num} className={cls}>{VALVE_LABELS[v.num - 1]}</span>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.simReviewSelected}>
                  내 선택: {r.userAnswer.sort((a, b) => a - b).map(v => VALVE_LABELS[v - 1]).join(', ') || '없음'}
                </div>
                {!r.isCorrect && (
                  <div className={styles.simReviewAnswer}>
                    정답: {r.scenario.correctCuts.sort((a, b) => a - b).map(v => VALVE_LABELS[v - 1]).join(', ')} CUT
                  </div>
                )}
                <div className={styles.simReviewFeedback}>{r.scenario.explanation}</div>
              </div>
            ))}
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
