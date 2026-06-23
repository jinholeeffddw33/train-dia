'use client'

import { useState, useEffect, useRef } from 'react'

interface UseHeaderScrollOptions {
  /** 이 위치(px) 이하에서는 항상 표시 + 투명(배경에 묻힘). 기본 60. */
  topZone?: number
  /** 방향 전환으로 판정할 최소 이동량(px). 미세 떨림 무시. 기본 4. */
  threshold?: number
  /** 스크롤 컨테이너. 기본 window(전역 스크롤). train-dia 가 내부 컨테이너를 스크롤하면
   *  그 ref 를 넘긴다. (ZINOSB 는 window 스크롤이라 기본값으로 동작.) */
  target?: React.RefObject<HTMLElement | null>
}

/**
 * 상단 Header 전용 스크롤 모델 — 단일 rAF 스로틀 리스너 하나로 두 값을 계산. (ZINOSB 이식, 2026-06-23)
 *
 *  • hidden  : 아래로 스크롤 → 헤더가 위로 슬라이드되어 사라짐(transform). 위로 → 복귀.
 *  • frosted : topZone 을 넘어선 뒤에만 true → 헤더가 다시 내려올 때만 불투명 배경을 깐다.
 *              최상단(topZone 이내)에선 false = 투명이라 배경에 자연스럽게 묻힌다.
 *
 * 설계 원칙(잰크 0): 기하 불변(transform/opacity 만) → reflow 0. 리스너 1개, rAF 프레임당 1회.
 *  anchorY(방향 전환 기준)는 방향이 실제로 바뀔 때만 갱신.
 */
export function useHeaderScroll(options: UseHeaderScrollOptions = {}) {
  const { topZone = 60, threshold = 4, target } = options
  const [hidden, setHidden] = useState(false)
  const [frosted, setFrosted] = useState(false)
  const anchorY = useRef(0)
  const hiddenRef = useRef(false)
  const frostedRef = useRef(false)
  const ticking = useRef(false)

  useEffect(() => {
    const el = target?.current ?? null
    const getY = () => (el ? el.scrollTop : window.scrollY)
    const scrollSource: Window | HTMLElement = el ?? window

    const update = () => {
      ticking.current = false
      const y = getY()

      const nextFrost = y > topZone
      if (nextFrost !== frostedRef.current) {
        frostedRef.current = nextFrost
        setFrosted(nextFrost)
      }

      if (y <= topZone) {
        if (hiddenRef.current) {
          hiddenRef.current = false
          setHidden(false)
        }
        anchorY.current = y
        return
      }

      const delta = y - anchorY.current
      if (delta > threshold && !hiddenRef.current) {
        hiddenRef.current = true
        setHidden(true)
        anchorY.current = y
      } else if (delta < -threshold && hiddenRef.current) {
        hiddenRef.current = false
        setHidden(false)
        anchorY.current = y
      } else if (delta > 0 && hiddenRef.current) {
        anchorY.current = y
      } else if (delta < 0 && !hiddenRef.current) {
        anchorY.current = y
      }
    }

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(update)
    }

    update() // 초기 동기화
    scrollSource.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollSource.removeEventListener('scroll', onScroll)
  }, [topZone, threshold, target])

  return { hidden, frosted }
}
