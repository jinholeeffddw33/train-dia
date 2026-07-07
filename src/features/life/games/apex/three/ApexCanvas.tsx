'use client'

/**
 * APEX RUSH — R3F Canvas 마운트 + 포인터 입력
 * 드래그(px) → 화면폭 정규화 steerDelta 로 시뮬레이션에 전달.
 * P0-15: touch-action:none(CSS .apexCanvasWrap) + pointer capture 명시 해제 + 안전망 타임아웃.
 * 언마운트 시 공유 에셋 완전 dispose (iOS WKWebView 메모리 방어).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { createApexAssets, disposeApexAssets, type ApexAssets } from './assets'
import { invalidateApexPack, loadApexPack } from './modelPack'
import { preloadBikeModel } from './bikeModel'
import { QualityGovernor } from '../engine/quality'
import { GameScene, type ShowcaseOrbit } from './GameScene'
import type { ApexSim } from '../engine/sim'
import type { InputState, SimEvents, SimState } from '../engine/types'
import styles from '../styles/apex.module.css'

interface ApexCanvasProps {
  sim: ApexSim
  bikeColor: number
  onFrame: (state: SimState, events: SimEvents) => void
  onGameOver: () => void
}

export default function ApexCanvas({ sim, bikeColor, onFrame, onGameOver }: ApexCanvasProps) {
  const inputRef = useRef<InputState>({ active: false, steerDelta: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const lastXRef = useRef(0)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 메뉴 쇼케이스 orbit — ready 페이즈에서 드래그=회전, 휠/핀치=줌 (진호 2026-07-07)
  const orbitRef = useRef<ShowcaseOrbit>({ yaw: 0.6, dist: 6, lastUser: 0 })
  const orbitPtrs = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistRef = useRef(0)

  // CC0 모델 팩 — 모듈 캐시라 재마운트 시 즉시 resolve.
  // 지오메트리 복원(createApexAssets)까지 이펙트 안에서 수행 — 렌더 중 throw 시
  // 에러 바운더리로 빠지는 대신 packError 재시도 경로로 합류 (적대 리뷰 확정 P1)
  const [assets, setAssets] = useState<ApexAssets | null>(null)
  const [packError, setPackError] = useState(false)
  const [packRetry, setPackRetry] = useState(0)
  useEffect(() => {
    let alive = true
    setPackError(false)
    // 코스 팩 + 자전거 GLB 를 함께 기다린다 — 둘 다 준비된 뒤에야 베일을 걷어
    //   자전거 pop-in(뒤늦게 붙는 현상)을 없앤다 (진호 2026-07-07). GLB preload 는 항상 resolve.
    Promise.all([loadApexPack(), preloadBikeModel()])
      .then(([data]) => {
        const built = createApexAssets(data)
        if (!alive) {
          disposeApexAssets(built)
          return
        }
        setAssets(built)
      })
      .catch(() => {
        // 스테일/손상 팩 가능성 — 캐시 무효화해 재시도가 HTTP 캐시를 뚫게 한다
        invalidateApexPack()
        if (alive) setPackError(true)
      })
    return () => { alive = false }
  }, [packRetry])

  const quality = useMemo(() => new QualityGovernor(1), [])

  useEffect(() => {
    if (!assets) return
    return () => { disposeApexAssets(assets) }
  }, [assets])

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    }
  }, [])

  const lastArmRef = useRef(0)

  const endDrag = useCallback(() => {
    inputRef.current.active = false
    pointerIdRef.current = null
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
  }, [])

  // 안전망 — 활동(pointermove)마다 연장. ★고정 12초는 "가만히/천천히 누르면 12초 후
  //   강제 해제 → 손 떼야 다시 먹힘" 사고를 냈다(진호 2026-07-05). 활동 기반으로 바꿔
  //   조작 중엔 죽지 않고, 이벤트 완전 유실(move·up 둘 다 안 옴) 시에만 4초 후 해제.
  const armSafety = useCallback(() => {
    const t = performance.now()
    if (t - lastArmRef.current < 1000) return // 재무장 스로틀 (move 초당 60회 부담 방지)
    lastArmRef.current = t
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = setTimeout(endDrag, 4000)
  }, [endDrag])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 메뉴(ready) — 드래그=쇼케이스 회전, 두 손가락=핀치 줌 (조향 아님)
    if (sim.state.phase === 'ready') {
      orbitPtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (orbitPtrs.current.size === 2) {
        const [a, b] = [...orbitPtrs.current.values()]
        pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y)
      }
      orbitRef.current.lastUser = performance.now()
      return
    }
    // 두 번째 손가락 무시 (첫 포인터만 조향)
    if (pointerIdRef.current !== null) return
    pointerIdRef.current = e.pointerId
    // 세로 게임 — 화면 좌우 드래그(clientX)가 그대로 조향 (진호 2026-07-07 가로 폐기, 세로 복귀)
    lastXRef.current = e.clientX
    inputRef.current.active = true
    // ★setPointerCapture 제거 (진호 2026-07-05 "계속 누르는데 갑자기 안 먹힘").
    //   iOS WKWebView 는 시스템 제스처 감지 시 capture 를 뺏으며 lostpointercapture/
    //   pointercancel 을 쏴 조향을 죽였다. 풀스크린 wrap + window 레벨 move 리스너면
    //   capture 없이도 포인터를 끝까지 추적하므로 capture 자체가 불필요(leak 위험 원천 제거).
    lastArmRef.current = 0
    armSafety()
  }, [armSafety])

  // 조향 추적은 window 레벨 — 포인터가 wrap 밖(HUD 버튼 위 등)으로 가도, capture 없이도
  // 끝까지 추적. pointerup/cancel 은 document 레벨이라 놓칠 확률이 극히 낮다.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // 쇼케이스 orbit 포인터 — 1개=회전, 2개=핀치 줌
      const op = orbitPtrs.current
      if (op.has(e.pointerId)) {
        const prev = op.get(e.pointerId)
        op.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const orbit = orbitRef.current
        if (op.size === 1 && prev) {
          orbit.yaw -= (e.clientX - prev.x) * 0.008
        } else if (op.size === 2) {
          const [a, b] = [...op.values()]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (pinchDistRef.current > 0 && d > 0) {
            orbit.dist = Math.min(10, Math.max(3.2, orbit.dist * (pinchDistRef.current / d)))
          }
          pinchDistRef.current = d
        }
        orbit.lastUser = performance.now()
        return
      }
      if (pointerIdRef.current !== e.pointerId) return
      const wrap = wrapRef.current
      if (!wrap) return
      // 세로 게임 — 좌우 드래그(clientX)를 화면폭으로 정규화해 조향 (진호 2026-07-07 세로 복귀)
      const cur = e.clientX
      const dx = cur - lastXRef.current
      lastXRef.current = cur
      inputRef.current.steerDelta += dx / (wrap.clientWidth || 1)
      armSafety()
    }
    const onEnd = (e: PointerEvent) => {
      if (orbitPtrs.current.delete(e.pointerId)) {
        pinchDistRef.current = 0
        return
      }
      if (pointerIdRef.current !== e.pointerId) return
      endDrag()
    }
    const onBlur = () => endDrag() // 앱 백그라운드 전환 시 유령 조향 방지
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', onBlur)
    }
  }, [armSafety, endDrag])

  if (!assets) {
    return (
      <div className={styles.apexCanvasWrap}>
        <div className={styles.canvasLoading}>
          {packError ? (
            <>
              <span className={styles.canvasLoadingText}>코스를 불러오지 못했어요</span>
              <button
                type="button"
                className={styles.canvasRetryBtn}
                onClick={() => setPackRetry((r) => r + 1)}
              >
                다시 시도
              </button>
            </>
          ) : (
            <span className={styles.canvasLoadingText}>코스 준비 중…</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className={styles.apexCanvasWrap}
      onPointerDown={handlePointerDown}
      onWheel={(e) => {
        // 데스크톱 줌 — 메뉴 쇼케이스에서만
        if (sim.state.phase !== 'ready') return
        const orbit = orbitRef.current
        orbit.dist = Math.min(10, Math.max(3.2, orbit.dist + e.deltaY * 0.004))
        orbit.lastUser = performance.now()
      }}
    >
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ fov: 60, near: 0.1, far: 520, position: [0, 3, 7] }}
        dpr={[1, 1.6]}
        shadows="soft"
        frameloop="always"
        onCreated={({ gl }) => {
          // ACES 톤매핑 — low-poly 를 시네마틱 톤으로 (실사감의 절반)
          gl.toneMappingExposure = 1.28
        }}
      >
        <Suspense fallback={null}>
          <GameScene
            sim={sim}
            assets={assets}
            quality={quality}
            inputRef={inputRef}
            orbitRef={orbitRef}
            bikeColor={bikeColor}
            onFrame={onFrame}
            onGameOver={onGameOver}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
