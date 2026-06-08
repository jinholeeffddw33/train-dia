'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 규정 본문 형광·메모 — localStorage 기반.
 * 한 기기 안에서만 유지되며, 클라이언트 단독 동작.
 */

export type HighlightColor = 'yellow' | 'pink' | 'green';

export interface Annotation {
  /** 안정 식별자 (timestamp + random) */
  id: string;
  /** 규정 식별자 (예: 'operation-rules') */
  regulationId: string;
  /** 페이지 번호 */
  page: number;
  /** 선택된 본문 텍스트 */
  text: string;
  /** 앞 30자 컨텍스트 (위치 매칭용) */
  before: string;
  /** 뒤 30자 컨텍스트 */
  after: string;
  /** 형광색 */
  color: HighlightColor;
  /** 메모 (선택) */
  memo?: string;
  /** ISO 생성/수정 시각 */
  updatedAt: string;
}

const STORAGE_KEY = 'regulation-annotations-v1';

function loadAll(): Annotation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveAll(list: Annotation[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 특정 규정의 형광·메모 목록 + 조작 함수 */
export function useAnnotations(regulationId: string) {
  const [all, setAll] = useState<Annotation[]>([]);

  useEffect(() => { setAll(loadAll()); }, []);

  const annotations = all.filter((a) => a.regulationId === regulationId);

  const add = useCallback((data: Omit<Annotation, 'id' | 'updatedAt' | 'regulationId'>): Annotation => {
    const item: Annotation = {
      ...data,
      regulationId,
      id: newId(),
      updatedAt: new Date().toISOString(),
    };
    setAll((prev) => {
      const next = [...prev, item];
      saveAll(next);
      return next;
    });
    return item;
  }, [regulationId]);

  const update = useCallback((id: string, patch: Partial<Pick<Annotation, 'color' | 'memo'>>) => {
    setAll((prev) => {
      const next = prev.map((a) => a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a);
      saveAll(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setAll((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAll(next);
      return next;
    });
  }, []);

  return { annotations, add, update, remove };
}
