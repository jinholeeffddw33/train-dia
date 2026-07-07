'use client'

/**
 * APEX RUSH — 원경 실루엣 (산맥 2겹 + 도심 타워)
 * 카메라 xz 를 따라다니는 링 — 절대 다가가지 않는 원경 (패럴랙스).
 * MeshBasicMaterial 이 fog 를 받아 바이옴 톤에 자연히 녹는다.
 */

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, InstancedMesh, Object3D } from 'three'
import { biomeAt } from '../engine/track'
import type { ApexSim } from '../engine/sim'
import type { ApexAssets } from './assets'

const PEAKS_NEAR = 22
const PEAKS_FAR = 18
const TOWERS = 20

const dummy = new Object3D()

/** 결정적 의사난수 (인덱스 기반) */
function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function SkylineRing({ sim, assets }: { sim: ApexSim; assets: ApexAssets }) {
  const groupRef = useRef<Group>(null)
  const nearRef = useRef<InstancedMesh>(null)
  const farRef = useRef<InstancedMesh>(null)
  const towerRef = useRef<InstancedMesh>(null)
  const { camera } = useThree()

  // 정적 배치 — 1회
  useEffect(() => {
    const near = nearRef.current
    const far = farRef.current
    const tower = towerRef.current
    if (near) {
      for (let i = 0; i < PEAKS_NEAR; i++) {
        const angle = (i / PEAKS_NEAR) * Math.PI * 2 + hash01(i, 1) * 0.25
        const radius = 165 + hash01(i, 2) * 30
        const h = 34 + hash01(i, 3) * 42
        const w = 46 + hash01(i, 4) * 50
        dummy.position.set(Math.cos(angle) * radius, h / 2 - 26, Math.sin(angle) * radius)
        dummy.rotation.set(0, hash01(i, 5) * Math.PI, 0)
        dummy.scale.set(w, h, w)
        dummy.updateMatrix()
        near.setMatrixAt(i, dummy.matrix)
      }
      near.instanceMatrix.needsUpdate = true
      near.frustumCulled = false
    }
    if (far) {
      for (let i = 0; i < PEAKS_FAR; i++) {
        const angle = (i / PEAKS_FAR) * Math.PI * 2 + hash01(i, 6) * 0.3 + 0.16
        const radius = 225 + hash01(i, 7) * 40
        const h = 55 + hash01(i, 8) * 60
        const w = 80 + hash01(i, 9) * 70
        dummy.position.set(Math.cos(angle) * radius, h / 2 - 30, Math.sin(angle) * radius)
        dummy.rotation.set(0, hash01(i, 10) * Math.PI, 0)
        dummy.scale.set(w, h, w)
        dummy.updateMatrix()
        far.setMatrixAt(i, dummy.matrix)
      }
      far.instanceMatrix.needsUpdate = true
      far.frustumCulled = false
    }
    if (tower) {
      for (let i = 0; i < TOWERS; i++) {
        const angle = (i / TOWERS) * Math.PI * 2 + hash01(i, 11) * 0.3
        const radius = 175 + hash01(i, 12) * 45
        const h = 40 + hash01(i, 13) * 70
        const w = 12 + hash01(i, 14) * 16
        dummy.position.set(Math.cos(angle) * radius, h / 2 - 22, Math.sin(angle) * radius)
        dummy.rotation.set(0, hash01(i, 15) * Math.PI, 0)
        dummy.scale.set(w, h, w)
        dummy.updateMatrix()
        tower.setMatrixAt(i, dummy.matrix)
      }
      tower.instanceMatrix.needsUpdate = true
      tower.frustumCulled = false
    }
  }, [])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    // 카메라 xz 추적 (y 는 라이더 고도 기준 — 다운힐로 계속 내려가도 지평선 유지)
    group.position.set(camera.position.x, camera.position.y - 6, camera.position.z)

    // 바이옴별 실루엣 전환 (산/계곡 = 능선, 도심 = 타워)
    const biome = biomeAt(sim.state.s)
    const isCity = biome === 'city'
    if (towerRef.current) towerRef.current.visible = isCity
    if (nearRef.current) nearRef.current.visible = !isCity
    if (farRef.current) farRef.current.visible = true
  })

  return (
    <group ref={groupRef}>
      <instancedMesh ref={nearRef} args={[assets.geo.skylinePeak, assets.mat.skyline, PEAKS_NEAR]} />
      <instancedMesh ref={farRef} args={[assets.geo.skylinePeak, assets.mat.skylineFar, PEAKS_FAR]} />
      <instancedMesh ref={towerRef} args={[assets.geo.skylineTower, assets.mat.skyline, TOWERS]} />
    </group>
  )
}
