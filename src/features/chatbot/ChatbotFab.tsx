'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import styles from './Chatbot.module.css';

interface Props {
  onClick: () => void;
}

const STORAGE_KEY = 'chatbot-fab-pos-v1';
const FAB_SIZE = 56;
const MARGIN = 12;
const DRAG_THRESHOLD = 6;

interface Pos { x: number; y: number }

function clampPos(p: Pos): Pos {
  if (typeof window === 'undefined') return p;
  const W = window.innerWidth;
  const H = window.innerHeight;
  return {
    x: Math.min(Math.max(MARGIN, p.x), W - FAB_SIZE - MARGIN),
    y: Math.min(Math.max(MARGIN, p.y), H - FAB_SIZE - MARGIN),
  };
}

function defaultPos(): Pos {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  return clampPos({ x: window.innerWidth - FAB_SIZE - 20, y: window.innerHeight - FAB_SIZE - 140 });
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Pos;
      if (typeof obj.x === 'number' && typeof obj.y === 'number') return clampPos(obj);
    }
  } catch { /* ignore */ }
  return defaultPos();
}

export default function ChatbotFab({ onClick }: Props) {
  const [pos, setPos] = useState<Pos>(() => (typeof window === 'undefined' ? { x: 100, y: 100 } : defaultPos()));
  const dragRef = useRef<{
    startX: number; startY: number;
    offsetX: number; offsetY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPos(loadPos());
  }, []);

  // 창 크기 변경 시 화면 안에 머무르도록 보정
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
      moved: false,
    };
  }, [pos.x, pos.y]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // 임계 미만은 드래그 아님
    d.moved = true;
    setIsDragging(true);
    setPos(clampPos({ x: e.clientX - d.offsetX, y: e.clientY - d.offsetY }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (d && d.moved) {
      // 드래그 종료 — 위치 저장
      const next = clampPos({ x: e.clientX - d.offsetX, y: e.clientY - d.offsetY });
      setPos(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    } else {
      // 탭 — 클릭 트리거
      onClick();
    }
  }, [onClick]);

  return (
    <button
      type="button"
      className={`${styles.fab} ${isDragging ? styles.fabDragging : ''}`}
      /* STYLE-EXCEPTION: 사용자 드래그 위치 (런타임 값) */
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current = null; setIsDragging(false); }}
      aria-label="일상 도우미 챗봇 열기 (꾹 누르고 드래그하면 이동)"
    >
      <MessageCircle size={24} />
    </button>
  );
}
