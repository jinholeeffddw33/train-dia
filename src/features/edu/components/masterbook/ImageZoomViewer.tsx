'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import type { MasterBookImage } from '../../lib/masterbook';
import { MASTERBOOK_IMG_BASE } from '../../lib/masterbook';
import s from './MasterBook.module.css';

interface ImageZoomViewerProps {
  title: string;
  images: MasterBookImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

type View = { s: number; x: number; y: number };

const MIN = 1;
const MAX = 4;
const DOUBLE_TAP = 2.5;
const STEP = 1.6;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 원본 그림 확대 보기 — 두 손가락 늘리기·끌어 옮기기·두 번 톡(2.5배)·＋/－ 단추.
 * 50·60대는 두 손가락 동작이 서툰 경우가 많아 ＋/－ 단추를 같이 둔다.
 * 확대 중 매 프레임 리렌더를 피하려고 변형은 ref 로 직접 적용한다.
 */
export default function ImageZoomViewer({ title, images, index, onIndex, onClose }: ImageZoomViewerProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose);
  useHistoryBack('masterbook-zoom', onClose, true);

  const img = images[index];
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [hiRes, setHiRes] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  /* 화면에 맞춘 그림 자리(배율 1) — 끌어 옮길 때 그림이 화면 밖으로 사라지지 않게 가둔다 */
  const fitRect = useCallback(() => {
    const st = stageRef.current;
    const W = st?.clientWidth ?? 0;
    const H = st?.clientHeight ?? 0;
    const ratio = img.w / img.h;
    const fw = Math.min(W, H * ratio);
    const fh = fw / ratio;
    return { W, H, fx: (W - fw) / 2, fy: (H - fh) / 2, fw, fh };
  }, [img.w, img.h]);

  const clamp = useCallback((v: View): View => {
    const { W, H, fx, fy, fw, fh } = fitRect();
    const sc = Math.min(MAX, Math.max(MIN, v.s));
    const cw = fw * sc;
    const ch = fh * sc;
    const x = cw <= W ? (W - cw) / 2 - fx * sc : Math.min(-fx * sc, Math.max(W - (fx + fw) * sc, v.x));
    const y = ch <= H ? (H - ch) / 2 - fy * sc : Math.min(-fy * sc, Math.max(H - (fy + fh) * sc, v.y));
    return { s: sc, x, y };
  }, [fitRect]);

  const apply = useCallback((v: View, animate = false) => {
    view.current = v;
    const el = layerRef.current;
    if (!el) return;
    el.dataset.anim = animate ? '1' : '0';
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`;
    setScale((prev) => (Math.abs(prev - v.s) > 0.01 ? v.s : prev));
  }, []);

  /** 화면 속 한 점(px, py)을 중심으로 배율 바꾸기 */
  const zoomAt = useCallback((ns: number, px: number, py: number, animate = false) => {
    const v = view.current;
    const sc = Math.min(MAX, Math.max(MIN, ns));
    const cx = (px - v.x) / v.s;
    const cy = (py - v.y) / v.s;
    apply(clamp({ s: sc, x: px - cx * sc, y: py - cy * sc }), animate);
  }, [apply, clamp]);

  const zoomCenter = useCallback((ns: number) => {
    const { W, H } = fitRect();
    zoomAt(ns, W / 2, H / 2, true);
  }, [fitRect, zoomAt]);

  // 그림이 바뀌면 원래 크기로, 선명한(확대용) 그림을 따로 받아 둔다
  useEffect(() => {
    apply({ s: 1, x: 0, y: 0 });
    setHiRes(false);
    setFailed(false);
    const pre = new Image();
    pre.onload = () => setHiRes(true);
    pre.src = MASTERBOOK_IMG_BASE + img.zoom;
    return () => { pre.onload = null; };
  }, [img.zoom, apply, reload]);

  // 화면 돌림·창 크기 변경
  useEffect(() => {
    const st = stageRef.current;
    if (!st || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => apply(clamp(view.current)));
    ro.observe(st);
    return () => ro.disconnect();
  }, [apply, clamp]);

  // 컴퓨터 마우스 휠 — passive 가 아니어야 페이지가 같이 굴러가지 않는다
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = st.getBoundingClientRect();
      zoomAt(view.current.s * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    };
    st.addEventListener('wheel', onWheel, { passive: false });
    return () => st.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  // ← → 키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) onIndex(index - 1);
      else if (e.key === 'ArrowRight' && hasNext) onIndex(index + 1);
      else if (e.key === '+' || e.key === '=') zoomCenter(view.current.s * STEP);
      else if (e.key === '-') zoomCenter(view.current.s / STEP);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasPrev, hasNext, index, onIndex, zoomCenter]);

  /* ── 손가락·마우스 ── */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    start: View;
    sx: number; sy: number;
    d0: number; mx: number; my: number;
    moved: boolean;
  }>({ mode: 'none', start: { s: 1, x: 0, y: 0 }, sx: 0, sy: 0, d0: 1, mx: 0, my: 0, moved: false });
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const local = (e: React.PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const beginPan = (p: { x: number; y: number }) => {
    gesture.current = { ...gesture.current, mode: 'pan', start: { ...view.current }, sx: p.x, sy: p.y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // 손가락이 무대 밖으로 나가도 이어서 받는다 (없는 포인터면 던지므로 감싼다)
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        ...gesture.current,
        mode: 'pinch',
        start: { ...view.current },
        d0: Math.max(1, dist(a, b)),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        moved: true,
      };
    } else if (pointers.current.size === 1) {
      beginPan(p);
      gesture.current.moved = false;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const ns = Math.min(MAX, Math.max(MIN, g.start.s * (dist(a, b) / g.d0)));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const cx = (g.mx - g.start.x) / g.start.s;
      const cy = (g.my - g.start.y) / g.start.s;
      apply(clamp({ s: ns, x: mx - cx * ns, y: my - cy * ns }));
    } else if (g.mode === 'pan') {
      const dx = p.x - g.sx;
      const dy = p.y - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 8) g.moved = true;
      if (g.moved && g.start.s > 1.01) apply(clamp({ s: g.start.s, x: g.start.x + dx, y: g.start.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 1) {
      // 두 손가락 중 하나를 뗐다 → 남은 손가락으로 이어서 옮기기
      beginPan([...pointers.current.values()][0]);
      gesture.current.moved = true;
      return;
    }
    if (pointers.current.size > 0) return;
    const dx = p.x - g.sx;
    const dy = p.y - g.sy;
    const wasPan = g.mode === 'pan';
    g.mode = 'none';

    if (!g.moved) {
      const now = Date.now();
      const lt = lastTap.current;
      if (lt && now - lt.t < 320 && Math.hypot(p.x - lt.x, p.y - lt.y) < 40) {
        lastTap.current = null;
        if (view.current.s > 1.05) apply(clamp({ s: 1, x: 0, y: 0 }), true);
        else zoomAt(DOUBLE_TAP, p.x, p.y, true);
      } else {
        lastTap.current = { t: now, x: p.x, y: p.y };
      }
      return;
    }
    // 원래 크기에서 옆으로 쓸면 앞·뒤 그림
    if (wasPan && g.start.s <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && hasNext) onIndex(index + 1);
      else if (dx > 0 && hasPrev) onIndex(index - 1);
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current.mode = 'none';
  };

  const zoomed = scale > 1.01;

  return (
    <div ref={dialogRef} className={s.zvRoot} role="dialog" aria-modal="true" aria-labelledby="mb-zoom-title">
      <div className={s.zvTop}>
        <div className={s.zvTitleWrap}>
          <h2 id="mb-zoom-title" className={s.zvTitle}>{title}</h2>
          <span className={s.zvSub}>{img.label}</span>
        </div>
        <button type="button" className={s.zvIconBtn} onClick={onClose} aria-label="크게 보기 닫기">
          <X size={24} />
        </button>
      </div>

      <div
        ref={stageRef}
        className={s.zvStage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div ref={layerRef} className={s.zvLayer}>
          {!failed && (
            // eslint-disable-next-line @next/next/no-img-element -- 확대 변형을 직접 다루는 원본 그림
            <img
              key={`${img.src}-${reload}`}
              className={s.zvImg}
              src={MASTERBOOK_IMG_BASE + (hiRes ? img.zoom : img.src)}
              alt={`${title} — ${img.label}`}
              width={img.w}
              height={img.h}
              draggable={false}
              onError={() => setFailed(true)}
            />
          )}
        </div>
        {!failed && !hiRes && <span className={s.zvBadge}>선명한 그림을 받는 중…</span>}
        {failed && (
          <div className={s.zvError} role="alert">
            그림을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.
            <button type="button" className={s.mbRetryBtn} onClick={() => setReload((n) => n + 1)}>
              다시 불러오기
            </button>
          </div>
        )}
      </div>

      <div className={s.zvBottom}>
        <div className={s.zvGroup}>
          <button type="button" className={s.zvIconBtn} onClick={() => onIndex(index - 1)} disabled={!hasPrev} aria-label="앞 그림">
            <ChevronLeft size={24} />
          </button>
          <span className={s.zvCount} aria-live="polite">{index + 1} / {images.length}</span>
          <button type="button" className={s.zvIconBtn} onClick={() => onIndex(index + 1)} disabled={!hasNext} aria-label="다음 그림">
            <ChevronRight size={24} />
          </button>
        </div>
        <div className={s.zvGroup}>
          <button type="button" className={s.zvIconBtn} onClick={() => zoomCenter(view.current.s / STEP)} disabled={!zoomed} aria-label="작게">
            <ZoomOut size={22} />
          </button>
          <button type="button" className={s.zvIconBtn} onClick={() => zoomCenter(view.current.s * STEP)} disabled={scale >= MAX - 0.01} aria-label="크게">
            <ZoomIn size={22} />
          </button>
          <button type="button" className={`${s.zvIconBtn} ${s.zvResetBtn}`} onClick={() => apply(clamp({ s: 1, x: 0, y: 0 }), true)} disabled={!zoomed} aria-label="원래 크기로">
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
