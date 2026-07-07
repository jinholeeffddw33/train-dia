'use client'

/**
 * APEX RUSH — 장애물/차량/램프/칩 렌더 (종류별 InstancedMesh)
 * 화면 범위 내 장애물만 매 프레임 인스턴스 매트릭스에 리라이트 (~40개 수준 = 저렴).
 * 차량/정적 장애물은 CC0 모델 팩 (Kenney) — variant 로 모델 변종 분배.
 * 팩 지오메트리는 전부 바닥 anchor(minY=0) — 도로면(smp.py)에 그대로 놓는다.
 */

import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { DynamicDrawUsage, InstancedMesh, Matrix4, Object3D } from 'three'
import { biomeAt } from '../engine/track'
import { RING_Y_HIGH, RING_Y_LOW } from '../constants'
import type { ApexSim } from '../engine/sim'
import type { Obstacle } from '../engine/types'
import type { ApexAssets } from './assets'

// 팩 변종 수와 짝 (assets.pack.*)
const CAR_VARIANTS = 5
const TRUCK_VARIANTS = 2
const BUS_VARIANTS = 2
const BARRIER_VARIANTS = 2
const ROCK_VARIANTS = 2
/** 램프 테마 버킷 (진호 V15 "코스 따라 기물도 완전 다르게") */
const RAMP_THEMES = ['wood', 'dirt', 'metal', 'neon'] as const
type RampTheme = (typeof RAMP_THEMES)[number]

const MAX = {
  // bus/truck 캡 상향(6→10, 8→10) — 안개 far-edge(237m)에서 bus 드롭되던 것 제거(값싼 보험).
  // 인스턴스 버퍼는 1회 할당이라 비용 무시 가능. 충돌은 렌더 무관이라 게임플레이엔 영향 없음.
  rock: 24, cone: 48, barrier: 24, log: 32, barrel: 16, crate: 16, trunk: 20,
  car: 12, truck: 10, bus: 10,
  ramp: 12, rampGlow: 24, chip: 96, goldChip: 16,
  puddle: 16, ring: 12,
  itemTurbo: 12, itemShield: 12, itemMagnet: 12, itemRing: 24,
  itemSuper: 6, // 🌈 슈퍼부스트 — 희귀
}

const dummy = new Object3D()
// 가시 장애물 수집 스크래치 (매 프레임 재사용 — GC 0)
const scratchVisible: Obstacle[] = []

interface ObstaclesMeshProps {
  sim: ApexSim
  assets: ApexAssets
  /** 렌더 거리 (quality fogFar) */
  drawFarRef: { current: number }
}

export function ObstaclesMesh({ sim, assets, drawFarRef }: ObstaclesMeshProps) {
  // 변종 InstancedMesh 배열 (팩 모델별)
  const carRefs = useRef<Array<InstancedMesh | null>>([])
  const truckRefs = useRef<Array<InstancedMesh | null>>([])
  const busRefs = useRef<Array<InstancedMesh | null>>([])
  const barrierRefs = useRef<Array<InstancedMesh | null>>([])
  const rockRefs = useRef<Array<InstancedMesh | null>>([])
  // 램프 테마 버킷 — [wood, dirt, metal, neon] × (몸통/액센트)
  const rampBodyRefs = useRef<Array<InstancedMesh | null>>([])
  const rampAccRefs = useRef<Array<InstancedMesh | null>>([])
  const refs = {
    cone: useRef<InstancedMesh>(null),
    log: useRef<InstancedMesh>(null),
    barrel: useRef<InstancedMesh>(null),
    crate: useRef<InstancedMesh>(null),
    trunk: useRef<InstancedMesh>(null),
    rampGlow: useRef<InstancedMesh>(null),
    chip: useRef<InstancedMesh>(null),
    goldChip: useRef<InstancedMesh>(null),
    puddleWater: useRef<InstancedMesh>(null),
    puddleOil: useRef<InstancedMesh>(null),
    ring: useRef<InstancedMesh>(null),
    itemTurbo: useRef<InstancedMesh>(null),
    itemSuper: useRef<InstancedMesh>(null),
    itemShield: useRef<InstancedMesh>(null),
    itemMagnet: useRef<InstancedMesh>(null),
    itemRing: useRef<InstancedMesh>(null),
  }

  // 인스턴스 버퍼는 동적
  useEffect(() => {
    const all = [
      ...Object.values(refs).map((r) => r.current),
      ...carRefs.current, ...truckRefs.current, ...busRefs.current,
      ...barrierRefs.current, ...rockRefs.current,
      ...rampBodyRefs.current, ...rampAccRefs.current,
    ]
    for (const mesh of all) {
      if (mesh) {
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        mesh.frustumCulled = false
      }
    }
    // refs 는 렌더마다 안정적 (useRef) — mount 1회면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((frameState) => {
    const st = sim.state
    const track = sim.track
    const near = st.s - 25
    const far = st.s + drawFarRef.current
    const time = frameState.clock.elapsedTime

    const counts: Record<keyof typeof MAX, number> = {
      rock: 0, cone: 0, barrier: 0, log: 0, barrel: 0, crate: 0, trunk: 0,
      car: 0, truck: 0, bus: 0,
      ramp: 0, rampGlow: 0, chip: 0, goldChip: 0,
      puddle: 0, ring: 0,
      itemTurbo: 0, itemShield: 0, itemMagnet: 0, itemRing: 0, itemSuper: 0,
    }
    const variantCounts = {
      car: new Array(CAR_VARIANTS).fill(0) as number[],
      truck: new Array(TRUCK_VARIANTS).fill(0) as number[],
      bus: new Array(BUS_VARIANTS).fill(0) as number[],
      barrier: new Array(BARRIER_VARIANTS).fill(0) as number[],
      rock: new Array(ROCK_VARIANTS).fill(0) as number[],
    }
    // 램프 테마 버킷 카운트 + 물웅덩이/오일 분리 카운트
    const rampCounts = new Array(RAMP_THEMES.length).fill(0) as number[]
    const puddleCounts = { water: 0, oil: 0 }

    const write = (key: keyof typeof MAX, matrix: Matrix4) => {
      const mesh = refs[key as keyof typeof refs]?.current
      if (!mesh || counts[key] >= MAX[key]) return
      mesh.setMatrixAt(counts[key]++, matrix)
    }
    const writeVariant = (
      group: Array<InstancedMesh | null>,
      keys: keyof typeof variantCounts,
      variant: number,
      matrix: Matrix4,
    ) => {
      const n = variantCounts[keys].length
      const vi = Math.min(n - 1, Math.floor(variant * n))
      const mesh = group[vi]
      const cap = MAX[keys as keyof typeof MAX]
      if (!mesh || variantCounts[keys][vi] >= cap) return
      mesh.setMatrixAt(variantCounts[keys][vi]++, matrix)
    }

    // ── 가시 장애물 수집 → 근접 우선 정렬 → 캡 적용 ──
    // ★캡 초과 시 array 순회 순서에 따라 아무 장애물이나 드롭돼, 이관(migration)으로 배열 끝에
    // 붙은 "가까운 차"가 먼 차에 밀려 투명해지는 버그(진호 "차가 가까워지니 안보여" — headless
    // 60시드 재현). |dS| 오름차순 정렬로 충돌구역 근접은 절대 안 잘리고, 캡 초과분은 안개 속 먼
    // 것만 드롭되게 보장.
    // ★★청크 단위 사전 필터 금지 (V14, 진호 1인칭 "차가 또 사라져서 처박음"): 차량은 홈 청크
    //   밖으로 이동(드리프트)하므로 청크 s0 로 거르면 "홈 청크는 뒤로 지나갔는데 차는 코앞"인
    //   개체가 렌더에서만 빠져 투명+충돌이 된다 (headless 40시드 278프레임 재현 — 전부 이 원인).
    //   개체 단위 [near, far] 필터만 사용. 청크 수 ≤8 이라 전 순회 비용은 무시 가능.
    const visible = scratchVisible
    visible.length = 0
    for (const chunk of track.allChunks()) {
      for (const ob of chunk.obstacles) {
        if (ob.gone || ob.s < near || ob.s > far) continue
        visible.push(ob)
      }
    }
    visible.sort((a, b) => Math.abs(a.s - st.s) - Math.abs(b.s - st.s))

    for (const ob of visible) {
      {
        const smp = track.sampleAt(ob.s)
        const px = smp.px + smp.rightX * ob.x
        const pz = smp.pz + smp.rightZ * ob.x
        const heading = Math.atan2(-smp.dirX, -smp.dirZ)

        dummy.rotation.set(0, heading, 0)
        dummy.scale.set(1, 1, 1)

        switch (ob.kind) {
          case 'rock': {
            const sc = 0.7 + ob.variant * 0.7
            dummy.position.set(px, smp.py, pz)
            dummy.rotation.set(0, heading + ob.variant * 6, 0)
            dummy.scale.set(sc, sc, sc)
            dummy.updateMatrix()
            // 모델 변종은 variant 소수 셋째 자리로 (크기와 독립)
            writeVariant(rockRefs.current, 'rock', (ob.variant * 100) % 1, dummy.matrix)
            break
          }
          case 'cone': {
            dummy.position.set(px, smp.py, pz)
            dummy.updateMatrix()
            write('cone', dummy.matrix)
            break
          }
          case 'barrier': {
            dummy.position.set(px, smp.py, pz)
            dummy.updateMatrix()
            writeVariant(barrierRefs.current, 'barrier', ob.variant, dummy.matrix)
            break
          }
          case 'log': {
            // 장축 x 로 베이크됨 — heading 정렬이면 도로를 가로지름
            dummy.position.set(px, smp.py, pz)
            dummy.updateMatrix()
            write('log', dummy.matrix)
            break
          }
          case 'barrel': {
            // 절차 실린더 — 중심 anchor 라 반높이만큼 올림
            dummy.position.set(px, smp.py + 0.475, pz)
            dummy.rotation.set(0, ob.variant * 6, 0)
            dummy.updateMatrix()
            write('barrel', dummy.matrix)
            break
          }
          case 'crate': {
            dummy.position.set(px, smp.py + 0.425, pz)
            dummy.rotation.set(0, heading + ob.variant * 1.2, 0)
            dummy.updateMatrix()
            write('crate', dummy.matrix)
            break
          }
          case 'trunk': {
            // 서있는 나무 기둥 — 중심 anchor 라 반높이 올림 (흙길 "나무 피하기")
            dummy.position.set(px, smp.py + 3.25, pz)
            dummy.rotation.set(0, ob.variant * 6, 0)
            dummy.updateMatrix()
            write('trunk', dummy.matrix)
            break
          }
          case 'car':
          case 'truck':
          case 'bus': {
            const oncoming = ob.vs < 0
            // 마주오는 차는 반대 방향 + 경사 피치 정렬 (긴 차체가 크레스트/급다운힐에서 뜨거나 뚫리는 것 방지)
            dummy.rotation.set(0, oncoming ? heading + Math.PI : heading, 0)
            dummy.rotateX(Math.atan(smp.grade) * (oncoming ? -1 : 1))
            dummy.position.set(px, smp.py, pz)
            dummy.updateMatrix()
            const group = ob.kind === 'car' ? carRefs.current : ob.kind === 'truck' ? truckRefs.current : busRefs.current
            writeVariant(group, ob.kind, ob.variant, dummy.matrix)
            break
          }
          case 'turbo':
          case 'shield':
          case 'magnet': {
            const bob = Math.sin(time * 2.4 + ob.s) * 0.14
            dummy.position.set(px, smp.py + 1.05 + bob, pz)
            dummy.rotation.set(
              ob.kind === 'magnet' ? Math.PI / 2 : 0.4,
              time * 2.2 + ob.variant * 6,
              0,
            )
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            write(ob.kind === 'turbo' ? 'itemTurbo' : ob.kind === 'shield' ? 'itemShield' : 'itemMagnet', dummy.matrix)
            // 발밑 글로우 링 (수평 회전)
            dummy.position.set(px, smp.py + 0.25, pz)
            dummy.rotation.set(Math.PI / 2, 0, time * 1.4)
            dummy.updateMatrix()
            write('itemRing', dummy.matrix)
            break
          }
          case 'superboost': {
            // 🌈 슈퍼부스트 — 큰 번개(그라데이션)가 살짝 기운 채 y축 스핀 + 부유. 희귀템이라 링도 2겹
            const bob = Math.sin(time * 2.4 + ob.s) * 0.18
            dummy.position.set(px, smp.py + 1.25 + bob, pz)
            dummy.rotation.set(0.32, time * 2.8 + ob.variant * 6, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            write('itemSuper', dummy.matrix)
            // 발밑 글로우 링 (수평 회전 — 희귀템 강조)
            dummy.position.set(px, smp.py + 0.25, pz)
            dummy.rotation.set(Math.PI / 2, 0, -time * 1.8)
            dummy.updateMatrix()
            write('itemRing', dummy.matrix)
            break
          }
          case 'ramp': {
            // 테마 버킷 — 산길=나무 / 자연=흙 / 도심=금속 / 사이버=네온.
            // 흙길(MTB 파크)은 혼합: 일반 티어=흙 킥커, 빅/초빅=우든 킥커 (진호 "나무 점프대 + 흙 점프대")
            const b = biomeAt(ob.s)
            const ti = b === 'dirt'
              ? (ob.variant < 0.5 ? 1 : 0)
              : b === 'mountain' ? 0 : b === 'nature' ? 1 : b === 'city' ? 2 : 3
            // 티어 스케일 (일반/빅/초빅) — 히트박스(track halfW/D)와 동일 배율 (연동 필수)
            const rsc = ob.variant < 0.5 ? 1 : ob.variant < 0.8 ? 1.35 : 1.7
            dummy.position.set(px, smp.py, pz)
            dummy.scale.set(rsc, rsc, rsc)
            dummy.updateMatrix()
            if (rampCounts[ti] < MAX.ramp) {
              const body = rampBodyRefs.current[ti]
              const acc = rampAccRefs.current[ti]
              if (body && acc) {
                body.setMatrixAt(rampCounts[ti], dummy.matrix)
                acc.setMatrixAt(rampCounts[ti], dummy.matrix)
                rampCounts[ti]++
              }
            }
            write('rampGlow', dummy.matrix)
            dummy.scale.set(1, 1, 1)
            break
          }
          case 'puddle': {
            // 납작 원판 — 도로면 살짝 위, variant 로 크기 변주. 교외=물 / 도심·사이버=오일
            const b = biomeAt(ob.s)
            const oily = b === 'city' || b === 'cyber'
            const sc = 0.75 + ob.variant * 0.5
            dummy.position.set(px, smp.py + 0.03, pz)
            dummy.rotation.set(-Math.PI / 2, 0, ob.variant * 6)
            dummy.scale.set(sc, sc * 0.8, sc)
            dummy.updateMatrix()
            const mesh = oily ? refs.puddleOil.current : refs.puddleWater.current
            const key = oily ? 'oil' as const : 'water' as const
            if (mesh && puddleCounts[key] < MAX.puddle) {
              mesh.setMatrixAt(puddleCounts[key]++, dummy.matrix)
            }
            break
          }
          case 'ring': {
            // 세로 대형 링 — 트랙 진행 방향과 직각으로 서 있음. 지상/공중은 variant
            const ringY = ob.variant < 0.5 ? RING_Y_LOW : RING_Y_HIGH
            dummy.position.set(px, smp.py + ringY, pz)
            dummy.rotation.set(0, heading, 0)
            const pulse = 1 + Math.sin(time * 3 + ob.s) * 0.04
            dummy.scale.set(pulse, pulse, pulse)
            dummy.updateMatrix()
            write('ring', dummy.matrix)
            break
          }
          case 'chip':
          case 'goldchip': {
            // 공중 칩(y 있음 — 빅점프 체공 라인)은 지정 높이, 지상 칩은 바닥 위 부유
            const cy = ob.y !== undefined
              ? smp.py + ob.y
              : smp.py + 0.85 + Math.sin(time * 2 + ob.s) * 0.12
            dummy.position.set(px, cy, pz)
            if (ob.kind === 'goldchip') {
              // 💰 동전 — 세워서(로컬 X 90°) 월드 Y축 스핀 (진짜 코인 회전)
              dummy.rotation.set(0, time * 2.6 + ob.variant * 6, 0)
              dummy.rotateX(Math.PI / 2)
            } else {
              dummy.rotation.set(0, time * 2.6 + ob.variant * 6, 0)
            }
            dummy.updateMatrix()
            write(ob.kind === 'goldchip' ? 'goldChip' : 'chip', dummy.matrix)
            break
          }
        }
      }
    }

    for (const key of Object.keys(counts) as Array<keyof typeof MAX>) {
      const mesh = refs[key as keyof typeof refs]?.current
      if (!mesh) continue
      mesh.count = counts[key]
      mesh.instanceMatrix.needsUpdate = true
    }
    const flushVariants = (group: Array<InstancedMesh | null>, cts: number[]) => {
      for (let i = 0; i < cts.length; i++) {
        const mesh = group[i]
        if (!mesh) continue
        mesh.count = cts[i]
        mesh.instanceMatrix.needsUpdate = true
      }
    }
    flushVariants(carRefs.current, variantCounts.car)
    flushVariants(truckRefs.current, variantCounts.truck)
    flushVariants(busRefs.current, variantCounts.bus)
    flushVariants(barrierRefs.current, variantCounts.barrier)
    flushVariants(rockRefs.current, variantCounts.rock)
    // 램프 테마 버킷 + 물웅덩이(물/오일) flush
    for (let i = 0; i < RAMP_THEMES.length; i++) {
      const body = rampBodyRefs.current[i]
      const acc = rampAccRefs.current[i]
      if (body) { body.count = rampCounts[i]; body.instanceMatrix.needsUpdate = true }
      if (acc) { acc.count = rampCounts[i]; acc.instanceMatrix.needsUpdate = true }
    }
    const pw = refs.puddleWater.current
    if (pw) { pw.count = puddleCounts.water; pw.instanceMatrix.needsUpdate = true }
    const po = refs.puddleOil.current
    if (po) { po.count = puddleCounts.oil; po.instanceMatrix.needsUpdate = true }
  })

  return (
    <group>
      {/* 정적 장애물 — CC0 팩 (variant 모델 분배) */}
      {assets.pack.rockOb.map((geo, i) => (
        <instancedMesh
          key={`rock${i}`}
          ref={(m) => { rockRefs.current[i] = m }}
          args={[geo, assets.mat.packObstacle, MAX.rock]}
          castShadow
        />
      ))}
      <instancedMesh ref={refs.cone} args={[assets.pack.cone, assets.mat.packObstacle, MAX.cone]} castShadow />
      {assets.pack.barrier.map((geo, i) => (
        <instancedMesh
          key={`barrier${i}`}
          ref={(m) => { barrierRefs.current[i] = m }}
          args={[geo, assets.mat.packObstacle, MAX.barrier]}
          castShadow
        />
      ))}
      <instancedMesh ref={refs.log} args={[assets.pack.log, assets.mat.packObstacle, MAX.log]} castShadow />
      {/* 장애물 다양화 (유저 피드백 ⑧) — 드럼통/나무상자/나무기둥 (절차 지오) */}
      <instancedMesh ref={refs.barrel} args={[assets.geo.barrel, assets.mat.barrel, MAX.barrel]} castShadow />
      <instancedMesh ref={refs.crate} args={[assets.geo.crate, assets.mat.crate, MAX.crate]} castShadow />
      <instancedMesh ref={refs.trunk} args={[assets.geo.trunk, assets.mat.trunk, MAX.trunk]} castShadow />

      {/* 차량 — CC0 팩 (colormap 베이크) */}
      {assets.pack.car.map((geo, i) => (
        <instancedMesh
          key={`car${i}`}
          ref={(m) => { carRefs.current[i] = m }}
          args={[geo, assets.mat.packBaked, MAX.car]}
          castShadow
        />
      ))}
      {assets.pack.truck.map((geo, i) => (
        <instancedMesh
          key={`truck${i}`}
          ref={(m) => { truckRefs.current[i] = m }}
          args={[geo, assets.mat.packBaked, MAX.truck]}
          castShadow
        />
      ))}
      {assets.pack.bus.map((geo, i) => (
        <instancedMesh
          key={`bus${i}`}
          ref={(m) => { busRefs.current[i] = m }}
          args={[geo, assets.mat.packBaked, MAX.bus]}
          castShadow
        />
      ))}

      <instancedMesh ref={refs.itemTurbo} args={[assets.geo.itemTurbo, assets.mat.itemTurbo, MAX.itemTurbo]} />
      {/* 🌈 슈퍼부스트 번개 (희귀 — 인스타 그라데이션) */}
      <instancedMesh ref={refs.itemSuper} args={[assets.geo.itemSuper, assets.mat.itemSuper, MAX.itemSuper]} />
      <instancedMesh ref={refs.itemShield} args={[assets.geo.itemShield, assets.mat.itemShield, MAX.itemShield]} />
      <instancedMesh ref={refs.itemMagnet} args={[assets.geo.itemMagnet, assets.mat.itemMagnet, MAX.itemMagnet]} />
      <instancedMesh ref={refs.itemRing} args={[assets.geo.itemRing, assets.mat.itemRing, MAX.itemRing]} />

      {/* 램프 — 테마 4버킷 (산길=나무판자/자연=흙둔덕/도심=공사금속/사이버=네온, 진호 V15) */}
      {([
        [assets.mat.rampWood, assets.mat.rampAccWood],
        [assets.mat.rampDirt, assets.mat.rampAccDirt],
        [assets.mat.rampMetal, assets.mat.rampAccMetal],
        [assets.mat.rampNeon, assets.mat.rampAccNeon],
      ] as const).map(([bodyMat, accMat], i) => (
        <group key={RAMP_THEMES[i]}>
          <instancedMesh
            ref={(m) => { rampBodyRefs.current[i] = m }}
            args={[assets.geo.ramp, bodyMat, MAX.ramp]}
            castShadow
          />
          <instancedMesh
            ref={(m) => { rampAccRefs.current[i] = m }}
            args={[assets.geo.rampStripe, accMat, MAX.ramp]}
          />
        </group>
      ))}
      {/* 램프 진행 방향 발광 셰브론 화살표 (진호: "점프대 화살표 표시") */}
      <instancedMesh ref={refs.rampGlow} args={[assets.geo.rampChevron, assets.mat.rampGlow, MAX.rampGlow]} />

      {/* 기믹 — 물웅덩이/오일 + 스피드 링 */}
      <instancedMesh ref={refs.puddleWater} args={[assets.geo.puddle, assets.mat.puddleWater, MAX.puddle]} />
      <instancedMesh ref={refs.puddleOil} args={[assets.geo.puddle, assets.mat.puddleOil, MAX.puddle]} />
      <instancedMesh ref={refs.ring} args={[assets.geo.speedRing, assets.mat.speedRing, MAX.ring]} />

      <instancedMesh ref={refs.chip} args={[assets.geo.chip, assets.mat.chip, MAX.chip]} />
      {/* 💰 골드 칩 — 고득점 (유저 피드백 ②) */}
      <instancedMesh ref={refs.goldChip} args={[assets.geo.goldChip, assets.mat.goldChip, MAX.goldChip]} />
    </group>
  )
}
