'use client'

/**
 * APEX RUSH — 게임 코어 (호스트 독립). 상태머신: menu → playing → gameover.
 * three Canvas 는 dynamic import (ssr:false, 게임 진입 시에만 번들 로드).
 * 수치 HUD 는 ref 로 DOM 직접 갱신, 이벤트성 UI 만 setState.
 *
 * ★ 이 파일에는 프로젝트 전용 import(@/app/... 등)가 하나도 없어야 한다(sync 대상). 인증·랭킹 DB·
 *   오버레이 백스택·햅틱·로깅은 host(ApexHost)로 주입받는다. zinosb-marketplace 와 train-dia 가
 *   이 코어 한 벌을 공유한다 — 프로젝트별 결합은 각자의 래퍼(zinosb=ApexGameContent)가 host 로 구성.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Orbitron } from 'next/font/google'
import { ApexSim } from './engine/sim'
import { biomeAt } from './engine/track'
import { getRunSeed } from './engine/rng'
import { apexSfx } from './engine/sfx'
import { apexBgm } from './engine/bgm'
import {
  TURBO_DURATION, SHIELD_DURATION, MAGNET_DURATION, FEVER_DURATION, TRICK_SCORE,
  SUPERBOOST_DURATION,
} from './constants'
import type { SimEvents, SimState, TrickKind } from './engine/types'
import { useApexProgress } from './hooks/useApexProgress'
import { ApexHUD, type FloatMsg, type ItemHudState } from './components/ApexHUD'
import { ApexMenu } from './components/ApexMenu'
import { ApexGameOver, type RunResult, type SubmitStatus } from './components/ApexGameOver'
import type { ApexHost } from './host'
// 자립 전역 CSS — zinosb 디자인 토큰(--z-*)/3D 유틸(z-3d-*)/noselect 를 게임 안에 번들.
//   게임 코어가 프로젝트 전역 CSS 에 의존하지 않게 해 zinosb·train-dia 에서 UI 100% 동일 (진호 2026-07-08).
import './styles/apex-globals.css'
import styles from './styles/apex.module.css'

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700', '900'], display: 'swap' })

/** 🤸 에어트릭 한글 라벨 (착지 플로팅) */
const TRICK_LABEL: Record<TrickKind, string> = { backflip: '백플립', whip: '윕', tabletop: '테이블탑', tailwhip: '테일휩', barspin: '바스핀' }

const ApexCanvas = dynamic(() => import('./three/ApexCanvas'), {
  ssr: false,
  loading: () => (
    <div className={styles.canvasLoading}>
      <span className={styles.canvasLoadingText}>코스 준비 중…</span>
    </div>
  ),
})

type UiPhase = 'menu' | 'playing' | 'gameover'

export default function ApexGame({ host, onExit }: { host: ApexHost; onExit?: () => void }) {
  const { progress, recordRun, selectColor, selectedColorDef } = useApexProgress()

  const [runId, setRunId] = useState(0)
  // 매 판 새 랜덤 시드 = 매 판 새로운 코스 (진호 V15 "코스가 계속 랜덤으로 바뀌었으면")
  const [seed, setSeed] = useState(() => getRunSeed())
  const sim = useMemo(() => {
    void runId
    return new ApexSim(seed)
  }, [seed, runId])

  const [uiPhase, setUiPhase] = useState<UiPhase>('menu')
  const [stage, setStage] = useState(1)
  const [combo, setCombo] = useState(0)
  const [boosting, setBoosting] = useState(false)
  const [items, setItems] = useState<ItemHudState>({ turbo: 0, magnet: 0, shield: 0, fever: 0, super: 0 })
  const [floats, setFloats] = useState<FloatMsg[]>([])
  const [muted, setMuted] = useState(apexBgm.muted)
  const [result, setResult] = useState<RunResult | null>(null)
  const [prevBest, setPrevBest] = useState(0)
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [serverRank, setServerRank] = useState<number | null>(null)

  const scoreRef = useRef<HTMLSpanElement>(null)
  const distRef = useRef<HTMLSpanElement>(null)
  const speedRef = useRef<HTMLSpanElement>(null)
  const hudThrottleRef = useRef(0)
  /** setState 류(리렌더 유발)는 더 성긴 스로틀 — 게이지는 CSS transition 이 보간 */
  const stateThrottleRef = useRef(0)
  const floatIdRef = useRef(0)
  const sessionTokenRef = useRef<string | null>(null)
  const pendingStartRef = useRef(false)
  /** 급조향 스워시 사운드 스로틀 + 급강하 다이브 1회 검출 */
  const lastSwishRef = useRef(0)
  const prevGradeRef = useRef(0)
  /** 🌈 슈퍼부스트 관통 파괴음 스로틀 (관통마다 = 스팸 방지) */
  const lastSmashRef = useRef(0)

  // 재시작: 새 sim 이 만들어진 뒤 즉시 주행 시작
  useEffect(() => {
    if (pendingStartRef.current) {
      pendingStartRef.current = false
      sim.start()
    }
  }, [sim])

  // 언마운트 시 사운드 정리
  useEffect(() => {
    return () => { apexSfx.dispose(); apexBgm.dispose() }
  }, [])

  const pushFloat = useCallback((text: string, tone: FloatMsg['tone']) => {
    const id = ++floatIdRef.current
    setFloats((prev) => [...prev.slice(-3), { id, text, tone }])
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id))
    }, 1300)
  }, [])

  const BIOME_LABEL: Record<string, string> = useMemo(() => ({
    mountain: '새벽 산길', nature: '한낮 초원', city: '노을 도심', cyber: '네온 시티', dirt: '숲속 흙길',
  }), [])

  const fetchSession = useCallback(() => {
    // 세션 개념 없는 호스트(train-dia)는 requestSession 미구현 → 토큰 없이 진행
    if (!host.isAuthenticated || !host.requestSession) return
    host.requestSession()
      .then((token) => { sessionTokenRef.current = token })
      .catch(() => { sessionTokenRef.current = null })
  }, [host])

  const handleStart = useCallback(() => {
    apexSfx.ensure()
    apexSfx.go()
    apexSfx.startWind()
    apexBgm.play()
    fetchSession()
    sim.start()
    setUiPhase('playing')
    setCombo(0)
    setStage(1)
  }, [sim, fetchSession])

  const handleRetry = useCallback(() => {
    apexSfx.ensure()
    apexSfx.go()
    apexSfx.startWind()
    apexBgm.play()
    fetchSession()
    pendingStartRef.current = true
    setSeed(getRunSeed()) // 다시 달려도 새 코스
    setRunId((r) => r + 1)
    setUiPhase('playing')
    setCombo(0)
    setStage(1)
    setResult(null)
    setSubmitStatus('idle')
    setServerRank(null)
  }, [fetchSession])

  const handleExitToMenu = useCallback(() => {
    apexSfx.stopWind()
    apexBgm.stop()
    setSeed(getRunSeed())
    setRunId((r) => r + 1)
    setUiPhase('menu')
    setCombo(0)
    setResult(null)
    setSubmitStatus('idle')
    setServerRank(null)
  }, [])

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      // 음소거 = 노래(BGM)만 끈다. 효과음(SFX)은 항상 재생 (진호 2026-07-06).
      apexBgm.setMuted(!prev)
      return !prev
    })
  }, [])

  // 안드로이드 하드웨어/제스처 백 = 화면 상단 뒤로가기/X 와 동일 계층 통일 (유저 제보 2026-07-06:
  // "핸폰 뒤로가기가 안 먹고 상단 X 만 눌러야"). 게임은 라우트 이동 없는 순수 오버레이라 host.registerBack
  // (zinosb=overlay-back-stack)에 등록해야 시스템 백이 소비한다. onExit 있는 임베디드(프리시즌 프리뷰)만
  // 등록 — 라우트 페이지(onExit 없음)는 기존 라우트 백에 위임. 세션 백스택 없는 호스트는 registerBack 미구현.
  useEffect(() => {
    if (!onExit || !host.registerBack) return
    // 플레이/게임오버 → 메뉴로, 메뉴 → 대기 화면 복귀 (상단 뒤로/X 와 동일)
    return host.registerBack(() => {
      if (uiPhase === 'menu') onExit()
      else handleExitToMenu()
    })
  }, [host, onExit, uiPhase, handleExitToMenu])

  // 매 프레임 콜백 — 수치는 DOM 직접, 이벤트만 state
  const handleFrame = useCallback((st: SimState, events: SimEvents) => {
    const now = performance.now()
    const grade = sim.track.sampleAt(st.s).grade
    if (now - hudThrottleRef.current > 50) {
      hudThrottleRef.current = now
      // 숫자는 ref DOM 직접 — 리렌더 0
      if (scoreRef.current) scoreRef.current.textContent = st.score.toLocaleString()
      if (distRef.current) distRef.current.textContent = String(Math.floor(st.distance))
      if (speedRef.current) speedRef.current.textContent = String(Math.round(st.speed * 3.6))
      // 바람 세기 = 속도 + 내리막 경사 비례 (급강하 = 바람 러시, 진호 "내리막 효과음")
      apexSfx.setWindLevel(
        st.phase === 'playing'
          ? Math.min(1, st.speed / 45 + Math.max(0, -grade - 0.06) * 2.4)
          : 0,
      )
    }
    // 급강하 진입 순간 1회 다이브 러시
    if (st.phase === 'playing' && grade < -0.115 && prevGradeRef.current >= -0.115) {
      apexSfx.dive()
    }
    prevGradeRef.current = grade
    // 급조향 회피 — 휙휙 스워시 (측면 속도 임계 + 스로틀)
    if (st.phase === 'playing' && Math.abs(st.vx) > 6.5 && now - lastSwishRef.current > 380) {
      lastSwishRef.current = now
      apexSfx.swish(Math.abs(st.vx) / 12)
    }
    if (now - stateThrottleRef.current > 140) {
      stateThrottleRef.current = now
      // 부스트/아이템 표시 동기화 — 리렌더 빈도 절감 (게이지는 CSS transition 이 사이를 보간)
      setBoosting((prev) => (st.boostTimer > 0) !== prev ? st.boostTimer > 0 : prev)
      setCombo((prev) => (st.combo !== prev ? st.combo : prev))
      setItems((prev) => {
        const next: ItemHudState = {
          turbo: st.turboTimer > 0 ? st.turboTimer / TURBO_DURATION : 0,
          magnet: st.magnetTimer > 0 ? st.magnetTimer / MAGNET_DURATION : 0,
          shield: st.shield ? st.shieldTimer / SHIELD_DURATION : 0,
          fever: st.feverTimer > 0 ? st.feverTimer / FEVER_DURATION : 0,
          super: st.superTimer > 0 ? st.superTimer / SUPERBOOST_DURATION : 0,
        }
        // 정확 비교 — epsilon 을 쓰면 샘플당 감쇠(<0.02)가 영영 커밋되지 않아
        // 게이지가 멈추고 만료된 배너가 잔류한다 (적대 리뷰 발견)
        if (
          prev.shield === next.shield
          && prev.turbo === next.turbo
          && prev.magnet === next.magnet
          && prev.fever === next.fever
          && prev.super === next.super
        ) return prev
        return next
      })
    }

    if (events.nearMiss) {
      apexSfx.nearMiss(events.nearMissCombo)
      host.haptic()
      pushFloat(
        events.nearMissInsane ? `INSANE! ×${events.nearMissCombo}` : `NEAR MISS ×${events.nearMissCombo}`,
        events.nearMissInsane ? 'white' : 'lime',
      )
      setCombo(events.nearMissCombo)
    }
    // 점수 없는 텍스트는 표시 안 함 (진호 2026-07-07 "퍼펙트 랜딩 같은 의미없는 텍스트 빼")
    //   — 퍼펙트랜딩/피버/아이템명은 사운드·게이지·배너가 이미 알림. 플로팅은 점수만.
    if (events.perfectLand) {
      apexSfx.perfect()
    }
    if (events.fever) {
      apexSfx.fever()
    }
    if (events.item) {
      apexSfx.item()
      host.haptic()
    }
    // 🌈 슈퍼부스트 획득 — 강렬 사운드 + 라벤더/핑크 플로팅 + 햅틱 (진호 2026-07-07)
    if (events.superboost) {
      apexSfx.fever()
      host.haptic()
      pushFloat('🌈 슈퍼부스트!', 'super')
    }
    // 🌈 무적 관통 파괴 — 부수는 소리 (스로틀 140ms 로 스팸 방지). 모션은 GameScene 파티클.
    if (events.smash && now - lastSmashRef.current > 140) {
      lastSmashRef.current = now
      apexSfx.shieldBreak()
    }
    if (events.whip) {
      apexSfx.swish(0.9)
      pushFloat('WHIP +150', 'sky')
    }
    if (events.shieldBreak) {
      apexSfx.shieldBreak()
      pushFloat('실드 방어!', 'sky')
    }
    if (events.milestone > 0) {
      apexSfx.milestone()
      pushFloat(`${events.milestone.toLocaleString()}m ✦`, 'gold')
    }
    if (events.stageUp > 0 && st.phase === 'playing') {
      apexSfx.fever()
      setStage(events.stageUp)
      pushFloat(`STAGE ${events.stageUp} · ${BIOME_LABEL[biomeAt(st.s)] ?? '새 구간'} +800`, 'gold')
    }
    if (events.ring) {
      apexSfx.ring()
      host.haptic()
      pushFloat('RING +150', 'sky')
    }
    if (events.puddle) {
      apexSfx.splash()
      pushFloat('미끌', 'amber')
    }
    if (events.chip) {
      apexSfx.chip()
      // 코인 = 점수라는 걸 보이게 (유저 피드백 "코인 먹어도 점수 느는지 모르겠다")
      if (events.chipScore > 0) pushFloat(`+${events.chipScore}`, 'lime')
      // 💰 골드 코인 — 대형 골드 팝업 (진호 "훨씬 잘 보이는 크기랑 컬러")
      if (events.goldScore > 0) {
        apexSfx.item()
        pushFloat(`💰 +${events.goldScore.toLocaleString()}`, 'goldBig')
      }
    }
    if (events.jump) apexSfx.jump()
    if (events.crest) apexSfx.crest()
    // 🤸 에어트릭 — 이륙 시 휘익, 완주 착지 시 좌측 플로팅 점수 (진호 2026-07-07)
    if (events.trick) apexSfx.swish(0.85)
    if (events.trickLanded) {
      apexSfx.swish(1)
      host.haptic()
      pushFloat(`${TRICK_LABEL[events.trickLanded]} +${TRICK_SCORE}`, 'sky')
    }
    if (events.land) {
      apexSfx.land()
      if (events.landAirScore >= 30 && !events.perfectLand) pushFloat(`AIR +${events.landAirScore}`, 'sky')
    }
    if (events.crash) {
      apexSfx.crash()
      host.haptic()
      apexSfx.setWindLevel(0)
    }
  }, [pushFloat, BIOME_LABEL, sim, host])

  const handleGameOver = useCallback(() => {
    const st = sim.state
    const runResult: RunResult = {
      score: st.score,
      distance: st.distance,
      maxSpeedKmh: st.maxSpeed * 3.6,
      nearMisses: st.nearMisses,
      maxCombo: st.maxCombo,
      airScore: st.airScore,
      chips: st.chips,
      deathReason: st.deathReason,
      stage: st.stage,
    }
    setPrevBest(progress.bestScore)
    recordRun(st.score, st.distance)
    setResult(runResult)
    setUiPhase('gameover')

    // 서버 제출 — 미로그인은 게스트 안내. 세션 토큰 유무/검증은 host.submitScore 가 처리
    //   (zinosb=세션 필수, train-dia=단순 제출). 실패 throw 시 'error' 로 안내.
    if (!host.isAuthenticated) {
      setSubmitStatus('guest')
      return
    }
    setSubmitStatus('submitting')
    host.submitScore({
      score: st.score,
      distance: Math.floor(st.distance),
      maxSpeedKmh: st.maxSpeed * 3.6,
      airScore: st.airScore,
      seed,
      deathReason: st.deathReason || undefined,
      stage: st.stage,
      maxCombo: st.maxCombo,
      nearMisses: st.nearMisses,
      chips: st.chips,
    }, sessionTokenRef.current)
      .then((res) => {
        setSubmitStatus('success')
        setServerRank(res.rank)
      })
      .catch((err) => {
        setSubmitStatus('error')
        host.logError(err, { source: 'apexSubmitScore' })
      })
  }, [sim, seed, host, progress.bestScore, recordRun])

  return (
    // z-noselect: iOS 롱프레스로 "터보!" 등 플로트 문구가 복사되려는 오류 차단 (진호 2026-07-05)
    <div className={`${styles.container} z-noselect`}>
      <ApexCanvas
        sim={sim}
        bikeColor={selectedColorDef.hex}
        onFrame={handleFrame}
        onGameOver={handleGameOver}
      />

      {uiPhase === 'playing' && (
        <div className={orbitron.className}>
          <ApexHUD
            scoreRef={scoreRef}
            distRef={distRef}
            speedRef={speedRef}
            stage={stage}
            combo={combo}
            boosting={boosting}
            items={items}
            floats={floats}
            onExit={handleExitToMenu}
            muted={muted}
            onToggleMute={handleToggleMute}
          />
        </div>
      )}

      {uiPhase === 'menu' && (
        <div className={orbitron.className}>
          <ApexMenu
            progress={progress}
            selectedColor={selectedColorDef}
            onSelectColor={selectColor}
            onStart={handleStart}
            muted={muted}
            onToggleMute={handleToggleMute}
            isAuthenticated={host.isAuthenticated}
            renderLeaderboard={host.renderLeaderboard}
            onExit={onExit}
          />
        </div>
      )}

      {uiPhase === 'gameover' && result && (
        <div className={orbitron.className}>
          <ApexGameOver
            result={result}
            prevBest={prevBest}
            submitStatus={submitStatus}
            serverRank={serverRank}
            onRetry={handleRetry}
            onMenu={handleExitToMenu}
            renderLeaderboard={host.renderLeaderboard}
            embedded={!!onExit}
          />
        </div>
      )}
    </div>
  )
}
