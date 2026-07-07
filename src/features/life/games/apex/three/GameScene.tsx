'use client'

/**
 * APEX RUSH — 씬 조율자
 * 매 프레임: sim.tick → 팔레트/포그/라이트/하늘 갱신 → 체이스 카메라 → onFrame 콜백.
 * 시뮬레이션이 제일 먼저 돌도록 useFrame priority -10.
 */

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color, DirectionalLight, Fog, HemisphereLight, Mesh,
  PerspectiveCamera, ShaderMaterial,
} from 'three'
import { lerpColor, paletteAt, PALETTES } from '../engine/palettes'
import { biomeAt } from '../engine/track'
import { MAX_SPEED } from '../constants'
import type { ApexSim } from '../engine/sim'
import type { BiomePalette, InputState, SimEvents, SimState } from '../engine/types'
import type { QualityGovernor } from '../engine/quality'
import type { ApexAssets } from './assets'
import { TrackMeshes } from './TrackMeshes'
import { RiderMesh } from './RiderMesh'
import { ObstaclesMesh } from './ObstaclesMesh'
import { SceneryMesh } from './SceneryMesh'
import { SkyDome, type SkyUniforms } from './SkyDome'
import { SpeedLines } from './SpeedLines'
import { SkylineRing } from './SkylineRing'
import { ParticleFX, type ParticleQueue } from './ParticleFX'
import { CockpitMesh } from './CockpitMesh'
import { ApexBikeGLB } from './ApexBikeGLB'

// 실사 GLB 자전거 통합 플래그 — true 면 절차 RiderMesh/CockpitMesh 대신 GLB.
const SHOW_GLB_BIKE = true

/** 메뉴 쇼케이스 orbit 상태 — ApexCanvas(입력)와 GameScene(카메라)이 공유 */
export interface ShowcaseOrbit {
  /** 수평 회전각 (rad) */
  yaw: number
  /** 카메라 거리 (줌) */
  dist: number
  /** 마지막 유저 조작 시각(performance.now) — 잠시 후 자동 회전 재개 */
  lastUser: number
}

interface GameSceneProps {
  sim: ApexSim
  assets: ApexAssets
  quality: QualityGovernor
  inputRef: { current: InputState }
  orbitRef: { current: ShowcaseOrbit }
  bikeColor: number
  onFrame: (state: SimState, events: SimEvents) => void
  onGameOver: () => void
}

export function GameScene({ sim, assets, quality, inputRef, orbitRef, bikeColor, onFrame, onGameOver }: GameSceneProps) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)

  const hemiRef = useRef<HemisphereLight>(null)
  const dirRef = useRef<DirectionalLight>(null)
  const fillRef = useRef<DirectionalLight>(null)
  const skyRef = useRef<Mesh>(null)

  const scratch = useMemo(() => ({
    palette: { ...PALETTES.mountain } as BiomePalette,
    fogColor: new Color(),
    shake: 0,
    reported: false,
    trailClock: 0,
    frameCount: 0,
    pose: { s: 0, x: 0, z: 0, lean: 0, speed: 0 },
    /** 에어 라이더 모션 — 점프 중 몸이 일어나는 시선 상승 (0~1 스무딩) */
    airLift: 0,
    /** 착지 순간 눌림 (1 → 감쇠) */
    landDip: 0,
    /** 🤸 현재/직전 트릭이 근접-내려다보기류(테일휩/바스핀)인지 — tc 감쇠 중에도 프리셋 유지(튐 방지) */
    trickClose: false,
    /** 🤸 현재/직전 트릭이 테일휩인지 — 프레임+뒷바퀴 스윙이 커서 카메라를 조금 더 뒤로 (뒷바퀴 노출) */
    trickTail: false,
    densityRef: { current: quality.current.propDensity },
    drawFarRef: { current: quality.current.fogFar },
  }), [quality])

  const particleQueue = useMemo<ParticleQueue>(() => ({ items: [] }), [])

  // 포그 설치 + 품질 변경 반영
  useEffect(() => {
    const fog = new Fog(0x9d8ad2, quality.current.fogNear, quality.current.fogFar)
    scene.fog = fog
    quality.onChange = (level) => {
      fog.near = level.fogNear
      fog.far = level.fogFar
      scratch.densityRef.current = level.propDensity
      scratch.drawFarRef.current = level.fogFar
      if (dirRef.current) dirRef.current.castShadow = level.shadows
      if (typeof window !== 'undefined') {
        setDpr(Math.min(window.devicePixelRatio || 1, level.maxDpr))
      }
    }
    // 초기 DPR 클램프
    if (typeof window !== 'undefined') {
      setDpr(Math.min(window.devicePixelRatio || 1, quality.current.maxDpr))
    }

    // no-shadow 셰이더 배리언트 프리워밍 — 품질 강등으로 castShadow 토글되는 순간의
    // 전체 재컴파일 스톨(저사양 수백 ms)을 메뉴 로딩 시점에 흡수 (적대 리뷰 발견)
    const dir = dirRef.current
    if (dir) {
      const prev = dir.castShadow
      dir.castShadow = false
      gl.compile(scene, camera)
      dir.castShadow = prev
      gl.compile(scene, camera)
    }

    // 그림자 맵 30Hz 갱신 — 셰도 패스는 씬 재드로우라 프레임 예산의 큰 몫.
    // 짝수 프레임에만 needsUpdate (라이더 추적 라이트라 반 프레임 지연은 비가시)
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true

    // 탭 복귀 시 측정 윈도우 리셋 (수 초짜리 delta 가 허위 강등 만드는 것 방지)
    const onVisibility = () => {
      if (!document.hidden) quality.reset()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      quality.onChange = null
      scene.fog = null
      gl.shadowMap.autoUpdate = true
    }
  }, [scene, camera, gl, quality, setDpr, scratch])

  useFrame((frameState, delta) => {
    // 1) 시뮬레이션
    sim.tick(delta, inputRef.current)
    const st = sim.state
    const events = sim.consumeEvents()

    // 2) 품질 측정 + 그림자 30Hz 갱신
    quality.sample(delta * 1000)
    scratch.frameCount++
    if ((scratch.frameCount & 1) === 0) gl.shadowMap.needsUpdate = true

    // 3) 팔레트 → 포그/라이트/하늘
    const pal = paletteAt(st.s, scratch.palette)
    const fog = scene.fog
    if (fog instanceof Fog) fog.color.setHex(pal.fog)
    const hemi = hemiRef.current
    if (hemi) {
      hemi.color.setHex(pal.ambient)
      hemi.groundColor.setHex(pal.ground)
    }
    const dir = dirRef.current
    if (dir) dir.color.setHex(pal.sun)

    // 식생 색 — 스테이지 테마 따라 lerp (설산 = 눈 덮인 소나무)
    assets.mat.pineLeaf.color.setHex(pal.leafPine)
    assets.mat.treeLeaf.color.setHex(pal.leafTree)
    assets.mat.bush.color.setHex(pal.bushCol)
    // 원경 실루엣도 테마 색으로 (설산 = 시린 청백, 해안 = 웜 헤이즈)
    assets.mat.skyline.color.setHex(lerpColor(pal.fog, pal.skyTop, 0.5))
    assets.mat.skylineFar.color.setHex(lerpColor(pal.fog, pal.skyTop, 0.25))

    const sky = skyRef.current
    if (sky) {
      const mat = sky.material as ShaderMaterial
      const u = mat.uniforms as unknown as SkyUniforms
      u.topColor.value.setHex(pal.skyTop)
      u.horizonColor.value.setHex(pal.skyHorizon)
      u.bottomColor.value.setHex(pal.skyBottom)
      u.sunColor.value.setHex(pal.sunDisc)
      const az = pal.sunAzimuth * Math.PI * 2
      const el = pal.sunElevation * Math.PI * 0.45
      u.sunDir.value = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
      u.nightness.value = pal.night
      // 하늘은 카메라를 따라다님
      sky.position.copy(camera.position)
    }

    // 4) 셰이크 이벤트
    if (events.crash) scratch.shake = 1.1
    else if (events.land) scratch.shake = Math.max(scratch.shake, 0.3)
    scratch.shake *= Math.exp(-4.5 * delta)

    // 5) 체이스 카메라 — 보간 포즈 기준 (60Hz 스텝 × 고주사율 rAF 위상 저더 제거)
    const pose = sim.getRenderPose(scratch.pose)
    const smp = sim.track.sampleAt(pose.s)
    const rx = smp.px + smp.rightX * pose.x
    const ry = smp.py + pose.z
    const rz = smp.pz + smp.rightZ * pose.x

    // 5.5) 이벤트 → 파티클 연출
    const pq = particleQueue.items
    if (events.nearMiss) {
      pq.push({
        x: rx, y: ry + 0.6, z: rz,
        color: events.nearMissInsane ? 0xffffff : 0xb6ff2a,
        count: events.nearMissInsane ? 10 : 6, speed: 4, up: 3, life: 0.5, size: 0.12,
      })
    }
    if (events.land) {
      pq.push({ x: rx, y: ry + 0.1, z: rz, color: 0x9a8f85, count: 8, speed: 2.6, up: 1.4, life: 0.6, size: 0.16 })
    }
    if (events.crash) {
      pq.push({ x: rx, y: ry + 0.7, z: rz, color: 0xd8dcea, count: 18, speed: 6.5, up: 5, life: 1.0, size: 0.18 })
    }
    if (events.chip) {
      pq.push({ x: rx, y: ry + 0.9, z: rz, color: 0xb6ff2a, count: 4, speed: 2.2, up: 2.4, life: 0.4, size: 0.1 })
    }
    if (events.item) {
      const itemColor = events.item === 'turbo' ? 0xd4ff4f : events.item === 'shield' ? 0x5fd0ff : 0xff6f9c
      pq.push({ x: rx, y: ry + 1, z: rz, color: itemColor, count: 12, speed: 3.4, up: 3.4, life: 0.6, size: 0.13 })
    }
    // 🌈 슈퍼부스트 획득 — 라벤더+핫핑크 대형 폭발 (인스타 그라데이션 매칭)
    if (events.superboost) {
      pq.push({ x: rx, y: ry + 1, z: rz, color: 0xb794f6, count: 16, speed: 5, up: 4.5, life: 0.85, size: 0.17 })
      pq.push({ x: rx, y: ry + 1, z: rz, color: 0xff5f9e, count: 12, speed: 4, up: 3.6, life: 0.7, size: 0.14 })
      scratch.shake = Math.max(scratch.shake, 0.7)
    }
    // 🌈 무적 관통 파괴 — 라이더 전방에 장애물 파편(회갈) + 핑크 스파크 (부서지는 연출)
    if (events.smash) {
      const sx = rx + smp.dirX * 1.5
      const sz = rz + smp.dirZ * 1.5
      pq.push({ x: sx, y: ry + 0.6, z: sz, color: 0xbfb0a2, count: 10, speed: 5.5, up: 3.5, life: 0.6, size: 0.17 })
      pq.push({ x: sx, y: ry + 0.8, z: sz, color: 0xff5f9e, count: 6, speed: 4.5, up: 3, life: 0.5, size: 0.12 })
      scratch.shake = Math.max(scratch.shake, 0.35)
    }
    // ◎ 링 통과 — 시안 스파크 링 터짐
    if (events.ring) {
      pq.push({ x: rx, y: ry + 1.4, z: rz, color: 0x53f0ff, count: 14, speed: 4.6, up: 2.6, life: 0.7, size: 0.14 })
    }
    // 💧 미끄럼 진입 — 물/오일 튐 (라이더 발밑)
    if (events.puddle) {
      pq.push({ x: rx, y: ry + 0.15, z: rz, color: 0x6fa8cc, count: 12, speed: 3.2, up: 2.8, life: 0.55, size: 0.13 })
    }
    if (events.shieldBreak) {
      pq.push({ x: rx, y: ry + 0.8, z: rz, color: 0x5fd0ff, count: 14, speed: 5.5, up: 4, life: 0.8, size: 0.15 })
      scratch.shake = Math.max(scratch.shake, 0.6)
    }
    if (events.fever) {
      pq.push({ x: rx, y: ry + 0.9, z: rz, color: 0xffffff, count: 14, speed: 4.5, up: 4.5, life: 0.8, size: 0.14 })
    }
    // 터보/피버/슈퍼부스트 지속 트레일 (0.06s 간격). 슈퍼부스트는 라벤더↔핫핑크 교대로 더 화려하게.
    if ((st.turboTimer > 0 || st.feverTimer > 0 || st.superTimer > 0) && st.phase === 'playing') {
      scratch.trailClock += delta
      if (scratch.trailClock > 0.06) {
        scratch.trailClock = 0
        const superOn = st.superTimer > 0
        pq.push({
          x: rx - smp.dirX * 1.2, y: ry + 0.45, z: rz - smp.dirZ * 1.2,
          color: superOn ? (Math.random() < 0.5 ? 0xb794f6 : 0xff5f9e) : st.turboTimer > 0 ? 0xd4ff4f : 0xffb84f,
          count: superOn ? 3 : 2, speed: 0.9, up: superOn ? 0.9 : 0.6, life: 0.5, size: superOn ? 0.13 : 0.11,
        })
      }
    }

    const cam = camera as PerspectiveCamera
    if (st.phase === 'ready') {
      // 시작 전 쇼케이스: 자전거 orbit — 유저 드래그(yaw)/줌(dist)은 ApexCanvas 가 orbitRef 에 기록.
      //   2.5초 무조작이면 자동 회전 재개 (진호 2026-07-07 "돌려볼 수 있으면").
      const orbit = orbitRef.current
      if (performance.now() - orbit.lastUser > 2500) orbit.yaw += delta * 0.3
      cam.up.set(0, 1, 0)
      cam.position.set(
        rx + Math.sin(orbit.yaw) * orbit.dist,
        ry + 1.0 + orbit.dist * 0.22,
        rz + Math.cos(orbit.yaw) * orbit.dist,
      )
      cam.lookAt(rx, ry + 0.85, rz)
      if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix() }
    } else if (st.phase === 'playing') {
      // ── 1인칭 라이드 (V12 — 기본 시점. 진호 "1인칭이 훨씬 재밌음, 3인칭 버려") ──
      // 렌더 포즈가 이미 60Hz↔rAF 보간을 거쳐 부드러움 → 위치는 스무딩 없이 직결
      // (지연 스무딩을 섞으면 조향과 시점이 어긋나 멀미 유발)

      // 에어 모션 — 점프 중 몸이 핸들에서 일어나며 시선 상승, 착지 순간 살짝 눌림
      // (진호 "점프할 때 몸이 올라간 것처럼 시선이 올라가고")
      scratch.airLift += ((st.airborne ? 1 : 0) - scratch.airLift) * Math.min(1, 6 * delta)
      if (events.land) scratch.landDip = 1
      scratch.landDip *= Math.exp(-5 * delta)
      const air = scratch.airLift
      // 점프 궤적 시선 — 상승(vz>0) 살짝 위(정점/하늘), 하강 아래(착지 지점). 부드럽게 정규화.
      const vzNorm = Math.max(-1, Math.min(1, st.vz / 7))

      // 진호 V17 "아직 너무 좁아, 손목까지 보이게 더 위로·더 많이" — 후퇴 0.55→0.72 +
      //   눈높이 1.66→1.74 (더 뒤·위에서 내려다봐 전방 시야 확장 + 콕핏 전체 프레임 인)
      // 헬멧캠 1인칭 — 자전거(ApexBikeGLB)는 카메라에 밀착 고정되므로, 카메라는 순수 '시점'만
      //   담당(트레일을 어디서 보나). 눈높이 1.74, 라이더 뒤 0.72 에서 전방 트레일 응시.
      // ★점프(진호 2026-07-07 "시선이 더 위에서, 자전거가 더 보여야"): 공중엔 눈높이를 크게
      //   올리고(+0.55) 살짝 뒤로(back +0.45) → 자전거를 위에서 내려다보며 더 많이 보게 된다.
      const tc = st.trickCam

      // 1인칭 헬멧캠 위치 (기본)
      const fpBack = 0.72 + air * 0.45
      let camX = rx - smp.dirX * fpBack
      let camY = smp.py + pose.z + 1.74 + air * 0.55 - scratch.landDip * 0.14
      let camZ = rz - smp.dirZ * fpBack
      // 🤸 에어트릭 — 시점(방향)은 1인칭 그대로 유지하고 카메라만 '뒤+위로 쭉 물러나' 자전거 전체가
      //   화면 하단에 들어오게 (진호 2026-07-07 "옆에서 보니 이상, 시점 유지하되 전체 보이게").
      //   ★옆(side) 이동 없음 — 진행방향 정후방에서 전방을 보는 각도라 자전거 앞바퀴~뒷바퀴가 다 보이고
      //   윕/테이블탑/백플립도 뚜렷. tc(sim 스무딩)로 1인칭↔후방 부드럽게 전환.
      if (tc > 0.001) {
        // 뒤 3.3·위 1.7 — 자전거가 다 보이는 선에서 최대한 크게 (진호 2026-07-07 "멀다, 더 잘 보이게").
        //   백플립(위로 회전)까지 프레임에 남는 최소 거리.
        // 백플립/윕/테이블탑 = 뒤 3.3·위 1.7 (프레임 전체 노출). 테일휩/바스핀 = 발밑에서 도는 걸
        //   내려다보는 기술 → 더 가까이(뒤 2.3) + 더 위(2.6)에서 굽어본다 (진호 2026-07-07). airTrick
        //   null(착지 후 tc 감쇠) 이어도 scratch.trickClose 로 마지막 프리셋 유지 → 카메라 튐 없음.
        if (st.airTrick) {
          scratch.trickClose = st.airTrick === 'tailwhip' || st.airTrick === 'barspin'
          scratch.trickTail = st.airTrick === 'tailwhip'
        }
        // 테일휩 = 프레임+뒷바퀴가 크게 스윙 → 뒷바퀴까지 프레임에 담기게 back 더(2.9, 진호 "뒷바퀴가
        //   안 보여"). 바스핀 = 앞핸들 클로즈업(2.3). 내려다보는 각(tpUp 2.6)은 둘 다 유지("시점은 좋다").
        const tpBack = scratch.trickTail ? 2.9 : scratch.trickClose ? 2.3 : 3.3
        const tpUp = scratch.trickClose ? 2.6 : 1.7
        const tpX = rx - smp.dirX * tpBack
        const tpY = smp.py + pose.z + tpUp
        const tpZ = rz - smp.dirZ * tpBack
        camX += (tpX - camX) * tc
        camY += (tpY - camY) * tc
        camZ += (tpZ - camZ) * tc
      }
      cam.position.set(camX, camY, camZ)

      if (scratch.shake > 0.01) {
        const t = frameState.clock.elapsedTime
        cam.position.x += Math.sin(t * 61) * 0.05 * scratch.shake
        cam.position.y += Math.sin(t * 53 + 1.7) * 0.04 * scratch.shake
      }
      // ★멀미 교정(진호 "너무 많이 기울어짐"): 롤은 미세하게만(0.10). 트릭(3인칭) 중엔 롤 제거(세상 수평).
      const roll = -pose.lean * 0.10 * (1 - tc)
      const sr = Math.sin(roll)
      cam.up.set(smp.rightX * sr, Math.cos(roll), smp.rightZ * sr)
      // 룩앳: 1인칭 전방 트레일(18m, 흙길 12m) ↔ 3인칭 자전거(라이더 위치). tc 블렌드.
      //   1인칭 점프 궤적: 상승 시 위(정점), 하강 시 착지 지점으로 시선이 내려가 회전감(진호 "회전, 점프").
      const aheadDist = biomeAt(pose.s) === 'dirt' ? 12 : 18
      const aheadSmp = sim.track.sampleAt(pose.s + aheadDist)
      // 시선은 전방 트레일 유지(방향 = 시점 유지). 트릭 중엔 살짝만 아래로 기울여(-tc) 뒤·위로 물러난
      //   카메라에서 자전거가 화면 하단에 프레임되게. X/Z 는 전방 그대로(자전거로 틀지 않음).
      cam.lookAt(
        aheadSmp.px + aheadSmp.rightX * pose.x * 0.7,
        aheadSmp.py + 1.3 + pose.z * 0.5 + air * 0.2 + vzNorm * 0.7 - tc * 1.0,
        aheadSmp.pz + aheadSmp.rightZ * pose.x * 0.7,
      )
      // 속도 화각 킥 — 멀미 교정으로 6→3 축소 (FP 는 자전거 축소 문제 무관)
      const speedNorm = Math.min(1, pose.speed / (MAX_SPEED * 1.4))
      // 가로 화면 몰입 보정 (진호 2026-07-07 "가로면 3인칭처럼 멀다") — vertical fov 71 은 세로 기준
      //   튜닝이라 가로(넓고 낮은 화면)에선 콕핏이 작아 멀어 보인다. aspect 가 클수록 fov 축소 →
      //   자전거를 세로 수준으로 당겨 1인칭 몰입 유지. 좌우 배경은 aspect 로 넓게 유지(탁 트임 그대로).
      const aspect = cam.aspect || 1
      const fovComp = aspect > 1 ? Math.min(1, 1.0 / Math.sqrt(aspect)) : 1
      const targetFov = (71 + speedNorm * 3 + (st.turboTimer > 0 ? 2 : 0)) * fovComp
      if (Math.abs(cam.fov - targetFov) > 0.05) {
        cam.fov += (targetFov - cam.fov) * Math.min(1, 5 * delta)
        cam.updateProjectionMatrix()
      }
    } else {
      // 크래시/사망 — 체이스 캠으로 물러나 자전거 고꾸라지는 연출을 보여줌
      cam.up.set(0, 1, 0)
      // 카메라: 라이더 뒤 4.8m + 위 2.7m (고정). ★진호 "자전거가 굳이 멀어질 필요 있나,
      //   안 보이기만 하고 불편" → 속도 비례 뒤당김/화각 킥 전면 제거. 자전거 크기를 속도와
      //   무관하게 일정하게 유지 (속도감보다 시인성·조작감 우선).
      const camLag = 0.6
      const back = 4.8
      const camX = smp.px + smp.rightX * pose.x * camLag - smp.dirX * back
      const camZ = smp.pz + smp.rightZ * pose.x * camLag - smp.dirZ * back
      // 시점 살짝 상향(2.2→2.7) — 진호 "살짝만 더 위에서". 큰 라이더(1.55)에 가려지던
      // 근접 전방 차량/장애물이 위에서 내려다보며 드러남 (occlusion 완화)
      const camY = smp.py + 2.7 - smp.grade * 3.2
      const k = 1 - Math.exp(-10 * delta)
      cam.position.x += (camX - cam.position.x) * k
      cam.position.y += (camY - cam.position.y) * k
      cam.position.z += (camZ - cam.position.z) * k

      // 셰이크 (감쇠 사인 노이즈)
      if (scratch.shake > 0.01) {
        const t = frameState.clock.elapsedTime
        cam.position.x += Math.sin(t * 61) * 0.09 * scratch.shake
        cam.position.y += Math.sin(t * 53 + 1.7) * 0.07 * scratch.shake
      }

      // 룩앳: 라이더 앞 6.5m 트랙 (라이더가 화면 하단 1/3 에 크게). 타깃 높이 1.0→0.85 로
      // 낮춰 시선을 도로 쪽으로 — 상향된 카메라와 합쳐 전방 장애물이 더 잘 보임
      const aheadSmp = sim.track.sampleAt(pose.s + 6.5)
      cam.lookAt(
        aheadSmp.px + aheadSmp.rightX * pose.x * 0.55,
        aheadSmp.py + 0.85 + pose.z * 0.5,
        aheadSmp.pz + aheadSmp.rightZ * pose.x * 0.55,
      )

      // FOV 고정 60 — 속도 비례 킥 제거(자전거 작아지는 주범). 터보 순간만 아주 작은 펄스(+2)
      const targetFov = 60 + (st.turboTimer > 0 ? 2 : 0)
      if (Math.abs(cam.fov - targetFov) > 0.05) {
        cam.fov += (targetFov - cam.fov) * Math.min(1, 5 * delta)
        cam.updateProjectionMatrix()
      }
    }

    // 6) 디렉셔널 라이트가 라이더 근처를 비추도록 + 후방 필 라이트 (라이더 뒷면 실루엣 방지)
    if (dir) {
      dir.position.set(rx + 30, ry + 60, rz + 20)
      dir.target.position.set(rx, ry, rz)
      dir.target.updateMatrixWorld()
    }
    const fill = fillRef.current
    if (fill) {
      fill.color.setHex(pal.ambient)
      fill.position.set(rx - smp.dirX * 12, ry + 9, rz - smp.dirZ * 12)
      fill.target.position.set(rx, ry + 0.8, rz)
      fill.target.updateMatrixWorld()
    }

    // 7) HUD/게임오버 콜백 — 새 런(playing) 진입 시 reported 재무장
    // (리셋 없으면 재시작 후 두 번째 죽음에서 게임오버 화면이 영영 안 뜸 — 적대 리뷰 P0)
    if (st.phase === 'playing' && scratch.reported) scratch.reported = false
    onFrame(st, events)
    if (st.phase === 'dead' && !scratch.reported) {
      scratch.reported = true
      onGameOver()
    }
  }, -10)

  return (
    <>
      <hemisphereLight ref={hemiRef} intensity={1.45} />
      {/* 후방 필 — 체이스캠에서 보이는 라이더 뒷면 조명 (그림자 없음) */}
      <directionalLight ref={fillRef} intensity={0.55} />
      <directionalLight
        ref={dirRef}
        intensity={1.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={20}
        shadow-camera-far={160}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-bias={-0.0004}
      />
      <SkyDome ref={skyRef} />
      <SkylineRing sim={sim} assets={assets} />
      <TrackMeshes sim={sim} assets={assets} />
      <SceneryMesh sim={sim} assets={assets} densityRef={scratch.densityRef} drawFarRef={scratch.drawFarRef} />
      <ObstaclesMesh sim={sim} assets={assets} drawFarRef={scratch.drawFarRef} />
      {!SHOW_GLB_BIKE && <RiderMesh sim={sim} assets={assets} bikeColor={bikeColor} />}
      {!SHOW_GLB_BIKE && <CockpitMesh sim={sim} bikeColor={bikeColor} />}
      {/* 자전거만 개별 Suspense — GLB 로딩이 트랙/하늘/식생까지 통째로 blank 시키지 않게
          (진호 2026-07-07 "시작 전 배경이 막 깨지고"). preload 게이트로 실제론 즉시 resolve. */}
      {SHOW_GLB_BIKE && (
        <Suspense fallback={null}>
          <ApexBikeGLB sim={sim} bikeColor={bikeColor} />
        </Suspense>
      )}
      <ParticleFX queue={particleQueue} />
      <SpeedLines sim={sim} />
    </>
  )
}
