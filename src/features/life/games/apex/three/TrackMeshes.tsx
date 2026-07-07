'use client'

/**
 * APEX RUSH — 트랙 렌더 (청크 스트리밍)
 * 청크 생성/폐기 콜백에 맞춰 도로+지면 리본과 라인 리본 지오메트리를 만들고 dispose.
 * 바이옴 색은 샘플별 paletteAt 으로 vertex color 에 굽는다 → 경계에서 자연 그라데이션.
 */

import { useEffect, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Color } from 'three'
import { SAMPLES_PER_CHUNK, SAMPLE_STEP } from '../constants'
import { paletteAt, PALETTES } from '../engine/palettes'
import type { ApexSim } from '../engine/sim'
import type { BiomePalette, TrackChunk } from '../engine/types'
import type { ApexAssets } from './assets'

/** 도로/지면 리본 단면 (좌→우): [xOffset, yOffset, colorKey] */
const CROSS_SECTION: Array<[number, number, 'ground' | 'road' | 'berm']> = [
  [-24, -1.6, 'ground'],
  [-4.95, -0.05, 'ground'],
  [-4.85, 0, 'road'],
  [4.85, 0, 'road'],
  [4.95, -0.05, 'ground'],
  [24, -1.6, 'ground'],
]

/** 🏞 흙길(MTB 파크) 단면 — 도로 양옆이 흙 버름(뱅크) 벽으로 올라간 보울 (진호 2026-07-07
 *  "완전 흙길 MTB 파크 — 꾸불꾸불 + 뱅크"). 커브에선 바깥 벽이 동적으로 더 솟는다. */
const DIRT_CROSS_SECTION: Array<[number, number, 'ground' | 'road' | 'berm']> = [
  [-14, -10, 'ground'],   // 낭떠러지 — 능선 밖은 산비탈로 뚝 (진호 "못 타면 절벽")
  [-6.0, 2.2, 'ground'],  // 능선 숲 바닥
  [-3.6, 1.9, 'berm'],    // 버름 꼭대기 — 트레일에 바짝 (화면 꽉 차는 벽)
  [-2.4, 0.35, 'berm'],
  [-1.8, 0, 'road'],      // 싱글트랙 폭 3.6m (진호 "너무 넓어" — 도로 9.2m의 40%)
  [1.8, 0, 'road'],
  [2.4, 0.35, 'berm'],
  [3.6, 1.9, 'berm'],
  [6.0, 2.2, 'ground'],
  [14, -10, 'ground'],
]

const scratchPalette: BiomePalette = { ...PALETTES.mountain }
const scratchColor = new Color()

function buildRoadGeometry(chunk: TrackChunk): BufferGeometry {
  const dirt = chunk.biome === 'dirt'
  const section = dirt ? DIRT_CROSS_SECTION : CROSS_SECTION
  const cols = section.length
  const rows = chunk.samples.length
  const positions = new Float32Array(rows * cols * 3)
  const colors = new Float32Array(rows * cols * 3)
  const normals = new Float32Array(rows * cols * 3)
  const uvs = new Float32Array(rows * cols * 2)

  for (let r = 0; r < rows; r++) {
    const smp = chunk.samples[r]
    const s = chunk.s0 + r * SAMPLE_STEP
    const pal = paletteAt(s, scratchPalette)
    // 🏞 뱅크(수퍼엘리베이션) — 코너에서 도로면 전체가 안쪽으로 눕는다 (sim.bankSlopeAt 과 동일
    //   공식 — 라이더가 이 면 위를 정확히 탄다). 우회전 = 왼쪽(바깥) 상승.
    let slope = 0
    if (dirt) {
      const a = chunk.samples[Math.max(0, r - 1)]
      const b = chunk.samples[Math.min(rows - 1, r + 1)]
      const crossY = a.dirX * b.dirZ - a.dirZ * b.dirX // sin(방향 변화, 4m 창) — >0 = 우회전
      slope = Math.max(-0.45, Math.min(0.45, (crossY / 4) * 9))
    }
    for (let c = 0; c < cols; c++) {
      const [xo, rawYo, ck] = section[c]
      // 뱅크 기울기 — 트레일·버름(|x|≤3.6)은 풀, 능선(~6)은 감쇠, 절벽 밖은 0
      const falloff = Math.abs(xo) <= 3.6 ? 1 : Math.max(0, 1 - (Math.abs(xo) - 3.6) / 2.4)
      const lift = dirt ? rawYo - xo * slope * falloff : rawYo
      const i = (r * cols + c) * 3
      positions[i] = smp.px + smp.rightX * xo
      positions[i + 1] = smp.py + lift
      positions[i + 2] = smp.pz + smp.rightZ * xo
      if (ck === 'berm') {
        // 버름 = 도로 흙보다 살짝 어두운 다진 흙
        scratchColor.setHex(pal.road).multiplyScalar(0.84)
      } else {
        scratchColor.setHex(ck === 'road' ? pal.road : pal.ground)
      }
      // 🏞 흙길 자갈 얼룩 — 결정적 해시로 정점별 명도 지터 (거친 흙/자갈 패치, 진호 "너무 고운 흙")
      if (dirt && ck !== 'ground') {
        const h = Math.sin((chunk.s0 + r * 7.31 + c * 13.7) * 12.9898) * 43758.5453
        scratchColor.multiplyScalar(0.86 + (h - Math.floor(h)) * 0.26)
      }
      colors[i] = scratchColor.r
      colors[i + 1] = scratchColor.g
      colors[i + 2] = scratchColor.b
      normals[i] = 0
      normals[i + 1] = 1
      normals[i + 2] = 0
      // 표면 노이즈 타일링 (아스팔트 그레인/흙 얼룩) — 월드 스케일 기준
      const j = (r * cols + c) * 2
      uvs[j] = xo / 9.5
      uvs[j + 1] = s / 9.5
    }
  }

  const indices: number[] = []
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c
      const b = a + cols
      // winding: 위(+y)를 향하도록 (전진×우측 기준 CCW)
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  geo.setAttribute('normal', new BufferAttribute(normals, 3))
  geo.setAttribute('uv', new BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

/** 라인 리본 — 좌/우 엣지라인(연속) + 중앙 대시 */
function buildLineGeometry(chunk: TrackChunk): BufferGeometry {
  const rows = chunk.samples.length
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const LINE_Y = 0.03
  const HALF = 0.09

  const pushQuadStripRow = (r: number, cx: number, pal: BiomePalette) => {
    const smp = chunk.samples[r]
    scratchColor.setHex(pal.roadLine)
    for (const off of [cx - HALF, cx + HALF]) {
      positions.push(
        smp.px + smp.rightX * off,
        smp.py + LINE_Y,
        smp.pz + smp.rightZ * off,
      )
      colors.push(scratchColor.r, scratchColor.g, scratchColor.b)
    }
  }

  // 좌/우 엣지라인 (연속 스트립)
  for (const edgeX of [-4.45, 4.45]) {
    const base = positions.length / 3
    for (let r = 0; r < rows; r++) {
      pushQuadStripRow(r, edgeX, paletteAt(chunk.s0 + r * SAMPLE_STEP, scratchPalette))
    }
    for (let r = 0; r < rows - 1; r++) {
      const a = base + r * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  // 중앙 대시 (샘플 1칸 길이 = 2m, 2칸마다)
  for (let r = 0; r + 1 < rows; r += 2) {
    const base = positions.length / 3
    pushQuadStripRow(r, 0, paletteAt(chunk.s0 + r * SAMPLE_STEP, scratchPalette))
    pushQuadStripRow(r + 1, 0, paletteAt(chunk.s0 + (r + 1) * SAMPLE_STEP, scratchPalette))
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

interface TrackMeshesProps {
  sim: ApexSim
  assets: ApexAssets
}

export function TrackMeshes({ sim, assets }: TrackMeshesProps) {
  const groupRef = useRef<Group>(null)
  const lineMatRef = useRef<MeshBasicMaterial | null>(null)

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    const lineMat = new MeshBasicMaterial({ vertexColors: true })
    lineMatRef.current = lineMat

    const chunkMeshes = new Map<number, { road: Mesh; line: Mesh | null }>()

    const addChunk = (chunk: TrackChunk) => {
      const roadGeo = buildRoadGeometry(chunk)
      const road = new Mesh(roadGeo, assets.mat.track)
      road.receiveShadow = true
      road.matrixAutoUpdate = false
      group.add(road)
      // 흙길(MTB 파크)엔 아스팔트 차선 없음 — 자연 트레일 (진호 2026-07-07)
      let line: Mesh | null = null
      if (chunk.biome !== 'dirt') {
        line = new Mesh(buildLineGeometry(chunk), lineMat)
        line.matrixAutoUpdate = false
        group.add(line)
      }
      chunkMeshes.set(chunk.index, { road, line })
    }

    const removeChunk = (chunk: TrackChunk) => {
      const meshes = chunkMeshes.get(chunk.index)
      if (!meshes) return
      chunkMeshes.delete(chunk.index)
      group.remove(meshes.road)
      meshes.road.geometry.dispose()
      if (meshes.line) {
        group.remove(meshes.line)
        meshes.line.geometry.dispose()
      }
    }

    // 이미 생성된 청크 반영 + 이후 스트리밍 구독
    for (const chunk of sim.track.allChunks()) addChunk(chunk)
    const unsubscribe = sim.track.subscribeChunks(addChunk, removeChunk)

    return () => {
      unsubscribe()
      for (const { road, line } of chunkMeshes.values()) {
        group.remove(road)
        road.geometry.dispose()
        if (line) {
          group.remove(line)
          line.geometry.dispose()
        }
      }
      chunkMeshes.clear()
      lineMat.dispose()
    }
  }, [sim, assets])

  return <group ref={groupRef} />
}
