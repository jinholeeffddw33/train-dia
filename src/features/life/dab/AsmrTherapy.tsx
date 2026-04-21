'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, CloudRain, Trees, Flame, Play, Pause } from 'lucide-react';
import styles from './dab.module.css';

interface AsmrTherapyProps { onBack: () => void }

type ThemeId = 'rain' | 'forest' | 'fire';

interface Theme {
  id: ThemeId;
  label: string;
  desc: string;
  icon: typeof CloudRain;
  color: 'blue' | 'green' | 'amber';
  /** YouTube 영상 ID — 있으면 iframe 재생, 없으면 Web Audio 합성 */
  youtubeId?: string;
}

const THEMES: Theme[] = [
  { id: 'rain',   label: '비 오는 창가',   desc: '창문을 타고 흐르는 빗방울', icon: CloudRain, color: 'blue',  youtubeId: 'lQ0fS2meTYQ' },
  { id: 'forest', label: '숲속의 바람',     desc: '나뭇잎 사이로 부는 바람',   icon: Trees,     color: 'green', youtubeId: '595mTG7KyRs' },
  { id: 'fire',   label: '장작 타는 소리', desc: '모닥불의 타닥타닥',         icon: Flame,     color: 'amber', youtubeId: 'N_g3AiXF-q8' },
];

/* ── Web Audio 엔진 ──
 * 테마별 실시간 합성:
 *   rain:   화이트노이즈(HPF) + 랜덤 물방울 톤
 *   forest: 브라운노이즈(LPF + LFO 돌풍)
 *   fire:   저역 럼블(LPF) + 랜덤 크래클링 버스트
 */
class AsmrEngine {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
  private activeNodes: AudioNode[] = [];
  private timeouts: number[] = [];

  constructor() {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private createNoiseBuffer(seconds: number, type: 'white' | 'brown'): AudioBuffer {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (type === 'white') {
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    } else {
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
    return buffer;
  }

  private pushTimeout(fn: () => void, delay: number) {
    const id = window.setTimeout(fn, delay);
    this.timeouts.push(id);
  }

  /** 비 오는 창가 */
  playRain() {
    // 배경: 화이트노이즈 + 하이패스 (쏴아아 빗소리)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(2, 'white');
    noise.loop = true;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 900;
    hpf.Q.value = 0.5;
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 6000;
    const bgGain = this.ctx.createGain();
    bgGain.gain.value = 0.18;
    noise.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(bgGain);
    bgGain.connect(this.master);
    noise.start();
    this.activeNodes.push(noise, hpf, lpf, bgGain);

    // 랜덤 물방울 톤 — '톡', '탁'
    const scheduleDrop = () => {
      const t = this.ctx.currentTime + 0.02;
      const freq = 1500 + Math.random() * 2500;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 1.3, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.08);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.015, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.15);
      this.pushTimeout(scheduleDrop, 60 + Math.random() * 180);
    };
    scheduleDrop();
  }

  /** 숲속의 바람 */
  playForest() {
    // 배경: 브라운노이즈 + 저역통과
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(4, 'brown');
    noise.loop = true;
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 600;
    lpf.Q.value = 0.9;

    // LFO로 돌풍 효과 (필터 주파수 흔들기)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain);
    lfoGain.connect(lpf.frequency);

    // 추가 LFO로 볼륨 흔들기
    const volLfo = this.ctx.createOscillator();
    volLfo.type = 'sine';
    volLfo.frequency.value = 0.08;
    const volLfoGain = this.ctx.createGain();
    volLfoGain.gain.value = 0.08;
    const bgGain = this.ctx.createGain();
    bgGain.gain.value = 0.4;
    volLfo.connect(volLfoGain);
    volLfoGain.connect(bgGain.gain);

    noise.connect(lpf);
    lpf.connect(bgGain);
    bgGain.connect(this.master);
    noise.start();
    lfo.start();
    volLfo.start();
    this.activeNodes.push(noise, lpf, lfo, lfoGain, volLfo, volLfoGain, bgGain);

    // 가끔 나뭇잎 바스락 소리
    const scheduleRustle = () => {
      const t = this.ctx.currentTime + 0.05;
      const dur = 0.3 + Math.random() * 0.5;
      const rustle = this.ctx.createBufferSource();
      rustle.buffer = this.createNoiseBuffer(dur, 'white');
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3000 + Math.random() * 2000;
      bp.Q.value = 1.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      rustle.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      rustle.start(t);
      rustle.stop(t + dur + 0.05);
      this.pushTimeout(scheduleRustle, 1500 + Math.random() * 3500);
    };
    this.pushTimeout(scheduleRustle, 2000);
  }

  /** 장작 타는 소리 */
  playFire() {
    // 럼블: 브라운노이즈 + 저역통과
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = this.createNoiseBuffer(3, 'brown');
    rumble.loop = true;
    const rumLpf = this.ctx.createBiquadFilter();
    rumLpf.type = 'lowpass';
    rumLpf.frequency.value = 350;
    const rumGain = this.ctx.createGain();
    rumGain.gain.value = 0.18;
    rumble.connect(rumLpf);
    rumLpf.connect(rumGain);
    rumGain.connect(this.master);
    rumble.start();
    this.activeNodes.push(rumble, rumLpf, rumGain);

    // 얕은 바람 소리 (약한 고역)
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.createNoiseBuffer(2, 'white');
    hiss.loop = true;
    const hissBp = this.ctx.createBiquadFilter();
    hissBp.type = 'bandpass';
    hissBp.frequency.value = 3000;
    hissBp.Q.value = 0.7;
    const hissGain = this.ctx.createGain();
    hissGain.gain.value = 0.04;
    hiss.connect(hissBp);
    hissBp.connect(hissGain);
    hissGain.connect(this.master);
    hiss.start();
    this.activeNodes.push(hiss, hissBp, hissGain);

    // 랜덤 크래클 버스트 (타닥타닥)
    const scheduleCrackle = () => {
      const burstCount = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < burstCount; i++) {
        const offset = i * (0.02 + Math.random() * 0.05);
        const t = this.ctx.currentTime + 0.02 + offset;
        const dur = 0.015 + Math.random() * 0.04;
        const burst = this.ctx.createBufferSource();
        burst.buffer = this.createNoiseBuffer(dur + 0.01, 'white');
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2000 + Math.random() * 4000;
        bp.Q.value = 2 + Math.random() * 3;
        const g = this.ctx.createGain();
        const amp = 0.12 + Math.random() * 0.25;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        burst.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        burst.start(t);
        burst.stop(t + dur + 0.02);
      }
      this.pushTimeout(scheduleCrackle, 150 + Math.random() * 700);
    };
    scheduleCrackle();
  }

  fadeIn(targetVolume = 0.8, seconds = 0.6) {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(targetVolume, now + seconds);
  }

  async fadeOutAndStop(seconds = 0.4): Promise<void> {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + seconds);
    await new Promise(res => setTimeout(res, seconds * 1000 + 30));
    this.stopAllNodes();
  }

  stopAllNodes() {
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts = [];
    for (const n of this.activeNodes) {
      try {
        if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') {
          (n as AudioScheduledSourceNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped/disconnected */
      }
    }
    this.activeNodes = [];
  }

  async resume() {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  async destroy() {
    this.stopAllNodes();
    try { await this.ctx.close(); } catch { /* ignore */ }
  }
}

/* ═══════════════════════════════════════════
 * 컴포넌트
 * ═══════════════════════════════════════════ */

export default function AsmrTherapy({ onBack }: AsmrTherapyProps) {
  const [activeId, setActiveId] = useState<ThemeId | null>(null);
  const engineRef = useRef<AsmrEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const activeTheme = activeId ? THEMES.find(t => t.id === activeId) ?? null : null;

  const ensureEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new AsmrEngine();
    return engineRef.current;
  }, []);

  const start = useCallback(async (theme: Theme) => {
    // YouTube 테마는 Web Audio 엔진 정지하고 iframe에 맡김
    if (theme.youtubeId) {
      const engine = engineRef.current;
      if (engine) await engine.fadeOutAndStop();
      setActiveId(theme.id);
      return;
    }
    // 합성 테마: Web Audio 엔진 사용
    const engine = ensureEngine();
    await engine.resume();
    engine.stopAllNodes();
    if (theme.id === 'rain') engine.playRain();
    else if (theme.id === 'forest') engine.playForest();
    else if (theme.id === 'fire') engine.playFire();
    engine.fadeIn();
    setActiveId(theme.id);
  }, [ensureEngine]);

  const stop = useCallback(async () => {
    const engine = engineRef.current;
    if (engine) await engine.fadeOutAndStop();
    setActiveId(null);
  }, []);

  const toggle = useCallback((theme: Theme) => {
    if (activeId === theme.id) stop();
    else start(theme);
  }, [activeId, start, stop]);

  /* 언마운트 시 정리 */
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* 실시간 웨이브폼 (Analyser 데이터 사용) */
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

      if (activeId && engineRef.current) {
        const analyser = engineRef.current.analyser;
        const fft = analyser.fftSize;
        const data = new Uint8Array(fft);
        analyser.getByteTimeDomainData(data);

        const mid = h / 2;

        // 실제 오디오 데이터로 메인 파형
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 1) {
          const idx = Math.floor((x / w) * fft);
          const v = (data[idx] - 128) / 128;
          const y = mid + v * (h * 0.42);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 보조 레이어 (사인파로 부드러운 느낌 추가)
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y = mid + Math.sin(x * 0.04 + t * 0.05) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
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

        {/* 플레이어 영역 — YouTube 테마면 iframe, 합성 테마면 웨이브폼 */}
        {activeTheme?.youtubeId ? (
          <div className={styles.ytPlayerWrap}>
            <iframe
              key={activeTheme.id}
              className={styles.ytPlayerFrame}
              src={`https://www.youtube.com/embed/${activeTheme.youtubeId}?autoplay=1&loop=1&playlist=${activeTheme.youtubeId}&rel=0&modestbranding=1`}
              title={activeTheme.label}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        ) : (
          <div className={styles.waveWrap}>
            <canvas ref={canvasRef} className={styles.waveCanvas} />
            {!activeId && <span className={styles.waveIdle}>재생 중인 소리가 없어요</span>}
          </div>
        )}

        {/* 테마 카드 */}
        <div className={styles.themeGrid}>
          {THEMES.map((t) => {
            const Icon = t.icon;
            const isActive = activeId === t.id;
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
                  {isActive ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
