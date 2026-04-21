'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, CloudRain, Trees, Flame, Play, Pause } from 'lucide-react';
import styles from './dab.module.css';

interface AsmrTherapyProps { onBack: () => void }

interface Theme {
  id: string;
  label: string;
  desc: string;
  icon: typeof CloudRain;
  color: 'blue' | 'green' | 'amber';
  src: string;
}

const THEMES: Theme[] = [
  { id: 'rain',     label: '비 오는 창가',   desc: '창문을 타고 흐르는 빗방울',   icon: CloudRain, color: 'blue',  src: '/audio/rain-window.mp3' },
  { id: 'forest',   label: '숲속의 바람',     desc: '나뭇잎 사이로 부는 바람',    icon: Trees,     color: 'green', src: '/audio/forest-wind.mp3' },
  { id: 'fire',     label: '장작 타는 소리', desc: '모닥불의 타닥타닥',          icon: Flame,     color: 'amber', src: '/audio/fireplace.mp3' },
];

export default function AsmrTherapy({ onBack }: AsmrTherapyProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  /* 오디오 종료 시 초기화 */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveId(null);
  }, []);

  /* 재생 토글 */
  const toggle = useCallback((theme: Theme) => {
    setError(null);
    if (activeId === theme.id) {
      stop();
      return;
    }
    setLoading(true);
    // 이전 오디오 정리
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(theme.src);
    audio.loop = true;
    audio.volume = 0.7;
    audioRef.current = audio;

    audio.addEventListener('canplaythrough', () => {
      setLoading(false);
      audio.play().catch((e) => {
        setError('재생할 수 없어요. 잠시 후 다시 시도해 주세요.');
        setActiveId(null);
        console.warn('Audio play failed', e);
      });
    });
    audio.addEventListener('error', () => {
      setLoading(false);
      setError('음원 파일을 준비 중입니다. 조금만 기다려 주세요.');
      setActiveId(null);
    });

    setActiveId(theme.id);
  }, [activeId, stop]);

  /* 언마운트 시 정리 */
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* 웨이브폼 애니메이션 (사인파 기반 — 재생 중일 때만) */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setupSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setupSize();
    window.addEventListener('resize', setupSize);

    let t = 0;
    const tick = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      if (activeId) {
        const mid = h / 2;
        // 여러 파동 레이어
        const layers = [
          { amp: 18, freq: 0.025, speed: 0.04, color: 'rgba(147, 197, 253, 0.7)' },
          { amp: 12, freq: 0.04,  speed: 0.06, color: 'rgba(196, 181, 253, 0.55)' },
          { amp: 8,  freq: 0.07,  speed: 0.08, color: 'rgba(167, 243, 208, 0.45)' },
        ];
        for (const l of layers) {
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const y = mid + Math.sin(x * l.freq + t * l.speed) * l.amp
                          + Math.sin(x * l.freq * 2.1 + t * l.speed * 1.4) * l.amp * 0.4;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      t += 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', setupSize);
    };
  }, [activeId]);

  return (
    <div className={styles.asmrWrap}>
      <div className={styles.asmrHeader}>
        <button type="button" className={styles.asmrBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.asmrTitle}>ASMR 테라피</h1>
      </div>

      <div className={styles.asmrBody}>
        <p className={styles.asmrSub}>원하는 소리를 골라 눈을 감으세요</p>

        {/* 웨이브폼 */}
        <div className={styles.waveWrap}>
          <canvas ref={canvasRef} className={styles.waveCanvas} />
          {!activeId && <span className={styles.waveIdle}>재생 중인 소리가 없어요</span>}
        </div>

        {error && <div className={styles.asmrError}>{error}</div>}

        {/* 테마 카드 */}
        <div className={styles.themeGrid}>
          {THEMES.map((t) => {
            const Icon = t.icon;
            const isActive = activeId === t.id;
            const isLoading = loading && activeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.themeCard} ${isActive ? styles.themeCardActive : ''} ${
                  t.color === 'blue' ? styles.themeBlue :
                  t.color === 'green' ? styles.themeGreen :
                  styles.themeAmber
                }`}
                onClick={() => toggle(t)}
                aria-pressed={isActive}
              >
                <div className={styles.themeIcon}>
                  <Icon size={28} />
                </div>
                <div className={styles.themeText}>
                  <span className={styles.themeLabel}>{t.label}</span>
                  <span className={styles.themeDesc}>{t.desc}</span>
                </div>
                <div className={styles.themePlayBtn} aria-hidden>
                  {isLoading ? (
                    <span className={styles.themeLoading}>●</span>
                  ) : isActive ? (
                    <Pause size={22} fill="currentColor" />
                  ) : (
                    <Play size={22} fill="currentColor" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
