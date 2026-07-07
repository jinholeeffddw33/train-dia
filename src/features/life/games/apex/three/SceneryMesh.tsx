'use client'

/**
 * APEX RUSH — 소품 렌더 (나무/바위/덤불/빌딩/가로등, 종류별 InstancedMesh)
 * 소품은 정적 — 청크 add/remove 시에만 dirty 플래그 → 다음 프레임에 리라이트.
 * 품질 propDensity 로 밀도 조절 (variant 값 기반 결정적 스킵).
 */

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DynamicDrawUsage, InstancedMesh, Object3D } from 'three'
import type { ApexSim } from '../engine/sim'
import type { ApexAssets } from './assets'

const MAX = {
  pineTrunk: 224, pineLeaf: 224,
  treeTrunk: 96, treeLeaf: 96,
  palmTrunk: 128, palmLeaf: 128,
  bush: 96, rockProp: 96,
  gate: 3,
  lampPole: 64, lampHead: 64,
  tunnel: 3, tunnelLight: 24, tunnelRing: 6,
  guardPost: 96, guardRail: 96,
  neonSign: 48,
}

// 빌딩 팩 변종별 상한 (assets.pack.building 과 짝)
const MAX_BUILDING = 24
const BUILDING_VARIANTS = 4

const NEON_COLORS = [0x51e8ff, 0xff5fd0, 0xb6ff2a, 0xffc46b, 0x9d8cff]

const dummy = new Object3D()
const scratchColor = new Color()

interface SceneryMeshProps {
  sim: ApexSim
  assets: ApexAssets
  /** 품질 밀도 (0~1) — 참조로 넘겨 매 프레임 조회 */
  densityRef: { current: number }
  /** 렌더 거리 (quality fogFar) — 안개 밖 소품은 인스턴스에서 제외 */
  drawFarRef: { current: number }
}

export function SceneryMesh({ sim, assets, densityRef, drawFarRef }: SceneryMeshProps) {
  const buildingRefs = useRef<Array<InstancedMesh | null>>([])
  const buildingGlowRefs = useRef<Array<InstancedMesh | null>>([])
  const refs = {
    pineTrunk: useRef<InstancedMesh>(null),
    pineLeaf: useRef<InstancedMesh>(null),
    treeTrunk: useRef<InstancedMesh>(null),
    treeLeaf: useRef<InstancedMesh>(null),
    palmTrunk: useRef<InstancedMesh>(null),
    palmLeaf: useRef<InstancedMesh>(null),
    bush: useRef<InstancedMesh>(null),
    rockProp: useRef<InstancedMesh>(null),
    gate: useRef<InstancedMesh>(null),
    lampPole: useRef<InstancedMesh>(null),
    lampHead: useRef<InstancedMesh>(null),
    tunnel: useRef<InstancedMesh>(null),
    tunnelLight: useRef<InstancedMesh>(null),
    tunnelRing: useRef<InstancedMesh>(null),
    guardPost: useRef<InstancedMesh>(null),
    guardRail: useRef<InstancedMesh>(null),
    neonSign: useRef<InstancedMesh>(null),
  }

  const dirtyRef = useRef(true)
  const lastDensityRef = useRef(-1)

  useEffect(() => {
    for (const mesh of [
      ...Object.values(refs).map((r) => r.current),
      ...buildingRefs.current,
      ...buildingGlowRefs.current,
    ]) {
      if (mesh) {
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        mesh.frustumCulled = false
      }
    }
    const markDirty = () => { dirtyRef.current = true }
    const unsubscribe = sim.track.subscribeChunks(markDirty, markDirty)
    return unsubscribe
    // refs 는 useRef 라 안정적
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim])

  useFrame(() => {
    const density = densityRef.current
    if (!dirtyRef.current && density === lastDensityRef.current) return
    dirtyRef.current = false
    lastDensityRef.current = density

    const track = sim.track
    const counts: Record<keyof typeof MAX, number> = {
      pineTrunk: 0, pineLeaf: 0, treeTrunk: 0, treeLeaf: 0,
      palmTrunk: 0, palmLeaf: 0,
      bush: 0, rockProp: 0, gate: 0, lampPole: 0, lampHead: 0,
      tunnel: 0, tunnelLight: 0, tunnelRing: 0, guardPost: 0, guardRail: 0, neonSign: 0,
    }
    const buildingCounts = new Array(BUILDING_VARIANTS).fill(0) as number[]

    const write = (key: keyof typeof MAX) => {
      const mesh = refs[key].current
      if (!mesh || counts[key] >= MAX[key]) return
      mesh.setMatrixAt(counts[key]++, dummy.matrix)
    }

    // 거리 컬링 창 — dirty 는 청크 이벤트(60m)마다라 마진 90m 이면 다음 리라이트까지 안전
    const riderS = sim.state.s
    const cullMin = riderS - 70
    const cullMax = riderS + drawFarRef.current + 90

    for (const chunk of track.allChunks()) {
      for (const prop of chunk.props) {
        // 안개 밖 소품 제외 (셰도/버텍스 부하 절감)
        if (prop.s < cullMin || prop.s > cullMax) continue
        // 밀도 스킵 (variant 기반 — 결정적). 터널/게이트/빌딩/가로등은 절대 스킵 금지.
        // ★빌딩은 크고 눈에 띄어 밀도 플립 시 "지형 바뀜"으로 가장 튐 → 항상 렌더 (진호 실폰 제보)
        if (
          prop.variant > density
          && prop.kind !== 'lamp' && prop.kind !== 'tunnel'
          && prop.kind !== 'gate' && prop.kind !== 'building'
        ) continue
        const smp = track.sampleAt(prop.s)
        const px = smp.px + smp.rightX * prop.x
        const pz = smp.pz + smp.rightZ * prop.x
        const groundY = smp.py - 0.2
        const sc = prop.scale

        switch (prop.kind) {
          // 팩 모델은 전부 바닥 anchor(minY=0) — groundY 에 그대로 심는다
          case 'pine': {
            dummy.position.set(px, groundY, pz)
            dummy.rotation.set(0, prop.rotY, 0)
            dummy.scale.set(sc, sc, sc)
            dummy.updateMatrix()
            write('pineTrunk')
            write('pineLeaf')
            break
          }
          case 'tree': {
            dummy.position.set(px, groundY, pz)
            dummy.rotation.set(0, prop.rotY, 0)
            dummy.scale.set(sc, sc * (0.85 + prop.variant * 0.3), sc)
            dummy.updateMatrix()
            write('treeTrunk')
            write('treeLeaf')
            break
          }
          case 'palm': {
            dummy.position.set(px, groundY, pz)
            dummy.rotation.set(0, prop.rotY, 0)
            dummy.scale.set(sc, sc, sc)
            dummy.updateMatrix()
            write('palmTrunk')
            write('palmLeaf')
            break
          }
          case 'bush': {
            dummy.position.set(px, groundY, pz)
            dummy.rotation.set(0, prop.rotY, 0)
            dummy.scale.set(sc, sc * 0.8, sc)
            dummy.updateMatrix()
            write('bush')
            break
          }
          case 'gate': {
            // 스테이지 경계 게이트 아치 — 도로 방향 정렬, 정중앙
            const heading = Math.atan2(-smp.dirX, -smp.dirZ)
            dummy.position.set(smp.px, smp.py - 0.05, smp.pz)
            dummy.rotation.set(0, heading, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            write('gate')
            break
          }
          case 'rock': {
            dummy.position.set(px, groundY, pz)
            dummy.rotation.set(0, prop.rotY + prop.variant * 6, 0)
            dummy.scale.set(sc, sc * 0.85, sc)
            dummy.updateMatrix()
            write('rockProp')
            break
          }
          case 'building': {
            // 변종: 저층 상가 2 + 스카이스크레이퍼 2 — 타워는 스케일 감쇠 (과대 방지)
            const vi = Math.min(BUILDING_VARIANTS - 1, Math.floor(prop.variant * BUILDING_VARIANTS))
            const scAdj = vi >= 2 ? 0.85 + (sc - 0.8) * 0.35 : sc
            dummy.position.set(px, groundY - 0.5, pz)
            dummy.rotation.set(0, prop.rotY * 0.06, 0)
            dummy.scale.set(scAdj, scAdj, scAdj)
            dummy.updateMatrix()
            const mesh = buildingRefs.current[vi]
            if (mesh && buildingCounts[vi] < MAX_BUILDING) {
              const gi = buildingCounts[vi]++
              mesh.setMatrixAt(gi, dummy.matrix)
              // 유리창 발광 파트 — 같은 변환
              const glow = buildingGlowRefs.current[vi]
              if (glow) glow.setMatrixAt(gi, dummy.matrix)
            }
            break
          }
          case 'lamp': {
            dummy.position.set(px, groundY + 2.3, pz)
            dummy.rotation.set(0, 0, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            write('lampPole')
            dummy.position.set(px, groundY + 4.6, pz)
            dummy.updateMatrix()
            write('lampHead')
            break
          }
          case 'tunnel': {
            // 바이옴 경계 터널 — 도로 방향 정렬, 반쯤 묻힌 실린더 아치
            const heading = Math.atan2(-smp.dirX, -smp.dirZ)
            dummy.position.set(smp.px, smp.py + 1.6, smp.pz)
            // 실린더 축(y)을 진행 방향으로: heading 적용 후 로컬 x축 90도
            dummy.rotation.set(0, heading, 0)
            dummy.rotateX(Math.PI / 2)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            write('tunnel')
            // 천장 조명 라인 (6개, 진행 방향 따라)
            for (let i = -2.5; i <= 2.5; i += 1) {
              const ls = prop.s + i * 7
              const lsmp = track.sampleAt(ls)
              dummy.position.set(lsmp.px, lsmp.py + 5.6, lsmp.pz)
              dummy.rotation.set(0, Math.atan2(-lsmp.dirX, -lsmp.dirZ), 0)
              dummy.scale.set(1, 1, 1)
              dummy.updateMatrix()
              write('tunnelLight')
            }
            // 입구/출구 발광 링 — 어스름에서 "검은 벽"으로 보이는 문제 해소 (진호 피드백)
            for (const off of [-22, 22]) {
              const rsmp = track.sampleAt(prop.s + off)
              dummy.position.set(rsmp.px, rsmp.py + 1.6, rsmp.pz)
              dummy.rotation.set(0, Math.atan2(-rsmp.dirX, -rsmp.dirZ), 0)
              dummy.scale.set(1, 1, 1)
              dummy.updateMatrix()
              write('tunnelRing')
            }
            break
          }
          case 'guardrail': {
            const heading = Math.atan2(-smp.dirX, -smp.dirZ)
            dummy.position.set(px, smp.py + 0.35, pz)
            dummy.rotation.set(0, heading, 0)
            dummy.scale.set(1, 1, 1)
            dummy.updateMatrix()
            write('guardPost')
            dummy.position.set(px, smp.py + 0.72, pz)
            dummy.updateMatrix()
            write('guardRail')
            break
          }
          case 'neon': {
            dummy.position.set(px, groundY + 3.5 + prop.variant * 6, pz)
            // 도로를 향하도록
            dummy.rotation.set(0, Math.atan2(-smp.dirX, -smp.dirZ) + (prop.x > 0 ? Math.PI / 2 : -Math.PI / 2), 0)
            dummy.scale.set(sc, sc, 1)
            dummy.updateMatrix()
            const mesh = refs.neonSign.current
            if (mesh && counts.neonSign < MAX.neonSign) {
              const idx = counts.neonSign
              mesh.setMatrixAt(idx, dummy.matrix)
              scratchColor.setHex(NEON_COLORS[Math.floor(prop.variant * NEON_COLORS.length)])
              mesh.setColorAt(idx, scratchColor)
              counts.neonSign++
            }
            break
          }
        }
      }
    }

    for (const key of Object.keys(counts) as Array<keyof typeof MAX>) {
      const mesh = refs[key].current
      if (!mesh) continue
      mesh.count = counts[key]
      mesh.instanceMatrix.needsUpdate = true
      if (key === 'neonSign' && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    for (let i = 0; i < BUILDING_VARIANTS; i++) {
      for (const mesh of [buildingRefs.current[i], buildingGlowRefs.current[i]]) {
        if (!mesh) continue
        mesh.count = buildingCounts[i]
        mesh.instanceMatrix.needsUpdate = true
      }
    }
  })

  return (
    <group>
      <instancedMesh ref={refs.pineTrunk} args={[assets.pack.pineTrunk, assets.mat.trunk, MAX.pineTrunk]} />
      <instancedMesh ref={refs.pineLeaf} args={[assets.pack.pineLeaf, assets.mat.pineLeaf, MAX.pineLeaf]} castShadow />
      <instancedMesh ref={refs.treeTrunk} args={[assets.pack.treeTrunk, assets.mat.trunk, MAX.treeTrunk]} />
      <instancedMesh ref={refs.treeLeaf} args={[assets.pack.treeLeaf, assets.mat.treeLeaf, MAX.treeLeaf]} castShadow />
      <instancedMesh ref={refs.palmTrunk} args={[assets.pack.palmTrunk, assets.mat.trunk, MAX.palmTrunk]} />
      <instancedMesh ref={refs.palmLeaf} args={[assets.pack.palmLeaf, assets.mat.treeLeaf, MAX.palmLeaf]} castShadow />
      <instancedMesh ref={refs.bush} args={[assets.pack.bush, assets.mat.bush, MAX.bush]} />
      <instancedMesh ref={refs.rockProp} args={[assets.pack.rockProp, assets.mat.packObstacle, MAX.rockProp]} castShadow />
      <instancedMesh ref={refs.gate} args={[assets.pack.gate, assets.mat.packBaked, MAX.gate]} />
      {assets.pack.building.map((geo, i) => (
        <instancedMesh
          key={`building${i}`}
          ref={(m) => { buildingRefs.current[i] = m }}
          args={[geo, assets.mat.packBaked, MAX_BUILDING]}
        />
      ))}
      {assets.pack.buildingGlow.map((geo, i) => (
        <instancedMesh
          key={`buildingGlow${i}`}
          ref={(m) => { buildingGlowRefs.current[i] = m }}
          args={[geo, assets.mat.buildingGlow, MAX_BUILDING]}
        />
      ))}
      <instancedMesh ref={refs.lampPole} args={[assets.geo.lampPole, assets.mat.lampPole, MAX.lampPole]} />
      <instancedMesh ref={refs.lampHead} args={[assets.geo.lampHead, assets.mat.lampHead, MAX.lampHead]} />
      <instancedMesh ref={refs.tunnel} args={[assets.geo.tunnel, assets.mat.tunnel, MAX.tunnel]} />
      <instancedMesh ref={refs.tunnelLight} args={[assets.geo.tunnelLight, assets.mat.tunnelLight, MAX.tunnelLight]} />
      <instancedMesh ref={refs.tunnelRing} args={[assets.geo.tunnelRing, assets.mat.tunnelRing, MAX.tunnelRing]} />
      <instancedMesh ref={refs.guardPost} args={[assets.geo.guardPost, assets.mat.guard, MAX.guardPost]} />
      <instancedMesh ref={refs.guardRail} args={[assets.geo.guardRail, assets.mat.guard, MAX.guardRail]} />
      <instancedMesh ref={refs.neonSign} args={[assets.geo.neonSign, assets.mat.neonSign, MAX.neonSign]} />
    </group>
  )
}
