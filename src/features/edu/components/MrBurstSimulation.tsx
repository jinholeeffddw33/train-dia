'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import styles from '../styles/edu.module.css';

interface MrBurstSimulationProps {
  onBack: () => void;
}

/* ── 편성 구조 ── */
const CARS = [
  { name: 'TC1', num: '5100', valves: [1, 2] },
  { name: 'M1', num: '5200', valves: [3, 4] },
  { name: 'M2', num: '5300', valves: [5, 6] },
  { name: 'M3', num: '5400', valves: [7, 8] },
  { name: 'M4', num: '5500', valves: [9, 10] },
  { name: 'M5', num: '5600', valves: [11, 12] },
  { name: 'M6', num: '5700', valves: [13, 14] },
  { name: 'TC2', num: '5000', valves: [15] },
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
  // ── ABB 차량 (8가지) ──
  {
    id: 'abb-1', trainType: 'ABB',
    ruptureDesc: '5200대(M1) 차량에서 주공기관 파열!',
    ruptureCars: [1], correctCuts: [3],
    speedLimit: 60,
    explanation: '5200대 단일 파열 → ③ CUT으로 TC1측 공기관 차단. 제동축수 80%↑ → 60km/h.',
  },
  {
    id: 'abb-2', trainType: 'ABB',
    ruptureDesc: '5300대(M2) 차량에서 주공기관 파열!',
    ruptureCars: [2], correctCuts: [5],
    speedLimit: 45,
    explanation: '5300대 단일 파열 → ⑤ CUT. PAN 하강·출력 반감. 제동축수 80%↓ → 45km/h.',
  },
  {
    id: 'abb-3', trainType: 'ABB',
    ruptureDesc: '5400대(M3) 차량에서 주공기관 파열!',
    ruptureCars: [3], correctCuts: [7],
    speedLimit: 45,
    explanation: '5400대 단일 파열 → ⑦ CUT. 제동축수 80%↓ → 45km/h.',
  },
  {
    id: 'abb-4', trainType: 'ABB',
    ruptureDesc: '5300대(M2)~5500대(M4) 구간 주공기관 파열!',
    ruptureCars: [2, 4], correctCuts: [6, 9],
    speedLimit: 60,
    explanation: '중간 유닛 이중 파열 → ⑥, ⑨ 양쪽 경계 CUT으로 격리. 제동축수 80%↑ → 60km/h.',
  },
  {
    id: 'abb-5', trainType: 'ABB',
    ruptureDesc: '5400대(M3)~5600대(M5) 구간 주공기관 파열!',
    ruptureCars: [3, 5], correctCuts: [8, 11],
    speedLimit: 60,
    explanation: '중간 유닛 이중 파열 → ⑧, ⑪ 양쪽 경계 CUT으로 격리. 제동축수 80%↑ → 60km/h.',
  },
  {
    id: 'abb-6', trainType: 'ABB',
    ruptureDesc: '5500대(M4)~5700대(M6) 구간 주공기관 파열!',
    ruptureCars: [4, 6], correctCuts: [10, 13],
    speedLimit: 60,
    explanation: '중간 유닛 이중 파열 → ⑩, ⑬ CUT. PAN 하강·출력 반감. 제동축수 80%↑ → 60km/h.',
  },
  {
    id: 'abb-7', trainType: 'ABB',
    ruptureDesc: '5600대(M5) 차량에서 주공기관 파열!',
    ruptureCars: [5], correctCuts: [12],
    speedLimit: 45,
    explanation: '5600대 단일 파열 → ⑫ CUT으로 TC2측 공기관 차단. 제동축수 80%↓ → 45km/h.',
  },
  {
    id: 'abb-8', trainType: 'ABB',
    ruptureDesc: '5700대(M6) 차량에서 주공기관 파열!',
    ruptureCars: [6], correctCuts: [14],
    speedLimit: 60,
    explanation: '5700대 단일 파열 → ⑭ CUT. 제동축수 80%↑ → 60km/h.',
  },
  // ── 로템 차량 (8가지) ──
  {
    id: 'rotem-1', trainType: '로템',
    ruptureDesc: '5200대(M1) 차량에서 주공기관 파열!',
    ruptureCars: [1], correctCuts: [3],
    speedLimit: 60,
    explanation: '로템 5200대 단일 파열 → ③ CUT. 5100대 CMN, CMSBN 차단 필요.',
  },
  {
    id: 'rotem-2', trainType: '로템',
    ruptureDesc: '5100대(TC1)~5300대(M2) 구간 주공기관 파열!',
    ruptureCars: [0, 2], correctCuts: [2, 5],
    speedLimit: 60,
    explanation: '로템 TC1~M2 이중 파열 → ②, ⑤ CUT. PAN 하강·출력 반감.',
  },
  {
    id: 'rotem-3', trainType: '로템',
    ruptureDesc: '5200대(M1)~5400대(M3) 구간 주공기관 파열!',
    ruptureCars: [1, 3], correctCuts: [4, 7],
    speedLimit: 60,
    explanation: '로템 M1~M3 이중 파열 → ④, ⑦ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-4', trainType: '로템',
    ruptureDesc: '5300대(M2)~5500대(M4) 구간 주공기관 파열!',
    ruptureCars: [2, 4], correctCuts: [6, 9],
    speedLimit: 60,
    explanation: '로템 M2~M4 이중 파열 → ⑥, ⑨ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-5', trainType: '로템',
    ruptureDesc: '5400대(M3)~5600대(M5) 구간 주공기관 파열!',
    ruptureCars: [3, 5], correctCuts: [8, 11],
    speedLimit: 60,
    explanation: '로템 M3~M5 이중 파열 → ⑧, ⑪ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-6', trainType: '로템',
    ruptureDesc: '5500대(M4)~5700대(M6) 구간 주공기관 파열!',
    ruptureCars: [4, 6], correctCuts: [10, 13],
    speedLimit: 60,
    explanation: '로템 M4~M6 이중 파열 → ⑩, ⑬ CUT. PAN 하강·출력 반감.',
  },
  {
    id: 'rotem-7', trainType: '로템',
    ruptureDesc: '5600대(M5)~5000대(TC2) 구간 주공기관 파열!',
    ruptureCars: [5, 7], correctCuts: [12, 15],
    speedLimit: 60,
    explanation: '로템 M5~TC2 이중 파열 → ⑫, ⑮ CUT으로 양쪽 격리.',
  },
  {
    id: 'rotem-8', trainType: '로템',
    ruptureDesc: '5700대(M6) 차량에서 주공기관 파열!',
    ruptureCars: [6], correctCuts: [14],
    speedLimit: 60,
    explanation: '로템 5700대 단일 파열 → ⑭ CUT. 5000대 CMN, CMSBN 차단 필요.',
  },
];

const VALVE_LABELS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮'];

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

  const scenario = rounds[current];

  const toggleValve = useCallback((valve: number) => {
    setSelected(prev =>
      prev.includes(valve) ? prev.filter(v => v !== valve) : [...prev, valve]
    );
  }, []);

  const handleConfirm = useCallback(() => {
    if (selected.length === 0) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);

    if (nextAnswers.length < TOTAL_ROUNDS) {
      setCurrent(c => c + 1);
      setSelected([]);
    } else {
      setPhase('result');
    }
  }, [selected, answers]);

  const results = useMemo(() => {
    if (phase !== 'result') return [];
    return rounds.map((sc, i) => ({
      scenario: sc,
      userAnswer: answers[i] ?? [],
      isCorrect: setsEqual(answers[i] ?? [], sc.correctCuts),
    }));
  }, [phase, rounds, answers]);

  const correctCount = results.filter(r => r.isCorrect).length;

  const handleRetry = useCallback(() => {
    setRounds(pickRandom(ALL_SCENARIOS, TOTAL_ROUNDS));
    setCurrent(0);
    setSelected([]);
    setAnswers([]);
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
          className={`${styles.rescueProgressFill} ${phase === 'result' ? (correctCount === TOTAL_ROUNDS ? styles.simProgressSuccess : styles.simProgressFail) : ''}`}
          /* STYLE-EXCEPTION: 동적 width 퍼센트 값 */
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {phase === 'play' ? (
        <div className={styles.mrPlayArea}>
          {/* 차종 + 상황 */}
          <div className={styles.mrSituation}>
            <span className={`${styles.mrTrainBadge} ${scenario.trainType === 'ABB' ? styles.mrBadgeAbb : styles.mrBadgeRotem}`}>
              {scenario.trainType}
            </span>
            <p className={styles.mrSituationText}>{scenario.ruptureDesc}</p>
          </div>

          {/* 편성도 — 메인 인터랙션 */}
          <div className={styles.mrDiagram}>
            <div className={styles.mrDiagramLabel}>▼ CUT할 번호를 선택하세요 (복수 선택 가능)</div>
            <div className={styles.mrTrainStrip}>
              {CARS.map((car, ci) => {
                const isRuptured = scenario.ruptureCars.includes(ci);
                return (
                  <div key={ci} className={styles.mrCarCol}>
                    {/* 차량 박스 */}
                    <div className={`${styles.mrCarBox} ${isRuptured ? styles.mrCarRuptured : ''}`}>
                      <span className={styles.mrCarName}>{car.name}</span>
                      <span className={styles.mrCarNum}>{car.num}</span>
                    </div>
                    {/* CUT 밸브 버튼들 */}
                    <div className={styles.mrValveRow}>
                      {car.valves.map(v => {
                        const isSelected = selected.includes(v);
                        return (
                          <button
                            key={v}
                            type="button"
                            className={`${styles.mrValveBtn} ${isSelected ? styles.mrValveSelected : ''}`}
                            onClick={() => toggleValve(v)}
                            aria-label={`CUT ${VALVE_LABELS[v - 1]}`}
                            aria-pressed={isSelected}
                          >
                            {VALVE_LABELS[v - 1]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택 현황 */}
          <div className={styles.mrSelectionInfo}>
            {selected.length === 0 ? (
              <span className={styles.mrSelectionEmpty}>CUT 번호를 선택해주세요</span>
            ) : (
              <span className={styles.mrSelectionList}>
                선택: {selected.sort((a, b) => a - b).map(v => VALVE_LABELS[v - 1]).join(', ')} CUT
              </span>
            )}
          </div>

          {/* 경고 */}
          <div className={styles.rescueWarning}>
            <AlertTriangle size={16} />
            <span>파열된 차량의 공기관을 격리할 CUT 번호를 정확히 선택하세요</span>
          </div>

          {/* 확인 버튼 */}
          <div className={styles.mrConfirmWrap}>
            <button
              type="button"
              className={styles.mrConfirmBtn}
              onClick={handleConfirm}
              disabled={selected.length === 0}
            >
              확인 ({current + 1}/{TOTAL_ROUNDS})
            </button>
          </div>
        </div>
      ) : (
        /* ── 결과 화면 ── */
        <div className={styles.simResultArea}>
          <div className={styles.simResultHeader}>
            {correctCount === TOTAL_ROUNDS ? (
              <>
                <div className={styles.simSuccessIcon}><CheckCircle2 size={56} /></div>
                <h2 className={styles.simSuccessTitle}>완벽합니다!</h2>
                <p className={styles.simSuccessMsg}>
                  축하합니다! 🎉<br />
                  {TOTAL_ROUNDS}문제 모두 정확하게 CUT 번호를 선택했습니다.<br />
                  주공기관 파열 시 침착하게 대응할 수 있습니다!
                </p>
              </>
            ) : correctCount >= TOTAL_ROUNDS * 0.7 ? (
              <>
                <div className={styles.simSuccessIcon}><CheckCircle2 size={56} /></div>
                <h2 className={styles.simSuccessTitle}>잘했습니다!</h2>
                <p className={styles.simSuccessMsg}>
                  대부분 정확하지만, 틀린 부분을 복습하세요.
                </p>
              </>
            ) : (
              <>
                <div className={styles.simFailIcon}><XCircle size={56} /></div>
                <h2 className={styles.simFailTitle}>재학습이 필요합니다</h2>
                <p className={styles.simFailMsg}>
                  CUT 번호 선택에 오류가 있습니다.<br />
                  편성도와 밸브 위치를 다시 확인하세요.
                </p>
              </>
            )}
            <div className={styles.simScoreBadge}>
              <span className={styles.simScoreNum}>{correctCount}</span>
              <span className={styles.simScoreLabel}>/ {TOTAL_ROUNDS} 정답</span>
            </div>
          </div>

          {/* 전체 복기 */}
          <div className={styles.simReviewList}>
            {results.map((r, i) => (
              <div
                key={i}
                className={`${styles.mrReviewItem} ${r.isCorrect ? styles.simReviewCorrect : styles.simReviewWrong}`}
              >
                <div className={styles.simReviewHead}>
                  <span className={styles.simReviewStep}>
                    {r.isCorrect
                      ? <CheckCircle2 size={18} className={styles.simReviewIconOk} />
                      : <XCircle size={18} className={styles.simReviewIconFail} />
                    }
                    {i + 1}번
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
                        <div className={`${styles.mrMiniCar} ${isRuptured ? styles.mrMiniCarRuptured : ''}`}>
                          {car.num}
                        </div>
                        <div className={styles.mrMiniValves}>
                          {car.valves.map(v => {
                            const wasSelected = r.userAnswer.includes(v);
                            const isCorrect = r.scenario.correctCuts.includes(v);
                            let cls = styles.mrMiniValve;
                            if (isCorrect && wasSelected) cls += ` ${styles.mrMiniValveOk}`;
                            else if (isCorrect && !wasSelected) cls += ` ${styles.mrMiniValveMissed}`;
                            else if (!isCorrect && wasSelected) cls += ` ${styles.mrMiniValveWrong}`;
                            return (
                              <span key={v} className={cls}>{VALVE_LABELS[v - 1]}</span>
                            );
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
