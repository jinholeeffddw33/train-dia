/**
 * APEX RUSH — 공유 지오메트리/머티리얼/텍스처 팩토리
 * 게임 세션 동안 1회 생성, 언마운트 시 disposeApexAssets() 로 완전 해제
 * (iOS WKWebView 메모리 jetsam 방지 — 게임 종료 = 리소스 0).
 */

import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture,
  CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide,
  ExtrudeGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshLambertMaterial,
  OctahedronGeometry, RepeatWrapping, Shape, SphereGeometry,
  TorusGeometry,
} from 'three'
import { packGeometry, type ApexPackData } from './modelPack'

export interface ApexAssets {
  geo: {
    ramp: BufferGeometry
    rampStripe: BufferGeometry
    rampChevron: BufferGeometry
    /** 💧 물웅덩이/오일 (납작 원판) */
    puddle: CircleGeometry
    /** ◎ 스피드 링 (세로 대형 토러스) */
    speedRing: TorusGeometry
    chip: OctahedronGeometry
    /** 💰 골드 코인 — 진짜 동전(납작 실린더, 진호 2026-07-07 "3D 동그란 코인") */
    goldChip: CylinderGeometry
    /** 드럼통/나무상자 — 장애물 다양화 (유저 피드백 ⑧) */
    barrel: CylinderGeometry
    crate: BoxGeometry
    /** 흙길 트레일 위 서있는 나무 기둥 (MTB "나무 피하기") */
    trunk: CylinderGeometry
    itemTurbo: ExtrudeGeometry
    /** 🌈 슈퍼부스트 번개 — itemTurbo 확대 + 인스타 그라데이션 vertex color (라벤더→핫핑크) */
    itemSuper: ExtrudeGeometry
    itemShield: IcosahedronGeometry
    itemMagnet: TorusGeometry
    itemRing: TorusGeometry
    lampPole: CylinderGeometry
    lampHead: SphereGeometry
    tunnel: CylinderGeometry
    tunnelLight: BoxGeometry
    tunnelRing: TorusGeometry
    guardPost: BoxGeometry
    guardRail: BoxGeometry
    neonSign: BoxGeometry
    skylinePeak: ConeGeometry
    skylineTower: BoxGeometry
    wheel: TorusGeometry
    blob: BufferGeometry
  }
  /** CC0 모델 팩 지오메트리 (Kenney — scripts/apex-build-model-pack.mjs) */
  pack: {
    car: BufferGeometry[]
    truck: BufferGeometry[]
    bus: BufferGeometry[]
    cone: BufferGeometry
    barrier: BufferGeometry[]
    log: BufferGeometry
    rockOb: BufferGeometry[]
    pineTrunk: BufferGeometry
    pineLeaf: BufferGeometry
    treeTrunk: BufferGeometry
    treeLeaf: BufferGeometry
    palmTrunk: BufferGeometry
    palmLeaf: BufferGeometry
    bush: BufferGeometry
    rockProp: BufferGeometry
    gate: BufferGeometry
    building: BufferGeometry[]
    /** 빌딩 유리창 발광 파트 (building 과 같은 인덱스) */
    buildingGlow: BufferGeometry[]
  }
  mat: {
    ramp: MeshLambertMaterial
    rampGlow: MeshBasicMaterial
    /** 테마별 램프 몸통 — 산길=나무판자/자연=흙둔덕/도심=공사금속/사이버=네온 (진호 V15) */
    rampWood: MeshLambertMaterial
    rampDirt: MeshLambertMaterial
    rampMetal: MeshLambertMaterial
    rampNeon: MeshLambertMaterial
    /** 테마별 램프 경사면 액센트 (스트라이프) */
    rampAccWood: MeshLambertMaterial
    rampAccDirt: MeshLambertMaterial
    rampAccMetal: MeshBasicMaterial
    rampAccNeon: MeshBasicMaterial
    puddleWater: MeshBasicMaterial
    puddleOil: MeshBasicMaterial
    speedRing: MeshBasicMaterial
    chip: MeshBasicMaterial
    goldChip: MeshBasicMaterial
    barrel: MeshLambertMaterial
    barrelStripe: MeshLambertMaterial
    crate: MeshLambertMaterial
    itemTurbo: MeshBasicMaterial
    /** 🌈 슈퍼부스트 — vertexColors 그라데이션 (라벤더→핫핑크), toneMapped:false 로 네온 유지 */
    itemSuper: MeshBasicMaterial
    itemShield: MeshBasicMaterial
    itemMagnet: MeshBasicMaterial
    itemRing: MeshBasicMaterial
    tunnel: MeshLambertMaterial
    tunnelLight: MeshBasicMaterial
    tunnelRing: MeshBasicMaterial
    guard: MeshLambertMaterial
    neonSign: MeshBasicMaterial
    skyline: MeshBasicMaterial
    skylineFar: MeshBasicMaterial
    trunk: MeshLambertMaterial
    pineLeaf: MeshLambertMaterial
    treeLeaf: MeshLambertMaterial
    bush: MeshLambertMaterial
    lampPole: MeshLambertMaterial
    lampHead: MeshBasicMaterial
    track: MeshLambertMaterial
    blob: MeshBasicMaterial
    /** 팩 베이크 컬러 (차량/빌딩) — vertex color 그대로 */
    packBaked: MeshLambertMaterial
    /** 도로 위 정적 장애물 — 시인성 emissive 리프트 */
    packObstacle: MeshLambertMaterial
    /** 빌딩 유리창 자체발광 (밤 도심) */
    buildingGlow: MeshBasicMaterial
  }
  tex: {
    blobShadow: CanvasTexture
    surfaceNoise: CanvasTexture
  }
}

/** 램프(쐐기) 지오메트리 — 삼각 프리즘 */
function createRampGeometry(): BufferGeometry {
  const w = 1.15 // half width
  const d = 2.8 // depth (진행방향)
  const h = 0.85
  // 앞(낮음, -z 진행 반대... 로컬: -z = 라이더 진입 방향) → 뒤(높음)
  const positions = new Float32Array([
    // 왼쪽 면 삼각
    -w, 0, d / 2, -w, 0, -d / 2, -w, h, -d / 2,
    // 오른쪽 면 삼각
    w, 0, d / 2, w, h, -d / 2, w, 0, -d / 2,
    // 경사면 (진입 → 정점)
    -w, 0, d / 2, -w, h, -d / 2, w, h, -d / 2,
    -w, 0, d / 2, w, h, -d / 2, w, 0, d / 2,
    // 뒷면 (수직)
    -w, h, -d / 2, -w, 0, -d / 2, w, 0, -d / 2,
    -w, h, -d / 2, w, 0, -d / 2, w, h, -d / 2,
  ])
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

/** 램프 경사면 위 라임 스트립 (z-fighting 방지 오프셋 포함) */
function createRampStripeGeometry(): BufferGeometry {
  const w = 0.92
  const d = 2.8
  const h = 0.85
  const lift = 0.035
  // 경사면: (z=d/2, y=0) → (z=-d/2, y=h). 법선 방향으로 lift.
  const len = Math.hypot(d, h)
  const ny = d / len
  const nz = h / len
  const positions = new Float32Array([
    -w, 0 + ny * lift, d / 2 + nz * lift,
    -w, h + ny * lift, -d / 2 + nz * lift,
    w, h + ny * lift, -d / 2 + nz * lift,
    -w, 0 + ny * lift, d / 2 + nz * lift,
    w, h + ny * lift, -d / 2 + nz * lift,
    w, 0 + ny * lift, d / 2 + nz * lift,
  ])
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

/** 램프 경사면 위 발광 셰브론 화살표 3개 (진행 방향 지시 — 진호 피드백) */
function createRampChevronGeometry(): BufferGeometry {
  const positions: number[] = []
  const d = 2.8
  const h = 0.85
  const lift = 0.04
  const len = Math.hypot(d, h)
  const ny = d / len
  const nz = h / len
  // 경사면 파라미터 t(0=앞바닥, 1=뒤꼭대기) → 로컬 (y, z)
  const onSlope = (t: number): [number, number] => [h * t + ny * lift, d / 2 - d * t + nz * lift]
  // 셰브론 1개: V자 (진행 방향 = 오르는 방향 = t 증가). 날개 2개 쿼드.
  const chevron = (tCenter: number) => {
    const w = 0.62 // 날개 가로 길이
    const thick = 0.16 // 두께 (t 방향)
    const tipT = tCenter + 0.09
    const tailT = tCenter - 0.05
    const [tipY, tipZ] = onSlope(tipT)
    const [tipY2, tipZ2] = onSlope(tipT - thick)
    const [tailY, tailZ] = onSlope(tailT)
    const [tailY2, tailZ2] = onSlope(tailT - thick)
    for (const side of [-1, 1]) {
      // 쿼드: 중앙(tip) → 바깥(tail). x 부호가 뒤집히면 winding 도 뒤집히므로
      // side 별로 정점 순서를 맞춰 양 날개 모두 경사면 외향 CCW 유지 (backface 컬링 방지)
      const x0 = 0
      const x1 = side * w
      if (side === -1) {
        positions.push(
          x0, tipY, tipZ, x1, tailY, tailZ, x1, tailY2, tailZ2,
          x0, tipY, tipZ, x1, tailY2, tailZ2, x0, tipY2, tipZ2,
        )
      } else {
        positions.push(
          x0, tipY, tipZ, x1, tailY2, tailZ2, x1, tailY, tailZ,
          x0, tipY, tipZ, x0, tipY2, tipZ2, x1, tailY2, tailZ2,
        )
      }
    }
  }
  chevron(0.3)
  chevron(0.55)
  chevron(0.8)
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

/** 🌈 슈퍼부스트 번개 — itemTurbo 볼트를 1.5배 확대 + 세로 그라데이션 vertex color.
 *  위=라벤더 → 아래=핫핑크 (진호 2026-07-07 "인스타 그라데이션, 라벤더·핑크"). center() 로
 *  원점 정렬해 ObstaclesMesh 스핀이 제자리 회전이 되게 한다. */
function createSuperboostGeometry(): ExtrudeGeometry {
  const k = 1.5
  const bolt = new Shape()
  bolt.moveTo(0.10 * k, 0.55 * k)
  bolt.lineTo(-0.26 * k, 0.04 * k)
  bolt.lineTo(-0.04 * k, 0.04 * k)
  bolt.lineTo(-0.10 * k, -0.55 * k)
  bolt.lineTo(0.26 * k, -0.02 * k)
  bolt.lineTo(0.04 * k, -0.02 * k)
  bolt.closePath()
  const geo = new ExtrudeGeometry(bolt, { depth: 0.2, bevelEnabled: false })
  geo.center()
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const lavender = new Color(0xb794f6)
  const hotpink = new Color(0xff5f9e)
  const tmp = new Color()
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const span = Math.max(1e-4, maxY - minY)
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span
    tmp.copy(hotpink).lerp(lavender, t)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  return geo
}

/** 뉴트럴 표면 노이즈 (도로 = 아스팔트 그레인 / 지면 = 흙 얼룩 — vertex color 에 곱) */
function createSurfaceNoiseTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#b4b4b4'
    ctx.fillRect(0, 0, size, size)
    // 미세 그레인
    for (let i = 0; i < 9000; i++) {
      const v = 150 + Math.floor(Math.random() * 105)
      ctx.fillStyle = `rgba(${v},${v},${v},0.16)`
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5)
    }
    // 큰 얼룩 (아스팔트 패치/흙 톤 변화)
    for (let i = 0; i < 26; i++) {
      const v = 140 + Math.floor(Math.random() * 90)
      ctx.fillStyle = `rgba(${v},${v},${v},0.10)`
      ctx.beginPath()
      ctx.ellipse(Math.random() * size, Math.random() * size, 12 + Math.random() * 34, 8 + Math.random() * 22, Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    // 미세 균열
    ctx.strokeStyle = 'rgba(96,96,96,0.22)'
    ctx.lineWidth = 1
    for (let i = 0; i < 14; i++) {
      ctx.beginPath()
      let x = Math.random() * size
      let y = Math.random() * size
      ctx.moveTo(x, y)
      for (let n = 0; n < 5; n++) {
        x += (Math.random() - 0.5) * 34
        y += Math.random() * 22
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

/** 라이더 블롭 섀도 (radial gradient) */
function createBlobShadowTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.26)')
    g.addColorStop(0.7, 'rgba(0,0,0,0.1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return new CanvasTexture(canvas)
}

export function createApexAssets(packData: ApexPackData): ApexAssets {
  const blobShadow = createBlobShadowTexture()
  const surfaceNoise = createSurfaceNoiseTexture()

  const blobGeo = new BufferGeometry()
  blobGeo.setAttribute('position', new BufferAttribute(new Float32Array([
    -1, 0, -1, 1, 0, -1, 1, 0, 1,
    -1, 0, -1, 1, 0, 1, -1, 0, 1,
  ]), 3))
  blobGeo.setAttribute('uv', new BufferAttribute(new Float32Array([
    0, 1, 1, 1, 1, 0,
    0, 1, 1, 0, 0, 0,
  ]), 2))
  blobGeo.computeVertexNormals()

  return {
    geo: {
      ramp: createRampGeometry(),
      rampStripe: createRampStripeGeometry(),
      rampChevron: createRampChevronGeometry(),
      puddle: new CircleGeometry(1.35, 14),
      speedRing: new TorusGeometry(1.5, 0.11, 8, 26),
      chip: new OctahedronGeometry(0.34),
      goldChip: new CylinderGeometry(0.5, 0.5, 0.12, 20), // 💰 동전 (세워서 스핀 — ObstaclesMesh)
      barrel: new CylinderGeometry(0.42, 0.42, 0.95, 10),
      crate: new BoxGeometry(0.85, 0.85, 0.85),
      trunk: new CylinderGeometry(0.34, 0.46, 6.5, 9),
      // ⚡ 번개 볼트 — 유저 피드백 "터보가 터보처럼 안 생겼다" (사면체 → 실제 번개 실루엣)
      itemTurbo: (() => {
        const bolt = new Shape()
        bolt.moveTo(0.10, 0.55)
        bolt.lineTo(-0.26, 0.04)
        bolt.lineTo(-0.04, 0.04)
        bolt.lineTo(-0.10, -0.55)
        bolt.lineTo(0.26, -0.02)
        bolt.lineTo(0.04, -0.02)
        bolt.closePath()
        return new ExtrudeGeometry(bolt, { depth: 0.14, bevelEnabled: false })
      })(),
      itemSuper: createSuperboostGeometry(),
      itemShield: new IcosahedronGeometry(0.42),
      itemMagnet: new TorusGeometry(0.34, 0.12, 8, 14),
      itemRing: new TorusGeometry(0.62, 0.045, 8, 24),
      lampPole: new CylinderGeometry(0.07, 0.09, 4.6, 6),
      lampHead: new SphereGeometry(0.22, 8, 6),
      tunnel: new CylinderGeometry(7.2, 7.2, 44, 14, 1, true),
      tunnelLight: new BoxGeometry(0.5, 0.1, 2.4),
      tunnelRing: new TorusGeometry(7.25, 0.18, 8, 22),
      guardPost: new BoxGeometry(0.13, 0.75, 0.13),
      guardRail: new BoxGeometry(0.08, 0.22, 6.2),
      neonSign: new BoxGeometry(2.4, 0.9, 0.16),
      skylinePeak: new ConeGeometry(1, 1, 5),
      skylineTower: new BoxGeometry(1, 1, 1),
      wheel: new TorusGeometry(0.34, 0.05, 8, 18),
      blob: blobGeo,
    },
    pack: {
      car: ['car0', 'car1', 'car2', 'car3', 'car4'].map((m) => packGeometry(packData, m)),
      truck: ['truck0', 'truck1'].map((m) => packGeometry(packData, m)),
      bus: ['bus0', 'bus1'].map((m) => packGeometry(packData, m)),
      cone: packGeometry(packData, 'cone'),
      barrier: ['barrier', 'barrierRed'].map((m) => packGeometry(packData, m)),
      log: packGeometry(packData, 'log'),
      rockOb: ['rockA', 'rockB'].map((m) => packGeometry(packData, m)),
      pineTrunk: packGeometry(packData, 'pine', 'trunk'),
      pineLeaf: packGeometry(packData, 'pine', 'leaf'),
      treeTrunk: packGeometry(packData, 'tree', 'trunk'),
      treeLeaf: packGeometry(packData, 'tree', 'leaf'),
      palmTrunk: packGeometry(packData, 'palm', 'trunk'),
      palmLeaf: packGeometry(packData, 'palm', 'leaf'),
      bush: packGeometry(packData, 'bush', 'leaf'),
      rockProp: packGeometry(packData, 'rockProp'),
      gate: packGeometry(packData, 'gate'),
      building: ['building0', 'building1', 'building2', 'building3'].map((m) => packGeometry(packData, m)),
      buildingGlow: ['building0', 'building1', 'building2', 'building3'].map((m) => packGeometry(packData, m, 'glow')),
    },
    mat: {
      ramp: new MeshLambertMaterial({ color: 0x2e3450 }),
      // 발광류는 toneMapped: false — ACES 가 네온 순색을 죽이는 것 방지
      rampGlow: new MeshBasicMaterial({ color: 0xb6ff2a, toneMapped: false }),
      // 테마별 램프 (진호 V15 "산에서는 나무 판자 점프대 — 코스 따라 기물도 완전 다르게")
      rampWood: new MeshLambertMaterial({ color: 0x7a5230, emissive: 0x241608 }),
      rampDirt: new MeshLambertMaterial({ color: 0x6e7c3c, emissive: 0x1c2410 }),
      rampMetal: new MeshLambertMaterial({ color: 0x4c5560, emissive: 0x14181f }),
      rampNeon: new MeshLambertMaterial({ color: 0x1c2246, emissive: 0x0a1030 }),
      rampAccWood: new MeshLambertMaterial({ color: 0xc99a5b, emissive: 0x3a2a12 }),
      rampAccDirt: new MeshLambertMaterial({ color: 0x8fb84f, emissive: 0x243311 }),
      rampAccMetal: new MeshBasicMaterial({ color: 0xffc94f, toneMapped: false }),
      rampAccNeon: new MeshBasicMaterial({ color: 0x53f0ff, toneMapped: false }),
      // 💧 스카이 발광 — 어두운 색이라 안 보이던 것 교체 (진호 2026-07-07 "확실하게 잘 보이게, 스카이로")
      puddleWater: new MeshBasicMaterial({ color: 0x53e0ff, transparent: true, opacity: 0.85, toneMapped: false }),
      puddleOil: new MeshBasicMaterial({ color: 0x53e0ff, transparent: true, opacity: 0.85, toneMapped: false }),
      speedRing: new MeshBasicMaterial({ color: 0x53f0ff, toneMapped: false }),
      chip: new MeshBasicMaterial({ color: 0xb6ff2a, toneMapped: false }),
      goldChip: new MeshBasicMaterial({ color: 0xffd24a, toneMapped: false }), // 💰
      barrel: new MeshLambertMaterial({ color: 0xc23b2e }), // 빨간 드럼통
      barrelStripe: new MeshLambertMaterial({ color: 0xf2f4f8 }),
      crate: new MeshLambertMaterial({ color: 0x9a6b3f }), // 나무 상자 (나무기둥 장애물은 기존 trunk 재질 재사용)
      itemTurbo: new MeshBasicMaterial({ color: 0xffc93c, toneMapped: false }), // ⚡ 골드 (진호 2026-07-07 — 칩 라임과 구분)
      // 🌈 슈퍼부스트 — vertexColors 라벤더→핫핑크 그라데이션 (인스타 느낌, 진호 2026-07-07)
      itemSuper: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      itemShield: new MeshBasicMaterial({ color: 0x5fd0ff, toneMapped: false }),
      itemMagnet: new MeshBasicMaterial({ color: 0xff6f9c, toneMapped: false }),
      itemRing: new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, toneMapped: false }),
      tunnel: new MeshLambertMaterial({ color: 0x424a75, side: DoubleSide }),
      tunnelLight: new MeshBasicMaterial({ color: 0xffe9b8, toneMapped: false }),
      tunnelRing: new MeshBasicMaterial({ color: 0xb6ff2a, toneMapped: false }),
      guard: new MeshLambertMaterial({ color: 0xb9c2d8 }),
      neonSign: new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      skyline: new MeshBasicMaterial({ color: 0x584f86 }),
      skylineFar: new MeshBasicMaterial({ color: 0x6f66a0 }),
      trunk: new MeshLambertMaterial({ color: 0x6b4a32 }),
      pineLeaf: new MeshLambertMaterial({ color: 0x2f6b4f }),
      treeLeaf: new MeshLambertMaterial({ color: 0x5a8f4a }),
      bush: new MeshLambertMaterial({ color: 0x4f7a42 }),
      lampPole: new MeshLambertMaterial({ color: 0x3a4056 }),
      lampHead: new MeshBasicMaterial({ color: 0xffe9b8, toneMapped: false }),
      track: new MeshLambertMaterial({ vertexColors: true, map: surfaceNoise }),
      blob: new MeshBasicMaterial({ map: blobShadow, transparent: true, depthWrite: false }),
      packBaked: new MeshLambertMaterial({ vertexColors: true }),
      // 도로 위 정적 장애물 — 새벽/야간에도 도로와 분리 (시인성 — 진호 피드백 계승)
      // emissive 리프트 강화(0x1f1c17→0x3a3229): 어두운 장애물(바위/바리케이드)이 안개 속에서
      // 더 일찍 드러나 밝은 아이템과의 인지 격차 완화 ("장애물이 아이템으로 변신" 착시 — 진호 실폰)
      packObstacle: new MeshLambertMaterial({ vertexColors: true, emissive: 0x3a3229 }),
      // 빌딩 유리창 발광 (밤 도심) — 베이크된 유리색 그대로 자체발광
      buildingGlow: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    },
    tex: { blobShadow, surfaceNoise },
  }
}

export function disposeApexAssets(assets: ApexAssets): void {
  for (const g of Object.values(assets.geo)) g.dispose()
  for (const entry of Object.values(assets.pack)) {
    if (Array.isArray(entry)) for (const g of entry) g.dispose()
    else entry.dispose()
  }
  for (const m of Object.values(assets.mat)) m.dispose()
  for (const t of Object.values(assets.tex)) t.dispose()
}
