'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Volume2, VolumeX, Vibrate, VibrateOff, BookOpen } from 'lucide-react';
import { SPEED_RULES, type SpeedRule } from '@/data/speedLimits';
import GameRanking from './GameRanking';
import SpeedStudy from './SpeedStudy';
import { useGameFeedback } from './useGameFeedback';
import styles from './SpeedMaster.module.css';

/**
 * 스피드 마스터 — 상황만 보고 제한속도를 스스로 떠올려 맞추는 게임.
 *
 * 핵심은 "몇 km/h 인지 미리 알려주지 않는 것"이다. 숫자를 띄워 두면 그 숫자를 따라가는
 * 조작 연습이 될 뿐 암기가 되지 않는다. 그래서 화면에는 상황만 나오고, 기관사가 직접
 * 속도를 정해 맞춘 뒤, 구간이 끝나야 정답이 큰 글씨로 나온다.
 *
 * 구간은 [조정 3/4 → 판정 1/4] 로 나뉜다. 앞에서 충분히 생각해 맞추고, 마지막 1/4 동안
 * 그 속도를 유지해야 한다. 채점은 판정 구간의 평균 속도로만 한다.
 *
 * 조작은 실물과 같은 T바. 잡고 앞으로 밀면 역행(4단), 가운데는 중립(타행), 뒤로 당기면
 * 제동(7단). 손을 떼도 단은 그 자리에 머문다.
 *
 * 구간을 거리(m)가 아니라 시간으로 재는 이유: 거리로 재면 제한 5 구간은 12m, 제한 60 구간은
 * 150m 가 되어 남은 거리만 봐도 답이 새어 나간다.
 */

interface Props {
  onBack: () => void;
}

/* ── 규칙 ── */
const SECTION_COUNT = 10;
const SECTION_SEC = 13;          // 한 구간 — 생각하고 맞출 시간
const JUDGE_RATIO = 0.25;        // 마지막 1/4 이 판정 구간
const REVEAL_MS = 2600;          // 정답 보여주는 시간

/** 역행 1~4단 가속도 (km/h per sec) */
const POWER_ACC = [0, 7, 13, 19, 26];
/** 제동 1~7단 감속도 (km/h per sec) */
const BRAKE_DEC = [0, 4, 7, 11, 15, 20, 26, 33];
const EB_DECEL = 55;
/* 제한속도는 '이하'다. 조금이라도 넘으면 그 순간 오답이고 경고가 울린다.
   (실제 ATC 는 1km/h 초과에서 경고음이지만, 이 게임은 외우게 하는 것이 목적이라 더 엄격하다) */
const EB_OVER = 4;
const MAX_EB = 3;
const READY_MS = 2200;

const MAX_P = 4;
const MAX_B = 7;
const NOTCH_PX = 26;
const NOTCHES = [4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7] as const;

/** 정답으로 인정하는 폭 — 제한속도 바로 아래. 너무 느려도 속도를 모르는 것이다. */
const tolerance = (limit: number) => Math.max(2, limit * 0.12);

function notchLabel(n: number): string {
  if (n > 0) return `P${n}`;
  if (n < 0) return `B${-n}`;
  return 'N';
}
function notchText(n: number): string {
  if (n > 0) return `역행 ${n}단`;
  if (n < 0) return `제동 ${-n}단`;
  return '타행 (중립)';
}

type Phase = 'idle' | 'ready' | 'running' | 'reveal' | 'over';
type Verdict = 'correct' | 'slow' | 'over';

interface Section {
  rule: SpeedRule;
  /** 판정 구간 평균 속도 */
  avg: number;
  verdict: Verdict | null;
  score: number;
}

function buildSections(): Section[] {
  const pool = [...SPEED_RULES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SECTION_COUNT).map((rule) => ({ rule, avg: 0, verdict: null, score: 0 }));
}

const BEST_KEY = 'traindia-speedmaster-best';

function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

export default function SpeedMaster({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [best, setBest] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);
  /** 방금 끝난 구간 — 정답 공개용 */
  const [revealed, setRevealed] = useState<Section | null>(null);
  /** 속도 공부하기 화면 */
  const [study, setStudy] = useState(false);

  const [hud, setHud] = useState({
    v: 0, idx: 0, t: 0, score: 0, eb: 0,
    warn: false, braking: false, notch: 0, grabbed: false, judging: false,
  });

  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const fbRef = useRef(feedback);
  useEffect(() => { fbRef.current = feedback; }, [feedback]);
  const play = useCallback((k: Parameters<typeof feedback>[0]) => fbRef.current(k), []);

  const run = useRef({
    v: 0, t: 0, idx: 0, score: 0, eb: 0,
    notch: 0, ebActive: false, warned: false, overInJudge: false,
    judgeSum: 0, judgeN: 0,
    sections: [] as Section[],
  });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const grab = useRef<{ y: number; notch: number } | null>(null);

  useEffect(() => { setBest(loadBest()); }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => stopLoop, [stopLoop]);

  const finish = useCallback(() => {
    stopLoop();
    const r = run.current;
    const total = Math.round(r.score);
    setSections([...r.sections]);
    setHud((h) => ({ ...h, score: total, grabbed: false }));
    setPhase('over');
    if (total > loadBest()) {
      try { localStorage.setItem(BEST_KEY, String(total)); } catch { /* ignore */ }
      setBest(total);
      play('record');
    } else {
      play('gameover');
    }
    fetch('/api/games/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'speed', score: total }),
    }).catch(() => {});
  }, [play, stopLoop]);

  /** 구간 종료 — 채점하고 정답을 보여준 뒤 다음 구간으로 */
  const closeSection = useCallback(() => {
    stopLoop();
    const r = run.current;
    const sec = r.sections[r.idx];
    const limit = sec.rule.limit;
    const avg = r.judgeN > 0 ? r.judgeSum / r.judgeN : 0;
    const tol = tolerance(limit);

    let verdict: Verdict;
    if (r.overInJudge || avg > limit) verdict = 'over';
    else if (avg >= limit - tol) verdict = 'correct';
    else verdict = 'slow';

    sec.avg = avg;
    sec.verdict = verdict;
    if (verdict === 'correct') {
      // 제한속도에 가까울수록 보너스 — 딱 붙이면 만점
      const closeness = 1 - Math.min((limit - avg) / tol, 1);
      sec.score = 100 + Math.round(50 * closeness);
      r.score += sec.score;
      play('success');
    } else {
      sec.score = 0;
      play('fail');
    }

    setRevealed({ ...sec });
    setSections([...r.sections]);
    setHud((h) => ({ ...h, score: Math.round(r.score), grabbed: false }));
    setPhase('reveal');

    timerRef.current = window.setTimeout(() => {
      r.idx += 1;
      if (r.idx >= r.sections.length || r.eb >= MAX_EB) { finish(); return; }
      // 다음 구간은 정지 상태에서 다시 시작한다 — 앞 구간 속도가 힌트가 되면 안 된다
      r.v = 0; r.t = 0; r.notch = 0; r.ebActive = false; r.warned = false;
      r.overInJudge = false; r.judgeSum = 0; r.judgeN = 0;
      grab.current = null;
      setRevealed(null);
      setHud((h) => ({ ...h, v: 0, t: 0, idx: r.idx, notch: 0, warn: false, braking: false, judging: false, grabbed: false }));
      setPhase('running');
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tickRef.current!);
    }, REVEAL_MS);
  }, [finish, play, stopLoop]);

  /* tick 이 closeSection 을, closeSection 이 다시 tick 을 부르는 구조라 ref 로 묶는다 */
  const tickRef = useRef<((now: number) => void) | null>(null);

  const tick = useCallback((now: number) => {
    const r = run.current;
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;

    const sec = r.sections[r.idx];
    if (!sec) { finish(); return; }
    const limit = sec.rule.limit;

    /* ── 속도 ── 역행은 단수만큼 가속, 제동은 단수만큼 감속, 중립은 타행이라 유지 */
    if (r.ebActive) {
      r.v = Math.max(0, r.v - EB_DECEL * dt);
      if (r.v <= 0.1) { r.ebActive = false; r.v = 0; }
    } else if (r.notch > 0) {
      r.v = Math.min(120, r.v + POWER_ACC[r.notch] * dt);
    } else if (r.notch < 0) {
      r.v = Math.max(0, r.v - BRAKE_DEC[-r.notch] * dt);
    }

    r.t += dt;
    const judging = r.t >= SECTION_SEC * (1 - JUDGE_RATIO);

    /* ── 초과 판정 — 실제와 같은 기준 ── */
    if (!r.ebActive) {
      const over = r.v - limit;
      if (over > EB_OVER) {
        r.ebActive = true;
        r.eb += 1;
        r.notch = -MAX_B;
        r.overInJudge = true;      // 비상제동은 구간 어디서 걸렸든 오답
        r.score = Math.max(0, r.score - 50);
        play('fail');
      } else if (over > 0) {
        if (!r.warned) { r.warned = true; play('fail'); }
        /* 구간 어디서 넘겼든 그 구간은 오답이다. 판정 구간에서만 따지면, 앞에서 슬쩍 올려
           경고가 뜨는 지점을 찾아 답을 알아낸 뒤 내려오는 게 가능해진다 — 그러면 외울 이유가 없다.
           실제로도 제한속도는 '이하'라 넘긴 순간 위반이다. */
        r.overInJudge = true;
      } else {
        r.warned = false;
      }
    }

    /* ── 판정 구간에서만 채점용 속도를 모은다 ── */
    if (judging && !r.ebActive) { r.judgeSum += r.v; r.judgeN += 1; }

    if (r.t >= SECTION_SEC) { closeSection(); return; }

    setHud({
      v: r.v, idx: r.idx, t: r.t, score: Math.round(r.score),
      eb: r.eb, warn: !r.ebActive && r.v > limit, braking: r.ebActive,
      notch: r.notch, grabbed: grab.current !== null, judging,
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [closeSection, finish, play]);

  useEffect(() => { tickRef.current = tick; }, [tick]);

  const start = useCallback(() => {
    const secs = buildSections();
    run.current = {
      v: 0, t: 0, idx: 0, score: 0, eb: 0,
      notch: 0, ebActive: false, warned: false, overInJudge: false,
      judgeSum: 0, judgeN: 0,
      sections: secs,
    };
    grab.current = null;
    setSections(secs);
    setRevealed(null);
    setHud({ v: 0, idx: 0, t: 0, score: 0, eb: 0, warn: false, braking: false, notch: 0, grabbed: false, judging: false });
    setPhase('ready');
    play('button');
    timerRef.current = window.setTimeout(() => {
      setPhase('running');
      play('ready');
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }, READY_MS);
  }, [play, tick]);

  /* ── T바 ── 잡은 지점에서 얼마나 밀었/당겼는지로 단을 센다. 손을 떼도 단은 머문다. */
  const onGrab = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    grab.current = { y: e.clientY, notch: run.current.notch };
    setHud((h) => ({ ...h, grabbed: true }));
    play('button');
  }, [play]);

  const onMove = useCallback((e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const moved = Math.round((g.y - e.clientY) / NOTCH_PX);
    const next = Math.max(-MAX_B, Math.min(MAX_P, g.notch + moved));
    if (next !== run.current.notch) {
      run.current.notch = next;
      play('tick');
      setHud((h) => ({ ...h, notch: next }));
    }
  }, [play]);

  const onRelease = useCallback(() => {
    if (!grab.current) return;
    grab.current = null;
    setHud((h) => ({ ...h, grabbed: false }));
  }, []);

  useEffect(() => {
    const off = () => { grab.current = null; };
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', off);
    return () => {
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', off);
    };
  }, []);

  const cur = run.current.sections[hud.idx];
  const progress = Math.min(hud.t / SECTION_SEC, 1) * 100;
  const overState = hud.braking ? 'eb' : hud.warn ? 'warn' : 'ok';
  const correctCount = sections.filter((s) => s.verdict === 'correct').length;

  return (
    <div className={styles.wrap}>
      {study && <SpeedStudy onClose={() => setStudy(false)} />}

      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>스피드 마스터</h1>
        {/* 공부하기 — 답이 기억나지 않을 때 바로 펴 볼 수 있어야 한다 */}
        <button type="button" className={styles.studyBtn} onClick={() => setStudy(true)}>
          <BookOpen size={15} strokeWidth={2.2} />
          속도공부
        </button>
        {(phase === 'running' || phase === 'reveal') && (
          <span className={styles.roundBadge}>{Math.min(hud.idx + 1, SECTION_COUNT)} / {SECTION_COUNT}</span>
        )}
        <button
          type="button"
          className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleSound}
          aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleVibrate}
          aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
          aria-pressed={vibrateOn}
        >
          {vibrateOn ? <Vibrate size={18} strokeWidth={2} /> : <VibrateOff size={18} strokeWidth={2} />}
        </button>
      </header>

      {/* ── 시작 ── */}
      {phase === 'idle' && (
        <div className={styles.panel}>
          <p className={styles.lead}>상황만 보고 <b>몇 km/h로 가야 하는지 직접</b> 맞추세요.</p>
          <ul className={styles.rules}>
            <li>제한속도는 <b>알려주지 않습니다.</b> 구간이 끝나야 정답이 나옵니다.</li>
            <li>화면을 잡고 <b>앞으로 밀면 역행</b>(4단), <b>뒤로 당기면 제동</b>(7단), 가운데는 <b>중립</b>(타행)입니다.</li>
            <li>구간의 <b>마지막 1/4</b>이 판정 구간입니다. 그 동안 유지한 속도로 채점합니다.</li>
            <li>제한속도는 <b>이하</b>입니다. <b>조금이라도 넘기면 그 구간은 오답</b>이고, 4km/h 넘기면 비상제동입니다.</li>
            <li>너무 느려도 오답입니다. <b>제한속도 바로 아래</b>가 정답입니다.</li>
          </ul>
          {best > 0 && <p className={styles.best}>내 최고 점수 <b>{best.toLocaleString()}</b></p>}
          <button type="button" className={styles.primaryBtn} onClick={start}>출발</button>
          <GameRanking game="speed" scoreLabel="점수" scoreUnit="점" />
        </div>
      )}

      {/* ── 출발 준비 ── */}
      {phase === 'ready' && cur && (
        <div className={styles.stage}>
          <div className={styles.situation}>
            <span className={styles.situationLabel}>{cur.rule.label}</span>
            <span className={styles.situationAsk}>몇 km/h 로 가야 할까요?</span>
          </div>
          <p className={styles.readyWord}>준비</p>
          <p className={styles.hint}>잠시 후 출발합니다</p>
        </div>
      )}

      {/* ── 주행 ── */}
      {phase === 'running' && cur && (
        <div
          className={`${styles.stage} ${styles[`stage_${overState}`]}`}
          onPointerDown={onGrab}
          onPointerMove={onMove}
          onPointerUp={onRelease}
          onPointerCancel={onRelease}
          role="application"
          aria-label="주간제어기 — 잡고 앞으로 밀면 역행, 뒤로 당기면 제동"
        >
          <div className={styles.situation}>
            <span className={styles.situationLabel}>{cur.rule.label}</span>
            <span className={styles.situationAsk}>몇 km/h 로 가야 할까요?</span>
          </div>

          <div className={styles.readout}>
            <div className={styles.gauge}>
              <span className={styles.gaugeV}>{Math.floor(hud.v)}</span>
              <span className={styles.gaugeUnit}>km/h</span>
            </div>

            <div className={`${styles.mc} ${hud.grabbed ? styles.mcGrabbed : ''}`} aria-hidden>
              <div className={styles.mcSlot}>
                {NOTCHES.map((n) => (
                  <span
                    key={n}
                    className={`${styles.mcTick} ${n === 0 ? styles.mcTickN : ''} ${n === hud.notch ? styles.mcTickOn : ''}`}
                  >
                    {notchLabel(n)}
                  </span>
                ))}
                <div className={styles.mcHandle} style={{ ['--n' as string]: String(MAX_P - hud.notch) }}>
                  <span className={styles.mcGrip} />
                  <span className={styles.mcStem} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.statusLine}>
            {hud.braking ? '비상제동' : notchText(hud.notch)}
          </div>

          {/* 진행 바 — 마지막 1/4 이 판정 구간이라 눈에 보이게 갈라 둔다 */}
          <div className={`${styles.track} ${hud.judging ? styles.trackJudging : ''}`} style={{ ['--pos' as string]: `${progress}%` }}>
            <div className={styles.trackJudgeZone} />
            <div className={styles.trackFill} />
            <div className={styles.trackTrain} />
          </div>
          <div className={styles.trackLegend}>
            <span>조정</span>
            <span className={hud.judging ? styles.legendOn : ''}>판정 구간 — 이 속도로 유지</span>
          </div>

          <div className={styles.foot}>
            <span className={styles.footItem}>점수 <b>{hud.score.toLocaleString()}</b></span>
            <span className={styles.footItem}>
              비상제동 <b className={hud.eb > 0 ? styles.ebOn : ''}>{hud.eb}</b> / {MAX_EB}
            </span>
          </div>

          <p className={styles.hint}>화면을 잡고 위로 밀면 역행 · 아래로 내리면 제동</p>
        </div>
      )}

      {/* ── 정답 공개 ── */}
      {phase === 'reveal' && revealed && (
        <div className={`${styles.stage} ${styles.revealStage}`}>
          <span className={styles.situationLabel}>{revealed.rule.label}</span>

          <div className={`${styles.verdict} ${styles[`verdict_${revealed.verdict}`]}`}>
            {revealed.verdict === 'correct' ? '정답' : revealed.verdict === 'over' ? '초과' : '너무 느림'}
          </div>

          <div className={styles.answer}>
            <span className={styles.answerV}>{revealed.rule.limit}</span>
            <span className={styles.answerU}>km/h 이하</span>
          </div>

          <p className={styles.answerMine}>내 속도 <b>{revealed.avg.toFixed(1)}</b> km/h</p>
          <p className={styles.answerSource}>{revealed.rule.source}</p>
          {revealed.score > 0 && <p className={styles.answerScore}>+{revealed.score}점</p>}
        </div>
      )}

      {/* ── 결과 ── */}
      {phase === 'over' && (
        <div className={styles.panel}>
          <h2 className={styles.resultTitle}>{hud.eb >= MAX_EB ? '비상제동 3회 — 운행 중지' : '완주'}</h2>
          <div className={styles.resultScore}>
            <span className={styles.resultScoreV}>{hud.score.toLocaleString()}</span>
            <span className={styles.resultScoreU}>점</span>
          </div>
          <p className={styles.best}>맞춘 구간 <b>{correctCount} / {sections.length}</b></p>
          {hud.score >= best && hud.score > 0 && <p className={styles.record}>신기록입니다</p>}

          {sections.some((s) => s.verdict && s.verdict !== 'correct') && (
            <div className={styles.review}>
              <h3 className={styles.reviewTitle}>틀린 구간 다시 보기</h3>
              <ul className={styles.reviewList}>
                {sections.filter((s) => s.verdict && s.verdict !== 'correct').map((s) => (
                  <li key={s.rule.id}>
                    <b>{s.rule.label}</b>
                    <span className={styles.reviewLimit}>
                      {s.rule.limit} km/h 이하 <em>(내 속도 {s.avg.toFixed(1)})</em>
                    </span>
                    <small>{s.rule.source}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className={styles.primaryBtn} onClick={start}>다시 출발</button>
          <GameRanking game="speed" scoreLabel="점수" scoreUnit="점" />
        </div>
      )}
    </div>
  );
}
