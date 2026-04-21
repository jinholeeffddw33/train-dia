'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Leaf, Sparkles, RotateCcw } from 'lucide-react';
import styles from './dab.module.css';

interface ZenBonsaiProps { onBack: () => void }

/* ── 저장 키 ── */
const STORAGE_KEY_LEVEL = 'life-bonsai-level';
const STORAGE_KEY_LAST  = 'life-bonsai-last-grown';

/* ── 성장 단계 (0~9) ── */
const MAX_LEVEL = 9;

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

/* ── 밤 시간 판별 (22~06) ── */
function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

/* ── 호흡 세션 길이 (초) ── */
const BREATH_SESSION = 60;

/* ── 반딧불 위치/속도 (고정 시드) ── */
const FIREFLIES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  cx: 20 + Math.random() * 280,
  cy: 60 + Math.random() * 240,
  delay: Math.random() * 4,
  duration: 5 + Math.random() * 4,
}));

/* ─────────────────────────────── 트리 SVG ─────────────────────────────── */
function BonsaiTree({ level, night }: { level: number; night: boolean }) {
  const leafColor = night ? '#86efac' : '#4ade80';
  const leafColorAlt = night ? '#bbf7d0' : '#22c55e';
  const trunkColor = night ? '#e2e8f0' : '#334155';
  const soilColor = night ? '#78716c' : '#57534e';
  const potColor = night ? '#44403c' : '#292524';

  /* 잎사귀 설정 — 레벨에 따라 개수 증가 */
  const leafCount = Math.max(0, level - 1) * 3 + (level > 0 ? 2 : 0);

  return (
    <svg viewBox="0 0 320 360" className={styles.bonsaiSvg} fill="none" aria-hidden>
      {/* ── 화분 ── */}
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* 화분 본체 (테이퍼 사다리꼴) */}
        <path
          d="M90 310 L100 340 L220 340 L230 310 Z"
          fill={potColor}
          opacity="0.85"
        />
        {/* 화분 위 가장자리 */}
        <ellipse cx="160" cy="310" rx="72" ry="6" fill={potColor} />
        {/* 흙 */}
        <ellipse cx="160" cy="310" rx="68" ry="4" fill={soilColor} />
      </motion.g>

      {/* ── 씨앗 (레벨 0) ── */}
      {level === 0 && (
        <motion.ellipse
          cx="160"
          cy="308"
          rx="5"
          ry="3"
          fill={night ? '#92400e' : '#78350f'}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6 }}
        />
      )}

      {/* ── 새싹 (레벨 1) ── */}
      {level >= 1 && (
        <motion.g
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{ transformOrigin: '160px 310px' }}
        >
          {/* 작은 줄기 */}
          <path
            d={level === 1
              ? 'M160 310 Q 158 300 160 290'
              : 'M160 310 Q 156 280 160 250'}
            stroke={trunkColor}
            strokeWidth={level === 1 ? '2' : '3'}
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
        </motion.g>
      )}

      {/* ── 나무 줄기 (레벨 2+) ── */}
      {level >= 2 && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {/* 메인 줄기 — 수묵화 필치처럼 굵기 변화 */}
          <path
            d="M160 310 Q 155 275 158 240 Q 162 210 160 180"
            stroke={trunkColor}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />

          {/* 가지 (레벨 3+) */}
          {level >= 3 && (
            <>
              <path
                d="M158 240 Q 140 230 120 215"
                stroke={trunkColor}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M160 220 Q 180 210 200 195"
                stroke={trunkColor}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}

          {/* 추가 가지 (레벨 5+) */}
          {level >= 5 && (
            <>
              <path
                d="M158 195 Q 140 180 125 165"
                stroke={trunkColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M160 180 Q 180 165 195 155"
                stroke={trunkColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </>
          )}

          {/* 상단 잔가지 (레벨 7+) */}
          {level >= 7 && (
            <>
              <path d="M160 180 Q 150 160 145 145" stroke={trunkColor} strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M160 180 Q 170 160 175 145" stroke={trunkColor} strokeWidth="2" strokeLinecap="round" fill="none" />
            </>
          )}
        </motion.g>
      )}

      {/* ── 잎사귀 군집 ── */}
      {level >= 2 && (
        <g>
          {/* 잎사귀 클러스터 위치 — 레벨에 따라 노출 */}
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
          ].filter(c => level >= c.minLv).map((c, i) => (
            <motion.g
              key={i}
              style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}
              animate={{
                rotate: [0, 2.5, -2, 1.5, 0],
              }}
              transition={{
                duration: 4 + (i % 3),
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.2,
              }}
            >
              <circle
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill={leafColor}
                opacity="0.7"
              />
              <circle
                cx={c.cx - c.r * 0.3}
                cy={c.cy - c.r * 0.2}
                r={c.r * 0.7}
                fill={leafColorAlt}
                opacity="0.55"
              />
            </motion.g>
          ))}
        </g>
      )}

      {/* ── 꽃 (레벨 8+) ── */}
      {level >= 8 && (
        <g>
          {[
            { cx: 155, cy: 200 },
            { cx: 170, cy: 170 },
            { cx: 140, cy: 175 },
            { cx: 180, cy: 200 },
          ].map((f, i) => (
            <motion.circle
              key={i}
              cx={f.cx}
              cy={f.cy}
              r="3"
              fill={night ? '#fda4af' : '#f472b6'}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
        </g>
      )}

      {/* 기이 표시 (leafCount 변수 사용 회피 경고 방지용) */}
      {leafCount > 0 && <g />}
    </svg>
  );
}

/* ─────────────────────────────── 반딧불 ─────────────────────────────── */
function Fireflies() {
  return (
    <svg className={styles.bonsaiFireflies} viewBox="0 0 320 360" aria-hidden>
      {FIREFLIES.map((f) => (
        <motion.circle
          key={f.id}
          cx={f.cx}
          cy={f.cy}
          r="2.5"
          fill="#fde68a"
          animate={{
            opacity: [0, 0.9, 0.2, 0.8, 0],
            cx: [f.cx, f.cx + 20, f.cx - 15, f.cx + 10, f.cx],
            cy: [f.cy, f.cy - 15, f.cy + 10, f.cy - 8, f.cy],
          }}
          transition={{
            duration: f.duration,
            repeat: Infinity,
            delay: f.delay,
            ease: 'easeInOut',
          }}
          style={{
            filter: 'drop-shadow(0 0 4px #fcd34d)',
          }}
        />
      ))}
    </svg>
  );
}

/* ─────────────────────────────── 메인 ─────────────────────────────── */
export default function ZenBonsai({ onBack }: ZenBonsaiProps) {
  const [level, setLevel] = useState(0);
  const [night, setNight] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const [remaining, setRemaining] = useState(BREATH_SESSION);
  const [message, setMessage] = useState<string | null>(null);
  const [justGrew, setJustGrew] = useState(false);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 초기 로드 */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LEVEL);
      if (stored) setLevel(Math.min(MAX_LEVEL, Math.max(0, parseInt(stored, 10) || 0)));
    } catch { /* ignore */ }
    setNight(isNightTime());
    const nightCheck = setInterval(() => setNight(isNightTime()), 60_000);
    return () => clearInterval(nightCheck);
  }, []);

  /* 나무 터치 → 격려 메시지 */
  const handleTreeTap = useCallback(() => {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    setMessage(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), 2500);
  }, []);

  /* 호흡 세션 시작 */
  const startBreathing = useCallback(() => {
    setRemaining(BREATH_SESSION);
    setBreathing(true);
  }, []);

  /* 호흡 세션 중단 (완료 전) */
  const stopBreathing = useCallback(() => {
    setBreathing(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  /* 호흡 세션 완료 → 성장 */
  const completeBreathing = useCallback(() => {
    setBreathing(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLevel((prev) => {
      const next = Math.min(MAX_LEVEL, prev + 1);
      try {
        localStorage.setItem(STORAGE_KEY_LEVEL, String(next));
        localStorage.setItem(STORAGE_KEY_LAST, new Date().toISOString());
      } catch { /* ignore */ }
      return next;
    });
    setJustGrew(true);
    setTimeout(() => setJustGrew(false), 2000);
  }, []);

  /* 타이머 틱 */
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [breathing, completeBreathing]);

  /* 리셋 */
  const resetGrowth = useCallback(() => {
    if (!confirm('분재를 씨앗 상태로 되돌릴까요?')) return;
    setLevel(0);
    try {
      localStorage.removeItem(STORAGE_KEY_LEVEL);
      localStorage.removeItem(STORAGE_KEY_LAST);
    } catch { /* ignore */ }
  }, []);

  const levelLabel =
    level === 0 ? '씨앗' :
    level <= 2 ? '새싹' :
    level <= 4 ? '어린 나무' :
    level <= 6 ? '자란 나무' :
    level <= 7 ? '큰 나무' :
    '꽃핀 분재';

  return (
    <div className={`${styles.bonsaiWrap} ${night ? styles.bonsaiNight : ''}`}>
      {/* 헤더 */}
      <div className={styles.bonsaiHeader}>
        <button type="button" className={styles.bonsaiBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className={styles.bonsaiHeaderCenter}>
          <span className={styles.bonsaiBrand}>ZEN BONSAI</span>
          <span className={styles.bonsaiLevelText}>
            {levelLabel} · {level}/{MAX_LEVEL}
          </span>
        </div>
        <button type="button" className={styles.bonsaiResetBtn} onClick={resetGrowth} aria-label="처음부터">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* 수묵화 배경 */}
      <div className={styles.bonsaiStage}>
        {/* 배경 원 (달/해) */}
        <motion.div
          className={styles.bonsaiMoon}
          initial={{ opacity: 0 }}
          animate={{ opacity: night ? 0.35 : 0.2 }}
          transition={{ duration: 2 }}
        />

        {/* 반딧불 (밤만) */}
        {night && <Fireflies />}

        {/* 분재 트리 — 탭 가능 */}
        <motion.button
          type="button"
          className={styles.bonsaiTreeBtn}
          onClick={handleTreeTap}
          aria-label="나무 터치"
          whileTap={{ scale: 0.97 }}
          animate={justGrew ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 0.6 }}
        >
          <BonsaiTree level={level} night={night} />
        </motion.button>

        {/* 성장 순간 — 반짝임 */}
        <AnimatePresence>
          {justGrew && (
            <motion.div
              className={styles.bonsaiSparkle}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Sparkles size={28} />
              <span>자라났어요</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 격려 메시지 팝업 */}
        <AnimatePresence>
          {message && (
            <motion.div
              className={styles.bonsaiMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <Leaf size={14} />
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 호흡 세션 오버레이 */}
      <AnimatePresence>
        {breathing && (
          <motion.div
            className={styles.bonsaiBreathOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.bonsaiBreathCircle}
              animate={{
                scale: [1, 1.35, 1.35, 1],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.4, 0.6, 1],
              }}
            />
            <div className={styles.bonsaiBreathInfo}>
              <span className={styles.bonsaiBreathLabel}>숨을 천천히 들이쉬고 내쉬세요</span>
              <span className={styles.bonsaiBreathTime}>{remaining}초</span>
              <button
                type="button"
                className={styles.bonsaiBreathCancel}
                onClick={stopBreathing}
              >
                중단
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 하단 컨트롤 */}
      <div className={styles.bonsaiBottom}>
        <p className={styles.bonsaiHint}>
          휴식 1분을 완료하면 분재가 한 단계 자라납니다
        </p>
        <button
          type="button"
          className={styles.bonsaiStartBtn}
          onClick={startBreathing}
          disabled={breathing || level >= MAX_LEVEL}
        >
          {level >= MAX_LEVEL ? '이미 완성된 분재' : '휴식 시작 (1분)'}
        </button>
      </div>
    </div>
  );
}
