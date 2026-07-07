'use client'

/**
 * APEX RUSH — 경량 파티클 (니어미스 스파크/착지 먼지/수집 팝/크래시 파편/터보 트레일)
 * InstancedMesh 박스 96개 풀 — GC 0 (사전 할당 링버퍼).
 * GameScene 이 spawnQueue 에 push → 여기서 소비.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry, Color, DynamicDrawUsage, InstancedMesh,
  MeshBasicMaterial, Object3D,
} from 'three'

const POOL = 96

export interface ParticleSpawn {
  x: number
  y: number
  z: number
  color: number
  count: number
  /** 분출 속도 */
  speed: number
  /** 위로 뜨는 성분 */
  up: number
  /** 수명 (s) */
  life: number
  /** 크기 */
  size: number
}

export interface ParticleQueue {
  items: ParticleSpawn[]
}

interface Particle {
  active: boolean
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number
  maxLife: number
  size: number
}

const dummy = new Object3D()
const scratchColor = new Color()

export function ParticleFX({ queue }: { queue: ParticleQueue }) {
  const meshRef = useRef<InstancedMesh>(null)
  const cursorRef = useRef(0)

  const { geometry, material, pool } = useMemo(() => {
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0.9 })
    const pool: Particle[] = []
    for (let i = 0; i < POOL; i++) {
      pool.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1 })
    }
    return { geometry, material, pool }
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
    if (!mesh) return

    // 스폰 큐 소비
    while (queue.items.length > 0) {
      const spawn = queue.items.pop()
      if (!spawn) break
      for (let n = 0; n < spawn.count; n++) {
        const idx = cursorRef.current
        cursorRef.current = (idx + 1) % POOL
        const p = pool[idx]
        const theta = Math.random() * Math.PI * 2
        const mag = spawn.speed * (0.4 + Math.random() * 0.6)
        p.active = true
        p.x = spawn.x
        p.y = spawn.y
        p.z = spawn.z
        p.vx = Math.cos(theta) * mag
        p.vz = Math.sin(theta) * mag
        p.vy = spawn.up * (0.5 + Math.random() * 0.8)
        p.life = spawn.life * (0.6 + Math.random() * 0.4)
        p.maxLife = p.life
        p.size = spawn.size * (0.6 + Math.random() * 0.8)
        scratchColor.setHex(spawn.color)
        mesh.setColorAt(idx, scratchColor)
      }
    }

    // 갱신
    let count = 0
    for (let i = 0; i < POOL; i++) {
      const p = pool[i]
      if (!p.active) {
        // 비활성은 스케일 0
        dummy.position.set(0, -9999, 0)
        dummy.scale.set(0.0001, 0.0001, 0.0001)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        continue
      }
      p.life -= delta
      if (p.life <= 0) {
        p.active = false
        continue
      }
      p.vy -= 9 * delta
      p.x += p.vx * delta
      p.y += p.vy * delta
      p.z += p.vz * delta
      const t = p.life / p.maxLife
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(p.life * 7, p.life * 9, 0)
      const s = p.size * (0.4 + t * 0.6)
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      count++
    }
    mesh.count = POOL
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <instancedMesh ref={meshRef} args={[geometry, material, POOL]} />
}
