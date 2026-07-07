'use client'

/**
 * APEX RUSH — 스피드 라인 (속도감 연출)
 * 카메라에 부착된 그룹 안에서 얇은 라인들이 뒤로 흐른다.
 * 속도가 낮으면 투명, 최고속/부스트에서 선명.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  DynamicDrawUsage, Group, InstancedMesh, MeshBasicMaterial,
  Object3D, PlaneGeometry,
} from 'three'
import { MAX_SPEED } from '../constants'
import type { ApexSim } from '../engine/sim'

const COUNT = 34

interface LineSeed {
  angle: number
  radius: number
  z: number
  speed: number
  len: number
}

const dummy = new Object3D()

export function SpeedLines({ sim }: { sim: ApexSim }) {
  const meshRef = useRef<InstancedMesh>(null)
  const groupRef = useRef<Group>(null)
  const { camera } = useThree()

  const { geometry, material, seeds } = useMemo(() => {
    const geometry = new PlaneGeometry(0.02, 1)
    const material = new MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    })
    const seeds: LineSeed[] = []
    for (let i = 0; i < COUNT; i++) {
      // 결정적 배치 (황금각 분산)
      const angle = i * 2.399963
      seeds.push({
        angle,
        radius: 1.6 + (i % 7) * 0.5,
        z: -((i * 0.61) % 14),
        speed: 26 + (i % 5) * 6,
        len: 1.6 + (i % 4) * 0.8,
      })
    }
    return { geometry, material, seeds }
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.frustumCulled = false
    }
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const group = groupRef.current
    if (!mesh || !group) return
    const st = sim.state

    // 카메라에 부착
    group.position.copy(camera.position)
    group.quaternion.copy(camera.quaternion)

    const speedNorm = st.speed / MAX_SPEED
    const boost = st.boostTimer > 0 ? 0.35 : 0
    const targetOpacity = st.phase === 'playing'
      ? Math.max(0, (speedNorm - 0.55) * 1.1) + boost
      : 0
    material.opacity += (Math.min(0.5, targetOpacity) - material.opacity) * Math.min(1, 6 * delta)

    if (material.opacity < 0.02) {
      mesh.count = 0
      return
    }

    for (let i = 0; i < COUNT; i++) {
      const seed = seeds[i]
      seed.z += seed.speed * delta * (0.6 + speedNorm)
      if (seed.z > 4) seed.z -= 18
      const x = Math.cos(seed.angle) * seed.radius
      const y = Math.sin(seed.angle) * seed.radius * 0.6
      dummy.position.set(x, y, seed.z)
      // 라인이 진행 방향(로컬 -z)으로 눕도록
      dummy.rotation.set(Math.PI / 2, 0, 0)
      dummy.scale.set(1, seed.len * (0.7 + speedNorm), 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = COUNT
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geometry, material, COUNT]} renderOrder={5} />
    </group>
  )
}
