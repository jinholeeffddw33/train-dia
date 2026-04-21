'use client';

import { useEffect, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import styles from './dab.module.css';

interface GravityZenProps { onBack: () => void }

interface Droplet { x: number; y: number; vy: number; r: number; alpha: number; active: boolean }
interface Ripple { x: number; y: number; radius: number; alpha: number; active: boolean }
interface Splash { x: number; y: number; vx: number; vy: number; r: number; alpha: number; active: boolean }

/* ── 물리 파라미터 ── */
const GRAVITY = 0.4;
const WATER_COLS = 80;            // 수면 기둥 수
const COL_SPRING = 0.02;          // 복원력
const COL_DAMPING = 0.975;        // 감쇠
const NEIGHBOR_TENSION = 0.25;    // 이웃 장력 (파동 전파)
const WATER_RISE_PER_DROP = 0.4;  // 물방울당 수면 상승 (px)

export default function GravityZen({ onBack }: GravityZenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
    waterBase: 0,              // 수면 기준 높이 (화면 아래에서부터)
    columns: [] as { y: number; v: number }[],
    droplets: [] as Droplet[],
    ripples: [] as Ripple[],
    splashes: [] as Splash[],
    raf: 0,
  });

  const spawnDroplet = useCallback((x: number, y: number) => {
    const s = stateRef.current;
    const slot = s.droplets.find(d => !d.active);
    const droplet: Droplet = { x, y, vy: 1, r: 8 + Math.random() * 4, alpha: 0.85, active: true };
    if (slot) Object.assign(slot, droplet);
    else if (s.droplets.length < 60) s.droplets.push(droplet);
  }, []);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    // 상단 영역에서 발생한 터치만 물방울 생성
    if (y < rect.height * 0.45) {
      spawnDroplet(x, y);
    }
  }, [spawnDroplet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;

    /* 해상도 설정 */
    const setupSize = () => {
      const rect = canvas.getBoundingClientRect();
      s.dpr = window.devicePixelRatio || 1;
      s.width = rect.width;
      s.height = rect.height;
      canvas.width = rect.width * s.dpr;
      canvas.height = rect.height * s.dpr;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);

      // 수면 초기화: 화면 아래 15% 위치에서 시작
      s.waterBase = s.height * 0.15;
      s.columns = Array.from({ length: WATER_COLS }, () => ({ y: 0, v: 0 }));
    };
    setupSize();

    const onResize = () => setupSize();
    window.addEventListener('resize', onResize);

    /* 애니메이션 루프 */
    const tick = () => {
      const { width, height } = s;
      const surfaceY = height - s.waterBase;

      // 배경: 딥 네이비 그라데이션
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0b1226');
      bg.addColorStop(0.6, '#0d1833');
      bg.addColorStop(1, '#121b3a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // 배경 문구: 수면 위쪽에 은은하게
      ctx.save();
      ctx.fillStyle = 'rgba(199, 210, 254, 0.14)';
      ctx.font = '600 15px system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msgY = Math.max(surfaceY - 120, height * 0.35);
      ctx.fillText('오늘도 안전 운행하시느라', width / 2, msgY);
      ctx.fillText('고생하셨습니다', width / 2, msgY + 22);
      ctx.restore();

      // 물방울 업데이트
      for (const d of s.droplets) {
        if (!d.active) continue;
        d.vy += GRAVITY;
        d.y += d.vy;

        // 수면 충돌
        const colIdx = Math.max(0, Math.min(WATER_COLS - 1, Math.floor((d.x / width) * WATER_COLS)));
        const localSurface = surfaceY + s.columns[colIdx].y;
        if (d.y >= localSurface) {
          d.active = false;
          // 충격: 해당 기둥과 이웃에 속도
          const impact = -Math.min(d.vy * 1.8, 18);
          s.columns[colIdx].v += impact;
          if (colIdx > 0) s.columns[colIdx - 1].v += impact * 0.45;
          if (colIdx < WATER_COLS - 1) s.columns[colIdx + 1].v += impact * 0.45;
          // 수면 상승
          s.waterBase += WATER_RISE_PER_DROP;
          if (s.waterBase > height * 0.9) s.waterBase = height * 0.9; // 상한
          // 파동 링
          s.ripples.push({ x: d.x, y: localSurface, radius: 4, alpha: 0.6, active: true });
          // 튀는 물방울
          for (let i = 0; i < 5; i++) {
            const ang = (-Math.PI / 2) + (Math.random() - 0.5) * 1.2;
            const speed = 2 + Math.random() * 3;
            s.splashes.push({
              x: d.x, y: localSurface,
              vx: Math.cos(ang) * speed,
              vy: Math.sin(ang) * speed,
              r: 1.5 + Math.random() * 1.5,
              alpha: 0.85,
              active: true,
            });
          }
        }
      }

      // 수면 물리: 스프링 + 이웃 장력
      const cols = s.columns;
      const n = cols.length;
      // 1차: 스프링 복원 + 감쇠
      for (let i = 0; i < n; i++) {
        const c = cols[i];
        c.v += -COL_SPRING * c.y;
        c.v *= COL_DAMPING;
        c.y += c.v;
      }
      // 2차: 이웃에 장력 전달 (2 pass)
      for (let pass = 0; pass < 2; pass++) {
        const deltas = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          if (i > 0) deltas[i] += NEIGHBOR_TENSION * (cols[i - 1].y - cols[i].y);
          if (i < n - 1) deltas[i] += NEIGHBOR_TENSION * (cols[i + 1].y - cols[i].y);
        }
        for (let i = 0; i < n; i++) cols[i].v += deltas[i];
      }

      // 수면 그리기 (곡선)
      ctx.save();
      const waterGrad = ctx.createLinearGradient(0, surfaceY - 20, 0, height);
      waterGrad.addColorStop(0, 'rgba(147, 197, 253, 0.85)');
      waterGrad.addColorStop(0.3, 'rgba(99, 160, 223, 0.75)');
      waterGrad.addColorStop(1, 'rgba(49, 91, 160, 0.95)');
      ctx.fillStyle = waterGrad;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * width;
        const y = surfaceY + cols[i].y;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const prevX = ((i - 1) / (n - 1)) * width;
          const prevY = surfaceY + cols[i - 1].y;
          const cx = (prevX + x) / 2;
          const cy = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, cx, cy);
        }
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // 수면 반사광 (하이라이트 라인)
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * width;
        const y = surfaceY + cols[i].y - 1;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 물방울 그리기
      for (const d of s.droplets) {
        if (!d.active) continue;
        ctx.save();
        const g = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
        g.addColorStop(0, `rgba(255, 255, 255, ${d.alpha * 0.9})`);
        g.addColorStop(0.4, `rgba(191, 219, 254, ${d.alpha * 0.6})`);
        g.addColorStop(1, `rgba(96, 165, 250, ${d.alpha * 0.3})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        // 안쪽 하이라이트
        ctx.fillStyle = `rgba(255, 255, 255, ${d.alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 파동 링
      for (const r of s.ripples) {
        if (!r.active) continue;
        r.radius += 1.4;
        r.alpha -= 0.012;
        if (r.alpha <= 0) { r.active = false; continue; }
        ctx.save();
        ctx.strokeStyle = `rgba(191, 219, 254, ${r.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 튀는 물방울
      for (const sp of s.splashes) {
        if (!sp.active) continue;
        sp.vy += GRAVITY * 0.6;
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.alpha -= 0.018;
        if (sp.alpha <= 0) { sp.active = false; continue; }
        ctx.save();
        ctx.fillStyle = `rgba(191, 219, 254, ${sp.alpha})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 배열 정리 (매 120 프레임마다)
      if (Math.random() < 0.008) {
        s.droplets = s.droplets.filter(d => d.active);
        s.ripples = s.ripples.filter(r => r.active);
        s.splashes = s.splashes.filter(sp => sp.active);
      }

      s.raf = requestAnimationFrame(tick);
    };

    s.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /* 터치/클릭 이벤트 */
  const onTouchStart = (e: React.TouchEvent) => {
    for (const t of Array.from(e.touches)) handlePointer(t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.touches)) {
      if (Math.random() < 0.4) handlePointer(t.clientX, t.clientY);
    }
  };
  const onMouseDown = (e: React.MouseEvent) => handlePointer(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1 && Math.random() < 0.4) handlePointer(e.clientX, e.clientY);
  };

  return (
    <div className={styles.zenWrap}>
      <button type="button" className={styles.zenBackBtn} onClick={onBack} aria-label="뒤로가기">
        <ArrowLeft size={20} strokeWidth={2} />
      </button>

      <canvas
        ref={canvasRef}
        className={styles.zenCanvas}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
      />

      <div className={styles.zenHint}>화면 위쪽을 톡 누르면 물방울이 떨어져요</div>
    </div>
  );
}
