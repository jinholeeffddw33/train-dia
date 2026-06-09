'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Leaf, Sparkles, RotateCcw, Library, CloudRain, Sun, Cloud, Snowflake } from 'lucide-react';
import { getPlant, currentSeason, seasonLabel, stageFromLevel, plantImagePath, type Plant, type Season } from './plants';
import { useBonsaiStore, POINTS_PER_LEVEL, MAX_LEVEL } from '@/stores/bonsai';
import { useSeoulWeather } from '@/features/home/hooks/useWeather';
import BonsaiCollection from './BonsaiCollection';
import styles from './dab.module.css';

interface ZenBonsaiProps { onBack: () => void }

/* ── 격려 메시지 ── */
const ENCOURAGEMENTS = [
  '오늘도 무사고 운행!',
  '안전이 최우선입니다',
  '정시운전, 고생 많으셨어요',
  '잠시 쉬어가세요',
  '깊은 호흡, 한 번 더',
  '당신이 있어 5호선이 움직입니다',
  '집중과 이완의 균형',
  '오늘의 운행도 감사합니다',
  '한 걸음씩, 천천히',
  '당신의 수고 덕분입니다',
];

/** 밤 시간 판별 (22~06) */
function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

const BREATH_SESSION = 60;

/* 반딧불 (고정 시드) */
const FIREFLIES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  cx: 20 + (i * 31 + 17) % 280,
  cy: 60 + (i * 47 + 23) % 240,
  delay: (i * 0.7) % 4,
  duration: 5 + (i * 0.9) % 4,
}));

/* 꽃잎·낙엽·눈송이 파티클 (계절별) */
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: (i * 22 + 13) % 320,
  delay: (i * 0.5) % 6,
  duration: 8 + (i * 0.7) % 4,
  size: 5 + (i % 4) * 1.5,
}));

/* ─────────────────────────────── 실사 이미지 컴포넌트 (있을 때만) ──────────── */
/**
 * /public/img/bonsai/{plantId}-{stage}.webp 가 존재하면 이미지로 렌더링,
 * 없으면 null 반환 → 부모가 SVG 폴백으로 그림.
 */
function BonsaiPhoto({ level, plant }: { level: number; plant: Plant }) {
  const stage = stageFromLevel(level);
  const src = plantImagePath(plant.id, stage);
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <motion.div
      key={`${plant.id}-${stage}`}
      className={styles.bonsaiPhotoWrap}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${plant.name} 단계 ${stage}`}
        className={styles.bonsaiPhoto}
        onError={() => setErrored(true)}
      />
    </motion.div>
  );
}

/* ─────────────────────────────── 트리 SVG (이미지 폴백) ────────────────────── */
/** 다음 레벨을 향한 0~1 진행도 — 잎/가지가 연속적으로 자라도록 */
function BonsaiTree({ level, progress, plant, night }: { level: number; progress: number; plant: Plant; night: boolean }) {
  const leafColor = plant.leafColor;
  const leafColorAlt = plant.leafColorAlt;
  const trunkColor = night ? '#cbd5e1' : plant.trunkColor;
  const soilColor = night ? '#78716c' : '#57534e';
  const potColor = night ? '#44403c' : '#292524';
  const isBamboo = plant.id === 'bamboo';
  /** 부드러운 성장 — level + progress (float) */
  const effLv = level + progress;
  /** 요소가 minLv 도달 직전·직후로 투명도·스케일 전환: minLv-1 → 0, minLv → 1 */
  const appear = (minLv: number): number => {
    if (effLv <= minLv - 1) return 0;
    if (effLv >= minLv) return 1;
    return effLv - (minLv - 1);
  };

  return (
    <svg viewBox="0 0 320 360" className={styles.bonsaiSvg} fill="none" aria-hidden>
      {/* 화분 */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <path d="M90 310 L100 340 L220 340 L230 310 Z" fill={potColor} opacity="0.85" />
        <ellipse cx="160" cy="310" rx="72" ry="6" fill={potColor} />
        <ellipse cx="160" cy="310" rx="68" ry="4" fill={soilColor} />
      </motion.g>

      {/* 씨앗 (레벨 0) */}
      {level === 0 && (
        <motion.ellipse cx="160" cy="308" rx="5" ry="3" fill={night ? '#92400e' : '#78350f'}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.6 }} />
      )}

      {/* 새싹 (레벨 1) */}
      {level >= 1 && (
        <motion.g initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }} style={{ transformOrigin: '160px 310px' }}>
          <path
            d={level === 1 ? 'M160 310 Q 158 300 160 290' : 'M160 310 Q 156 280 160 250'}
            stroke={trunkColor} strokeWidth={level === 1 ? '2' : '3'}
            strokeLinecap="round" fill="none" opacity="0.9"
          />
        </motion.g>
      )}

      {/* 나무 줄기 + 가지 (레벨 2+) */}
      {level >= 2 && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          {/* 메인 줄기 */}
          {isBamboo ? (
            <>
              <path d="M155 310 L153 180" stroke={trunkColor} strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M165 310 L167 180" stroke={trunkColor} strokeWidth="5" fill="none" strokeLinecap="round" />
              {/* 마디 */}
              {[290, 260, 230, 200].map((y, i) => (
                <rect key={i} x="148" y={y - 2} width="25" height="3" fill={trunkColor} opacity="0.7" rx="1" />
              ))}
            </>
          ) : (
            <path
              d="M160 310 Q 155 275 158 240 Q 162 210 160 180"
              stroke={trunkColor} strokeWidth="6" strokeLinecap="round" fill="none"
            />
          )}

          {level >= 3 && !isBamboo && (
            <>
              <path d="M158 240 Q 140 230 120 215" stroke={trunkColor} strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M160 220 Q 180 210 200 195" stroke={trunkColor} strokeWidth="3" strokeLinecap="round" fill="none" />
            </>
          )}
          {level >= 5 && !isBamboo && (
            <>
              <path d="M158 195 Q 140 180 125 165" stroke={trunkColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M160 180 Q 180 165 195 155" stroke={trunkColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </>
          )}
          {level >= 7 && !isBamboo && (
            <>
              <path d="M160 180 Q 150 160 145 145" stroke={trunkColor} strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M160 180 Q 170 160 175 145" stroke={trunkColor} strokeWidth="2" strokeLinecap="round" fill="none" />
            </>
          )}
        </motion.g>
      )}

      {/* 잎사귀 군집 — 포인트 누적에 따라 부드럽게 자라남 */}
      {effLv >= 1.3 && (
        <g>
          {[
            { cx: 120, cy: 215, r: 14, minLv: 3 },
            { cx: 200, cy: 195, r: 16, minLv: 3 },
            { cx: 160, cy: 180, r: 18, minLv: 2 },
            { cx: 125, cy: 165, r: 14, minLv: 5 },
            { cx: 195, cy: 155, r: 15, minLv: 5 },
            { cx: 145, cy: 145, r: 12, minLv: 7 },
            { cx: 175, cy: 145, r: 13, minLv: 7 },
            { cx: 160, cy: 130, r: 16, minLv: 8 },
            { cx: 135, cy: 195, r: 10, minLv: 4 },
            { cx: 185, cy: 175, r: 11, minLv: 6 },
          ].map((c, i) => {
            const a = appear(c.minLv);
            if (a <= 0) return null;
            const scale = 0.3 + a * 0.7; // 작게 시작해서 완전 크기까지
            return (
              <motion.g key={i} style={{ transformOrigin: `${c.cx}px ${c.cy}px`, opacity: a }}
                animate={{ rotate: [0, 2.5, -2, 1.5, 0], scale: [scale, scale * 1.02, scale] }}
                transition={{ duration: 4 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}>
                <circle cx={c.cx} cy={c.cy} r={c.r} fill={leafColor} opacity="0.78" />
                <circle cx={c.cx - c.r * 0.3} cy={c.cy - c.r * 0.2} r={c.r * 0.7} fill={leafColorAlt} opacity="0.6" />
              </motion.g>
            );
          })}
        </g>
      )}

      {/* 꽃 (레벨 6+, 식물이 flowerColor 있을 때) — 연속 개화 */}
      {effLv >= 5.3 && plant.flowerColor && (
        <g>
          {[
            { cx: 155, cy: 200, minLv: 6 }, { cx: 170, cy: 170, minLv: 6 },
            { cx: 140, cy: 175, minLv: 6 }, { cx: 180, cy: 200, minLv: 6 },
            { cx: 130, cy: 200, minLv: 7 }, { cx: 195, cy: 180, minLv: 7 },
          ].map((f, i) => {
            const a = appear(f.minLv);
            if (a <= 0) return null;
            return (
              <motion.circle key={i} cx={f.cx} cy={f.cy} r={3.5 * a} fill={plant.flowerColor!}
                opacity={a}
                animate={{ opacity: [0.7 * a, a, 0.7 * a] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }} />
            );
          })}
        </g>
      )}
    </svg>
  );
}

/* ─────────────────────────────── 반딧불 ─────────────────────────────── */
function Fireflies() {
  return (
    <svg className={styles.bonsaiFireflies} viewBox="0 0 320 360" aria-hidden>
      {FIREFLIES.map((f) => (
        <motion.circle key={f.id} cx={f.cx} cy={f.cy} r="2.5" fill="#fde68a"
          animate={{
            opacity: [0, 0.9, 0.2, 0.8, 0],
            cx: [f.cx, f.cx + 20, f.cx - 15, f.cx + 10, f.cx],
            cy: [f.cy, f.cy - 15, f.cy + 10, f.cy - 8, f.cy],
          }}
          transition={{ duration: f.duration, repeat: Infinity, delay: f.delay, ease: 'easeInOut' }}
          style={{ filter: 'drop-shadow(0 0 4px #fcd34d)' }} />
      ))}
    </svg>
  );
}

/* ─────────────────────────────── 계절 파티클 ─────────────────────────────── */
function SeasonParticles({ season }: { season: Season }) {
  if (season === 'summer') return null;

  const particleColor =
    season === 'spring' ? '#fbcfe8' :  // 벚꽃
    season === 'autumn' ? '#fb923c' :  // 낙엽
    '#e2e8f0';                          // 눈

  return (
    <svg className={styles.seasonParticles} viewBox="0 0 320 420" aria-hidden>
      {PARTICLES.map((p) => (
        <motion.circle
          key={p.id}
          cx={p.x}
          cy={-10}
          r={p.size}
          fill={particleColor}
          opacity={0.7}
          animate={{
            cy: [-10, 430],
            cx: [p.x, p.x + 20, p.x - 15, p.x + 10],
            rotate: [0, 180, 360],
            opacity: [0, 0.8, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────── 날씨 효과 ─────────────────────────────── */
function RainEffect() {
  return (
    <svg className={styles.rainEffect} viewBox="0 0 320 420" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => {
        const x = (i * 19 + 7) % 320;
        const delay = (i * 0.15) % 1.5;
        return (
          <motion.line
            key={i}
            x1={x}
            x2={x - 4}
            y1={-20}
            y2={0}
            stroke="#93c5fd"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={0.6}
            animate={{
              y1: [-20, 440],
              y2: [0, 460],
            }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay,
              ease: 'linear',
            }}
          />
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────── 메인 ─────────────────────────────── */
export default function ZenBonsai({ onBack }: ZenBonsaiProps) {
  const {
    currentPlantId, level, points, collection,
    lastReason, streak,
    completeBreath, dailyCheckin, recordTap, switchPlant, resetCurrent,
  } = useBonsaiStore();

  const plant = getPlant(currentPlantId);
  const season = currentSeason();
  const weather = useSeoulWeather();

  const [night, setNight] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [remaining, setRemaining] = useState(BREATH_SESSION);
  const [message, setMessage] = useState<string | null>(null);
  const [justGrew, setJustGrew] = useState(false);
  /** 오늘 첫 성장 시 무지개 이펙트 */
  const [rainbow, setRainbow] = useState(false);
  /** 마일스톤 팝업 ('lv3' | 'lv6' | null) */
  const [milestonePopup, setMilestonePopup] = useState<'lv3' | 'lv6' | null>(null);
  const [completedPopup, setCompletedPopup] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didCheckinRef = useRef(false);

  /** 성장 결과 공통 처리 */
  const handleGrowthResult = useCallback((res: { leveledUp: boolean; completed: boolean; firstToday: boolean; milestone: 'lv3' | 'lv6' | null }) => {
    if (res.completed) {
      setCompletedPopup(true);
      setTimeout(() => setCompletedPopup(false), 3500);
      return;
    }
    if (res.milestone) {
      setMilestonePopup(res.milestone);
      setTimeout(() => setMilestonePopup(null), 3000);
    }
    if (res.leveledUp) {
      setJustGrew(true);
      if (res.firstToday) {
        setRainbow(true);
        setTimeout(() => setRainbow(false), 2000);
      }
      setTimeout(() => setJustGrew(false), 2000);
    }
  }, []);

  /* 초기 로드: 밤 감지 + 출근 체크인 */
  useEffect(() => {
    setNight(isNightTime());
    const nightCheck = setInterval(() => setNight(isNightTime()), 60_000);

    // 하루 첫 접속 체크인 (한 번만) — 성장 이펙트는 스토어 상태로 감지
    if (!didCheckinRef.current) {
      didCheckinRef.current = true;
      const granted = dailyCheckin();
      if (granted) {
        // 체크인은 조용히 반짝만
        setTimeout(() => {
          setJustGrew(true);
          setTimeout(() => setJustGrew(false), 1500);
        }, 300);
      }
    }

    return () => clearInterval(nightCheck);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTreeTap = useCallback(() => {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    setMessage(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), 2500);
    recordTap();
  }, [recordTap]);

  const startBreathing = useCallback(() => {
    setRemaining(BREATH_SESSION);
    setBreathing(true);
  }, []);

  const stopBreathing = useCallback(() => {
    setBreathing(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const completeBreathing = useCallback(() => {
    setBreathing(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const res = completeBreath();
    handleGrowthResult(res);
  }, [completeBreath, handleGrowthResult]);

  useEffect(() => {
    if (!breathing) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          completeBreathing();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [breathing, completeBreathing]);

  const handleReset = useCallback(() => {
    if (!confirm('현재 분재를 씨앗 상태로 되돌릴까요? (도감은 유지)')) return;
    resetCurrent();
  }, [resetCurrent]);

  const handleSelectPlant = useCallback((id: typeof currentPlantId) => {
    switchPlant(id);
    setCollectionOpen(false);
  }, [switchPlant]);

  const levelLabel =
    level === 0 ? '씨앗' :
    level <= 2 ? '새싹' :
    level <= 4 ? '어린 나무' :
    level <= 6 ? '자란 나무' :
    level <= 7 ? '큰 나무' :
    '꽃핀 분재';

  const pointProgress = Math.min(100, (points / POINTS_PER_LEVEL) * 100);
  const isRaining = weather?.condition?.includes('비') || weather?.condition?.includes('소나기');
  const isSnowing = weather?.condition?.includes('눈');
  const isDusty = weather?.dustLevel === 'bad' || weather?.dustLevel === 'very-bad';

  const weatherIcon =
    isRaining ? <CloudRain size={13} /> :
    isSnowing ? <Snowflake size={13} /> :
    weather?.condition?.includes('맑') ? <Sun size={13} /> :
    <Cloud size={13} />;

  /* 도감 화면 */
  if (collectionOpen) {
    return <BonsaiCollection onBack={() => setCollectionOpen(false)} onStartPlant={handleSelectPlant} />;
  }

  return (
    <div
      className={`${styles.bonsaiWrap} ${night ? styles.bonsaiNight : ''} ${styles[`season_${season}`]}`}
    >
      {/* 헤더 */}
      <div className={styles.bonsaiHeader}>
        <button type="button" className={styles.bonsaiBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className={styles.bonsaiHeaderCenter}>
          <span className={styles.bonsaiBrand}>
            {plant.emoji} {plant.name} · {seasonLabel(season)}
          </span>
          <span className={styles.bonsaiLevelText}>
            {levelLabel} · Lv {level}/{MAX_LEVEL} · 🔥 {streak}일
          </span>
        </div>
        <button type="button" className={styles.bonsaiResetBtn} onClick={handleReset} aria-label="리셋">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* 포인트 게이지 */}
      <div className={styles.bonsaiProgressBar}>
        <div className={styles.bonsaiProgressFill} style={{ width: `${pointProgress}%` }} />
        <span className={styles.bonsaiProgressText}>
          {points.toFixed(1)} / {POINTS_PER_LEVEL}
        </span>
      </div>

      {/* 날씨 뱃지 */}
      {weather?.condition && (
        <div className={`${styles.weatherBadge} ${isDusty ? styles.weatherDusty : ''}`}>
          {weatherIcon}
          <span>{weather.condition}{isDusty ? ' · 미세먼지 나쁨' : ''}</span>
        </div>
      )}

      {/* 스테이지 */}
      <div className={styles.bonsaiStage}>
        <motion.div className={styles.bonsaiMoon}
          initial={{ opacity: 0 }} animate={{ opacity: night ? 0.35 : 0.2 }} transition={{ duration: 2 }} />

        {night && <Fireflies />}
        <SeasonParticles season={season} />
        {isRaining && <RainEffect />}

        <motion.button type="button" className={styles.bonsaiTreeBtn} onClick={handleTreeTap}
          aria-label="나무 터치" whileTap={{ scale: 0.97 }}
          animate={justGrew ? { scale: [1, 1.06, 1] } : {}} transition={{ duration: 0.6 }}>
          {/* 실사 이미지 자산이 있으면 그걸로, 없으면 SVG 폴백 */}
          <BonsaiTree level={level} progress={points / POINTS_PER_LEVEL} plant={plant} night={night} />
          <BonsaiPhoto level={level} plant={plant} />
        </motion.button>

        {/* 무지개 링 — 오늘 첫 성장 시 */}
        <AnimatePresence>
          {rainbow && (
            <motion.div className={styles.bonsaiRainbow}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0], scale: [0.6, 1.4, 1.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6 }}
              aria-hidden
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {justGrew && (
            <motion.div className={`${styles.bonsaiSparkle} ${rainbow ? styles.bonsaiSparkleRainbow : ''}`}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Sparkles size={28} />
              <span>{rainbow ? '오늘 첫 성장! ' : ''}{lastReason ?? '자라났어요'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 마일스톤 팝업 (레벨 3·6 최초 도달) */}
        <AnimatePresence>
          {milestonePopup && (
            <motion.div className={styles.bonsaiMilestone}
              initial={{ opacity: 0, y: 14, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}>
              <Sparkles size={24} />
              <span className={styles.bonsaiMilestoneTitle}>
                {milestonePopup === 'lv3' ? '어린 나무 달성!' : '꽃이 피었습니다!'}
              </span>
              <span className={styles.bonsaiMilestoneSub}>
                {milestonePopup === 'lv3' ? '잎사귀가 무성해졌어요' : '이제 꽃이 맺히기 시작해요'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {completedPopup && (
            <motion.div className={styles.bonsaiCompleted}
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <span className={styles.bonsaiCompletedEmoji}>{plant.emoji}</span>
              <span className={styles.bonsaiCompletedTitle}>{plant.name} 완성!</span>
              <span className={styles.bonsaiCompletedSub}>도감에 추가되었어요</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {message && (
            <motion.div className={styles.bonsaiMessage}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}>
              <Leaf size={14} />
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 호흡 오버레이 */}
      <AnimatePresence>
        {breathing && (
          <motion.div className={styles.bonsaiBreathOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.bonsaiBreathCircle}
              animate={{ scale: [1, 1.35, 1.35, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.6, 1] }} />
            <div className={styles.bonsaiBreathInfo}>
              <span className={styles.bonsaiBreathLabel}>숨을 천천히 들이쉬고 내쉬세요</span>
              <span className={styles.bonsaiBreathTime}>{remaining}초</span>
              <button type="button" className={styles.bonsaiBreathCancel} onClick={stopBreathing}>
                중단
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 하단 컨트롤 */}
      <div className={styles.bonsaiBottom}>
        <p className={styles.bonsaiHint}>
          {collection.length}/{9} 완성 · 퀴즈·영상 시청·매일 접속으로도 자라납니다
        </p>
        <div className={styles.bonsaiActions}>
          <button type="button" className={styles.bonsaiCollectionBtn} onClick={() => setCollectionOpen(true)}>
            <Library size={16} /> 도감
          </button>
          <button type="button" className={styles.bonsaiStartBtn}
            onClick={startBreathing} disabled={breathing || level >= MAX_LEVEL}>
            {level >= MAX_LEVEL ? '이미 완성' : '휴식 시작 (1분)'}
          </button>
        </div>
      </div>
    </div>
  );
}
