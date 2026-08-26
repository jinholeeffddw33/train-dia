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
 * 조작은 실물과 같은 T바. 잡고 아래로 내리면 역행(4단), 가운데는 중립(타행), 위로 올리면
 * 제동(7단). 손을 떼도 단은 그 자리에 머문다.
 *
 * 구간을 거리(m)가 아니라 시간으로 재는 이유: 거리로 재면 제한 5 구간은 12m, 제한 60 구간은
 * 150m 가 되어 남은 거리만 봐도 답이 새어 나간다.
 */

interface Props {
  onBack: () => void;
}

/* ── 규칙 ── */
/* 한 단계 7구간. */
const SECTION_COUNT = 7;
const JUDGE_RATIO = 0.25;        // 마지막 1/4 이 판정 구간
const REVEAL_MS = 2600;          // 정답 보여주는 시간

/* ── 단계 ──
   단계가 오를수록 한 구간의 시간이 2초씩 짧아진다. 같은 문제라도 생각할 틈이 줄어드니,
   "알고는 있다"에서 "몸이 먼저 안다"로 넘어가야 통과된다.
   한 단계를 900점 넘게 마쳐야 다음 단계로 갈 수 있다(만점 1,050점 = 7구간 × 150점). */
const MAX_STAGE = 4;
const STAGE_PASS = 900;
const stageSec = (stage: number) => 16 - (stage - 1) * 2;   // 16 · 14 · 12 · 10

/** 계기판 최대 눈금 (km/h) */
const MAX_SPEED = 100;

/** 역행 1~4단 가속도 (km/h per sec)
    예전엔 P4 가 26이라 순식간에 최고속도까지 닿았다 — 답을 알아도 손이 못 따라갔다.
    절반 아래로 낮춰, P4 로 밀어도 80 까지 7초쯤 걸리게 한다(1단계 한 구간 16초). */
const POWER_ACC = [0, 3, 6, 8.5, 11];
/** 제동 1~7단 감속도 (km/h per sec) — 가속을 낮춘 만큼 함께 낮춰 균형을 맞춘다 */
const BRAKE_DEC = [0, 2, 3.5, 5, 7, 9.5, 12, 15];
/* 제한속도는 '이하'다. 조금이라도 넘으면 그 구간은 오답이고 경고가 울린다.
   (실제 ATC 는 1km/h 초과에서 경고음이지만, 이 게임은 외우게 하는 것이 목적이라 더 엄격하다) */
const READY_MS = 2200;

const MAX_P = 4;
const MAX_B = 7;

/* ── 주간제어기 눈금 배치 ──
   위가 제동(B7~B1), 가운데가 중립, 아래가 역행(P1~P4). 진호 요청으로 위아래를 바꿨다.
   칸 높이는 단마다 다르다 — 역행은 네 단뿐이라 넓게 잡아 고르기 쉽게 하고,
   제동은 일곱 단이라 좁게 잡아야 한 화면에 들어온다. */
const POWER_PX = 32;   // 역행 한 단
const NEUTRAL_PX = 28; // 중립
const BRAKE_PX = 20;   // 제동 한 단
const NOTCHES = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

const notchPx = (n: number) => (n > 0 ? POWER_PX : n < 0 ? BRAKE_PX : NEUTRAL_PX);

/** 각 단의 위쪽 좌표(px)와 중심 좌표 — 칸 높이가 달라 누적으로 구한다 */
const NOTCH_LAYOUT: { notch: number; top: number; center: number }[] = (() => {
  const out: { notch: number; top: number; center: number }[] = [];
  let y = 0;
  for (const n of NOTCHES) {
    const h = notchPx(n);
    out.push({ notch: n, top: y, center: y + h / 2 });
    y += h;
  }
  return out;
})();
const layoutOf = (n: number) => NOTCH_LAYOUT.find((l) => l.notch === n) ?? NOTCH_LAYOUT[0];

/** 손가락이 멈춘 y(슬롯 기준)에서 가장 가까운 단 */
function notchAt(y: number): number {
  let best = NOTCH_LAYOUT[0];
  for (const l of NOTCH_LAYOUT) {
    if (Math.abs(l.center - y) < Math.abs(best.center - y)) best = l;
  }
  return best.notch;
}

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

/* ── 반원 속도계 ──
   실물 계기판처럼 눈금이 반원으로 깔리고 바늘이 돈다. 숫자는 그 안에 크게 둔다 —
   바늘로 "지금 어디쯤"을 잡고, 정확한 값은 숫자로 읽는다. 둘 중 하나만으로는
   맞추기 어렵다(바늘만 있으면 눈금 사이를 못 읽고, 숫자만 있으면 얼마나 남았는지 감이 없다). */
const DIAL_R = 84;          // 눈금 반지름
const DIAL_CX = 100;
const DIAL_CY = 100;

/** 속도 → 반원 각도(도). 0km/h = 왼쪽(180°), 최고속도 = 오른쪽(0°) */
function dialAngle(v: number): number {
  return 180 - (Math.min(Math.max(v, 0), MAX_SPEED) / MAX_SPEED) * 180;
}
function polar(angleDeg: number, r: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: DIAL_CX + r * Math.cos(a), y: DIAL_CY - r * Math.sin(a) };
}

function SpeedDial({ value }: { value: number }) {
  const v = Math.min(Math.max(value, 0), MAX_SPEED);
  const a = dialAngle(v);
  const tip = polar(a, DIAL_R - 12);
  const start = polar(180, DIAL_R);
  const end = polar(0, DIAL_R);
  const cur = polar(a, DIAL_R);
  /* 지나온 만큼만 색을 채운다 — 남은 눈금과 갈려 보여야 지금 위치가 읽힌다 */
  const large = 0;
  return (
    <div className={styles.dial}>
      <svg viewBox="0 0 200 116" className={styles.dialSvg} aria-hidden>
        <path
          d={`M ${start.x} ${start.y} A ${DIAL_R} ${DIAL_R} 0 ${large} 1 ${end.x} ${end.y}`}
          className={styles.dialTrack}
        />
        <path
          d={`M ${start.x} ${start.y} A ${DIAL_R} ${DIAL_R} 0 ${large} 1 ${cur.x} ${cur.y}`}
          className={styles.dialFill}
        />
        {/* 10km/h 마다 눈금, 20 마다 길게 */}
        {Array.from({ length: MAX_SPEED / 10 + 1 }, (_, i) => i * 10).map((s) => {
          const ang = dialAngle(s);
          const long = s % 20 === 0;
          const p1 = polar(ang, DIAL_R + 1);
          const p2 = polar(ang, DIAL_R - (long ? 12 : 7));
          return (
            <line
              key={s}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              className={long ? styles.dialTickLong : styles.dialTick}
            />
          );
        })}
        {/* 20km/h 마다 숫자 — 가운데 큰 숫자와 겹치지 않게 눈금 가까이 붙인다 */}
        {Array.from({ length: MAX_SPEED / 20 + 1 }, (_, i) => i * 20).map((s) => {
          const p = polar(dialAngle(s), DIAL_R - 21);
          return (
            <text key={s} x={p.x} y={p.y + 4} className={styles.dialNum} textAnchor="middle">
              {s}
            </text>
          );
        })}
        {/* 숫자는 반원 안쪽, 바늘 축 위에 둔다 — 축과 겹치면 둘 다 안 읽힌다.
            SVG 안에 넣어야 계기판이 커지거나 작아져도 자리가 그대로다. */}
        <text x={DIAL_CX} y={78} textAnchor="middle" className={styles.dialValue}>
          {Math.floor(v)}
        </text>
        <text x={DIAL_CX} y={92} textAnchor="middle" className={styles.dialUnit}>
          km/h
        </text>
        <line x1={DIAL_CX} y1={DIAL_CY} x2={tip.x} y2={tip.y} className={styles.dialNeedle} />
        <circle cx={DIAL_CX} cy={DIAL_CY} r={6} className={styles.dialHub} />
      </svg>
    </div>
  );
}

type Phase = 'idle' | 'ready' | 'running' | 'reveal' | 'stageclear' | 'over';
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
    v: 0, idx: 0, t: 0, score: 0,
    warn: false, notch: 0, grabbed: false, judging: false,
    /** 지금 단계(1~4) */
    stage: 1,
    /** 앞 단계들에서 쌓은 점수 — 화면의 총점 = carried + score */
    carried: 0,
  });

  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const fbRef = useRef(feedback);
  useEffect(() => { fbRef.current = feedback; }, [feedback]);
  const play = useCallback((k: Parameters<typeof feedback>[0]) => fbRef.current(k), []);

  const run = useRef({
    v: 0, t: 0, idx: 0, score: 0,
    notch: 0, warned: false, overInJudge: false,
    judgeSum: 0, judgeN: 0,
    sections: [] as Section[],
    stage: 1,
    carried: 0,     // 앞 단계까지의 누적 점수
    secSec: stageSec(1),
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

  /** 판 종료 — 점수는 지나온 단계까지 합친 총점이다 */
  const finish = useCallback(() => {
    stopLoop();
    const r = run.current;
    const total = Math.round(r.carried + r.score);
    setSections([...r.sections]);
    setHud((h) => ({ ...h, score: Math.round(r.score), grabbed: false }));
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
      if (r.idx >= r.sections.length) {
        /* 한 단계가 끝났다. 900점을 넘겼고 아직 위 단계가 남았으면 갈 수 있다.
           못 넘겼으면 여기서 판이 끝난다 — 총점은 지나온 단계까지 합친 값이다. */
        if (Math.round(r.score) > STAGE_PASS && r.stage < MAX_STAGE) {
          setRevealed(null);
          setPhase('stageclear');
          play('record');
        } else {
          finish();
        }
        return;
      }
      // 다음 구간은 정지 상태에서 다시 시작한다 — 앞 구간 속도가 힌트가 되면 안 된다
      r.v = 0; r.t = 0; r.notch = 0; r.warned = false;
      r.overInJudge = false; r.judgeSum = 0; r.judgeN = 0;
      grab.current = null;
      setRevealed(null);
      setHud((h) => ({ ...h, v: 0, t: 0, idx: r.idx, notch: 0, warn: false, judging: false, grabbed: false }));
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
    if (r.notch > 0) {
      r.v = Math.min(MAX_SPEED, r.v + POWER_ACC[r.notch] * dt);
    } else if (r.notch < 0) {
      r.v = Math.max(0, r.v - BRAKE_DEC[-r.notch] * dt);
    }

    r.t += dt;
    const judging = r.t >= r.secSec * (1 - JUDGE_RATIO);

    /* ── 초과 판정 ──
       넘기면 그 구간은 오답이고 경고가 울린다. 다만 강제로 세우지는 않는다 —
       전에는 4km/h 넘기면 비상제동이 걸려 속도가 0이 됐는데, 한 번 넘기면 그 구간을
       되돌릴 방법이 없어 배우기 전에 게임이 끝나 버렸다(진호 요청으로 없앰).
       구간 어디서 넘겼든 오답인 것은 그대로다. 판정 구간에서만 따지면 앞에서 슬쩍 올려
       경고가 뜨는 지점을 찾아 답을 알아낸 뒤 내려오는 게 가능해진다 — 그러면 외울 이유가 없다. */
    if (r.v > limit) {
      if (!r.warned) { r.warned = true; play('fail'); }
      r.overInJudge = true;
    } else {
      r.warned = false;
    }

    /* ── 판정 구간에서만 채점용 속도를 모은다 ── */
    if (judging) { r.judgeSum += r.v; r.judgeN += 1; }

    if (r.t >= r.secSec) { closeSection(); return; }

    setHud({
      v: r.v, idx: r.idx, t: r.t, score: Math.round(r.score),
      warn: r.v > limit,
      notch: r.notch, grabbed: grab.current !== null, judging,
      stage: r.stage, carried: r.carried,
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [closeSection, finish, play]);

  useEffect(() => { tickRef.current = tick; }, [tick]);

  /** 한 단계 시작 — stage=1 이면 새 판, 그 위면 앞 단계 점수를 안고 이어간다 */
  const startStage = useCallback((stage: number, carried: number) => {
    const secs = buildSections();
    run.current = {
      v: 0, t: 0, idx: 0, score: 0,
      notch: 0, warned: false, overInJudge: false,
      judgeSum: 0, judgeN: 0,
      sections: secs,
      stage, carried, secSec: stageSec(stage),
    };
    grab.current = null;
    setSections(secs);
    setRevealed(null);
    setHud({
      v: 0, idx: 0, t: 0, score: 0, warn: false, notch: 0, grabbed: false, judging: false,
      stage, carried,
    });
    setPhase('ready');
    play('button');
    timerRef.current = window.setTimeout(() => {
      setPhase('running');
      play('ready');
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }, READY_MS);
  }, [play, tick]);

  const start = useCallback(() => startStage(1, 0), [startStage]);
  /** 다음 단계로 — 지금까지의 점수를 안고 간다 */
  const nextStage = useCallback(() => {
    const r = run.current;
    startStage(r.stage + 1, Math.round(r.carried + r.score));
  }, [startStage]);

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
    /* 칸 높이가 단마다 달라 "몇 칸 움직였나"로는 셀 수 없다. 잡은 단의 위치에서 손가락이
       움직인 만큼 더한 지점을 구하고, 그 자리에서 가장 가까운 단을 고른다.
       아래가 역행이므로 손가락을 내리면(+dy) 역행 쪽으로 간다. */
    const y = layoutOf(g.notch).center + (e.clientY - g.y);
    const next = Math.max(-MAX_B, Math.min(MAX_P, notchAt(y)));
    if (next !== run.current.notch) {
      run.current.notch = next;
      /* 역행과 제동은 소리가 다르다 — 화면을 안 보고 손만 움직여도 어느 쪽인지 알게.
         중립은 둘 사이를 지나는 자리라 가벼운 딸깍으로 둔다. */
      play(next > 0 ? 'power' : next < 0 ? 'brake' : 'tick');
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
  const progress = Math.min(hud.t / stageSec(hud.stage), 1) * 100;
  const overState = hud.warn ? 'warn' : 'ok';
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
        {/* 배지는 단계만 — 구간 진행은 아래 줄에 둔다(둘 다 넣으면 제목이 두 줄로 밀린다) */}
        {(phase === 'running' || phase === 'reveal') && (
          <span className={styles.roundBadge}>{hud.stage}단계</span>
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
            <li>화면을 잡고 <b>아래로 내리면 역행</b>(4단), <b>위로 올리면 제동</b>(7단), 가운데는 <b>중립</b>(타행)입니다.</li>
            <li>구간의 <b>마지막 1/4</b>이 판정 구간입니다. 그 동안 유지한 속도로 채점합니다.</li>
            <li>제한속도는 <b>이하</b>입니다. <b>조금이라도 넘기면 그 구간은 오답</b>입니다.</li>
            <li>너무 느려도 오답입니다. <b>제한속도 바로 아래</b>가 정답입니다.</li>
            <li>
              한 단계는 {SECTION_COUNT}구간입니다. <b>{STAGE_PASS}점을 넘기면 다음 단계</b>로 가고,
              단계마다 한 구간이 <b>2초씩 짧아집니다</b> (16 · 14 · 12 · 10초, {MAX_STAGE}단계까지).
            </li>
            <li>점수는 <b>단계마다 쌓입니다.</b> 기록은 그 총점입니다.</li>
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
          aria-label="주간제어기 — 잡고 아래로 내리면 역행, 위로 올리면 제동"
        >
          <div className={styles.situation}>
            <span className={styles.situationLabel}>{cur.rule.label}</span>
            <span className={styles.situationAsk}>몇 km/h 로 가야 할까요?</span>
          </div>

          <div className={styles.readout}>
            <SpeedDial value={hud.v} />

            <div className={`${styles.mc} ${hud.grabbed ? styles.mcGrabbed : ''}`} aria-hidden>
              <div className={styles.mcSlot}>
                {NOTCHES.map((n) => (
                  <span
                    key={n}
                    className={`${styles.mcTick} ${n === 0 ? styles.mcTickN : ''} ${n === hud.notch ? styles.mcTickOn : ''}`}
                    // 칸 높이를 CSS 로 옮기면 같은 숫자가 두 곳에 생겨, 한쪽만 고쳐질 때
                    // 핸들이 눈금과 어긋난다. 손가락 위치→단 계산과 출처를 하나로 둔다.
                    // STYLE-EXCEPTION: 칸 높이는 단 종류마다 다르다(POWER_PX/BRAKE_PX)
                    style={{ height: `${notchPx(n)}px` }}
                  >
                    {notchLabel(n)}
                  </span>
                ))}
                <div
                  className={styles.mcHandle}
                  // STYLE-EXCEPTION: 핸들 위치는 지금 단에 따라 매 프레임 바뀌는 런타임 값이다
                  style={{
                    top: `${layoutOf(hud.notch).top}px`,
                    height: `${notchPx(hud.notch)}px`,
                  }}
                >
                  <span className={styles.mcGrip} />
                  <span className={styles.mcStem} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.statusLine}>
            {notchText(hud.notch)}
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
            {/* 이 단계 점수와, 앞 단계까지 합친 총점을 함께 — 총점이 곧 기록이다 */}
            <span className={styles.footItem}>구간 <b>{Math.min(hud.idx + 1, SECTION_COUNT)}</b> / {SECTION_COUNT}</span>
            <span className={styles.footItem}>이 단계 <b>{hud.score.toLocaleString()}</b></span>
            <span className={styles.footItem}>총점 <b>{(hud.carried + hud.score).toLocaleString()}</b></span>
          </div>

          <p className={styles.hint}>화면을 잡고 아래로 내리면 역행 · 위로 올리면 제동</p>
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

          <p className={styles.answerMine}>내 속도 <b>{revealed.avg.toFixed(0)}</b> km/h</p>
          <p className={styles.answerSource}>{revealed.rule.source}</p>
          {revealed.score > 0 && <p className={styles.answerScore}>+{revealed.score}점</p>}
        </div>
      )}

      {/* ── 단계 통과 ── 900점을 넘겨야 여기로 온다 */}
      {phase === 'stageclear' && (
        <div className={styles.panel}>
          <h2 className={styles.resultTitle}>{hud.stage}단계 통과</h2>
          <div className={styles.resultScore}>
            <span className={styles.resultScoreV}>{(hud.carried + hud.score).toLocaleString()}</span>
            <span className={styles.resultScoreU}>점</span>
          </div>
          <p className={styles.best}>이 단계 <b>{hud.score.toLocaleString()}점</b> · 맞춘 구간 <b>{correctCount} / {sections.length}</b></p>
          <p className={styles.lead}>
            다음은 <b>{hud.stage + 1}단계</b>입니다. 한 구간이 <b>{stageSec(hud.stage + 1)}초</b>로 줄어듭니다.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={nextStage}>
            {hud.stage + 1}단계 출발
          </button>
          <button type="button" className={styles.ghostBtn} onClick={finish}>여기서 끝내기</button>
        </div>
      )}

      {/* ── 결과 ── */}
      {phase === 'over' && (
        <div className={styles.panel}>
          <h2 className={styles.resultTitle}>
            {hud.stage >= MAX_STAGE && hud.score > STAGE_PASS ? '전 단계 완주' : `${hud.stage}단계에서 종료`}
          </h2>
          <div className={styles.resultScore}>
            <span className={styles.resultScoreV}>{(hud.carried + hud.score).toLocaleString()}</span>
            <span className={styles.resultScoreU}>점</span>
          </div>
          <p className={styles.best}>
            {hud.stage}단계까지 · 마지막 단계 맞춘 구간 <b>{correctCount} / {sections.length}</b>
          </p>
          {hud.stage < MAX_STAGE && (
            <p className={styles.hint}>한 단계를 {STAGE_PASS}점 넘게 마치면 다음 단계로 갑니다</p>
          )}
          {hud.carried + hud.score >= best && hud.carried + hud.score > 0 && (
            <p className={styles.record}>신기록입니다</p>
          )}

          {sections.some((s) => s.verdict && s.verdict !== 'correct') && (
            <div className={styles.review}>
              <h3 className={styles.reviewTitle}>틀린 구간 다시 보기</h3>
              <ul className={styles.reviewList}>
                {sections.filter((s) => s.verdict && s.verdict !== 'correct').map((s) => (
                  <li key={s.rule.id}>
                    <b>{s.rule.label}</b>
                    <span className={styles.reviewLimit}>
                      {s.rule.limit} km/h 이하 <em>(내 속도 {s.avg.toFixed(0)})</em>
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
