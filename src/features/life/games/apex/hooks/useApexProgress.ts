'use client'

/**
 * APEX RUSH — 로컬 기록 + 바이크 컬러 (localStorage)
 * V13 다이어트: 레벨/XP/미션 전부 제거 (진호 "이딴거 싹다 없애고 겁나 심플하게").
 * 남는 것 = 내 최고 기록 + 컬러 선택 (전부 개방).
 */

import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'zinosb-apex-progress'

export interface BikeColorDef {
  id: string
  name: string
  hex: number
  css: string
}

// 5종 (진호 2026-07-07 "다섯 개 정도") — 전부 프레임 균일 틴트.
//   ★원본(레드)만 GLB 텍스처를 남기던 방식 폐기: 그 텍스처에 실물 "Santa Cruz" 워드마크가
//   구워져 있어 레드에서만 로고가 보이는 비일관 + 실브랜드 상표 노출 문제(진호 2026-07-07
//   "빨간색일때만 보이니까 이상해"). 이제 모든 컬러가 노멀/러프/메탈 맵은 유지(질감 보존)하고
//   albedo 만 단색 → 프레임 단색·컴포넌트(휠/포크/핸들바)는 실사 텍스처 그대로.
export const BIKE_COLORS: BikeColorDef[] = [
  { id: 'original', name: '레드', hex: 0xd23a2f, css: '#D23A2F' },
  { id: 'lime', name: '지노 라임', hex: 0xb6ff2a, css: '#B6FF2A' },
  { id: 'sky', name: '스카이 블루', hex: 0x38bdf8, css: '#38BDF8' },
  { id: 'violet', name: '바이올렛', hex: 0x8b5cf6, css: '#8B5CF6' },
  { id: 'white', name: '팬텀 화이트', hex: 0xf2f4ff, css: '#F2F4FF' },
]

export interface ApexProgress {
  selectedColor: string
  bestScore: number
  bestDistance: number
  totalRuns: number
}

const DEFAULT_PROGRESS: ApexProgress = {
  selectedColor: 'original',
  bestScore: 0,
  bestDistance: 0,
  totalRuns: 0,
}

function load(): ApexProgress {
  if (typeof window === 'undefined') return { ...DEFAULT_PROGRESS }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_PROGRESS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PROGRESS }
    const p = parsed as Partial<ApexProgress>
    // 구버전 저장분(xp/level 등)은 버리고 아는 필드만 취함
    return {
      selectedColor: typeof p.selectedColor === 'string' ? p.selectedColor : DEFAULT_PROGRESS.selectedColor,
      bestScore: typeof p.bestScore === 'number' ? p.bestScore : 0,
      bestDistance: typeof p.bestDistance === 'number' ? p.bestDistance : 0,
      totalRuns: typeof p.totalRuns === 'number' ? p.totalRuns : 0,
    }
  } catch {
    return { ...DEFAULT_PROGRESS }
  }
}

function save(progress: ApexProgress): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(progress))
  } catch { /* quota — 무시 */ }
}

export interface RunReward {
  newBestScore: boolean
  newBestDistance: boolean
}

export function useApexProgress() {
  // SSR/첫 페인트는 DEFAULT — 서버엔 localStorage 가 없어 load() 를 첫 렌더에 쓰면 서버(기본값)↔
  //   클라(저장값)가 어긋나 hydration mismatch 로 메뉴 트리가 통째로 재생성(시작 순간 깜빡임).
  //   마운트 후 effect 에서 실제 기록/컬러를 반영 (진호 2026-07-07 "시작 전 깨짐").
  const [progress, setProgress] = useState<ApexProgress>(() => ({ ...DEFAULT_PROGRESS }))
  useEffect(() => { setProgress(load()) }, [])

  /** 게임오버 시 호출 — 베스트 갱신 */
  const recordRun = useCallback((score: number, distance: number): RunReward => {
    const prev = load()
    const next: ApexProgress = {
      ...prev,
      bestScore: Math.max(prev.bestScore, score),
      bestDistance: Math.max(prev.bestDistance, distance),
      totalRuns: prev.totalRuns + 1,
    }
    save(next)
    setProgress(next)
    return {
      newBestScore: score > prev.bestScore,
      newBestDistance: distance > prev.bestDistance,
    }
  }, [])

  const selectColor = useCallback((id: string) => {
    setProgress((prev) => {
      if (!BIKE_COLORS.some((c) => c.id === id)) return prev
      const next = { ...prev, selectedColor: id }
      save(next)
      return next
    })
  }, [])

  const selectedColorDef = BIKE_COLORS.find((c) => c.id === progress.selectedColor) ?? BIKE_COLORS[0]

  return { progress, recordRun, selectColor, selectedColorDef }
}
