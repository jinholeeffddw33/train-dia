/**
 * APEX RUSH — 스테이지 테마 팔레트 (하늘/포그/도로/라이트/식생)
 * V15 진호 확정 4테마: 산길=새벽 청보라, 자연=한낮 초원, 도심=노을, 사이버=심야 네온.
 * 스테이지 경계에서 BIOME_BLEND 구간 동안 lerp (다음 스테이지의 실제 테마 기준).
 */

import { BIOME_BLEND } from '../constants'
import { biomeAt, biomeProgress } from './track'
import type { BiomeId, BiomePalette } from './types'

export const PALETTES: Record<BiomeId, BiomePalette> = {
  // 산길 — 새벽 청보라 산악
  mountain: {
    skyTop: 0x2b2f63,
    skyHorizon: 0x8f7bd0,
    skyBottom: 0xe0a9c8,
    fog: 0x9d8ad2,
    road: 0x4b4560,
    roadLine: 0xcfc7ee,
    ground: 0x3b5a52,
    ambient: 0x8d86c9,
    sun: 0xffe3c2,
    sunDisc: 0xffd9a0,
    sunAzimuth: 0.22,
    sunElevation: 0.30,
    night: 0.15,
    leafPine: 0x2f6b4f,
    leafTree: 0x5a8f4a,
    bushCol: 0x4f7a42,
  },
  // 자연 — 한낮 초원/숲 (맑은 파란 하늘 + 싱그러운 초록)
  nature: {
    skyTop: 0x2f6fd0,
    skyHorizon: 0x9fd4f2,
    skyBottom: 0xeaf6ff,
    fog: 0xbfe0ee,
    road: 0x4a4e5e,
    roadLine: 0xf2f7ff,
    ground: 0x5f9a44,
    ambient: 0xbcd8e8,
    sun: 0xfff4dd,
    sunDisc: 0xffffff,
    sunAzimuth: 0.38,
    sunElevation: 0.75,
    night: 0,
    leafPine: 0x2f7a4a,
    leafTree: 0x62a83f,
    bushCol: 0x578f3a,
  },
  // 도심 — 노을 지는 저녁 도심 (오렌지 하늘 + 빌딩 실루엣)
  city: {
    skyTop: 0x33356e,
    skyHorizon: 0xf58e6d,
    skyBottom: 0xffc46b,
    fog: 0xd08a70,
    road: 0x3c3648,
    roadLine: 0xffe1b8,
    ground: 0x4a4048,
    ambient: 0xc98d76,
    sun: 0xffc48a,
    sunDisc: 0xff9e4f,
    sunAzimuth: 0.5,
    sunElevation: 0.14,
    night: 0.1,
    leafPine: 0x3f6b3c,
    leafTree: 0x5f8a3f,
    bushCol: 0x527a38,
  },
  // 숲속 흙길 — MTB 다운힐 파크 (늦은 오후 숲, 흙 트레일 — 유저 피드백 ⑩)
  dirt: {
    skyTop: 0x3a6ea8,
    skyHorizon: 0xbcd8b0,
    skyBottom: 0xe8f0d8,
    fog: 0xaac4a0,
    road: 0x6b4f35,      // 흙 트레일
    roadLine: 0x85684a,  // 희미한 바큇자국 톤
    ground: 0x4a6b33,
    ambient: 0xa8c493,
    sun: 0xffedc8,
    sunDisc: 0xfff3d0,
    sunAzimuth: 0.3,
    sunElevation: 0.5,
    night: 0,
    leafPine: 0x2a6342,
    leafTree: 0x4f8a38,
    bushCol: 0x44712f,
  },
  // 사이버 미래도시 — 심야 네온 (마젠타/시안, 어두운 하늘 + 발광 도로라인)
  cyber: {
    skyTop: 0x070a1e,
    skyHorizon: 0x2a1a55,
    skyBottom: 0x461f66,
    fog: 0x191238,
    road: 0x232338,
    roadLine: 0x53f0ff,
    ground: 0x121225,
    ambient: 0x5a4a9e,
    sun: 0xa08cff,
    sunDisc: 0xc9b6ff,
    sunAzimuth: 0.78,
    sunElevation: 0.55,
    night: 1,
    leafPine: 0x1e3d46,
    leafTree: 0x28444f,
    bushCol: 0x223a42,
  },
}

/** hex → [r,g,b] 0~1 */
function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 두 hex 색 lerp → hex */
export function lerpColor(a: number, b: number, t: number): number {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return (
    (Math.round(lerp(ar, br, t) * 255) << 16) |
    (Math.round(lerp(ag, bg, t) * 255) << 8) |
    Math.round(lerp(ab, bb, t) * 255)
  )
}

/** s 기준 다음 스테이지의 테마 (스테이지 순환은 track.stageAt 이 결정) */
function nextBiomeAt(s: number, remain: number): BiomeId {
  return biomeAt(Math.max(0, s) + remain + 1)
}

/**
 * s 위치의 블렌딩된 팔레트.
 * 세그먼트 끝 BIOME_BLEND 구간에서 다음 바이옴으로 서서히 전환.
 */
export function paletteAt(s: number, out: BiomePalette): BiomePalette {
  const prog = biomeProgress(Math.max(0, s))
  const from = PALETTES[prog.id]
  const remain = prog.length - prog.into
  if (remain > BIOME_BLEND) {
    Object.assign(out, from)
    return out
  }
  const to = PALETTES[nextBiomeAt(s, remain)]
  const t = 1 - remain / BIOME_BLEND
  out.skyTop = lerpColor(from.skyTop, to.skyTop, t)
  out.skyHorizon = lerpColor(from.skyHorizon, to.skyHorizon, t)
  out.skyBottom = lerpColor(from.skyBottom, to.skyBottom, t)
  out.fog = lerpColor(from.fog, to.fog, t)
  out.road = lerpColor(from.road, to.road, t)
  out.roadLine = lerpColor(from.roadLine, to.roadLine, t)
  out.ground = lerpColor(from.ground, to.ground, t)
  out.ambient = lerpColor(from.ambient, to.ambient, t)
  out.sun = lerpColor(from.sun, to.sun, t)
  out.sunDisc = lerpColor(from.sunDisc, to.sunDisc, t)
  out.sunAzimuth = lerp(from.sunAzimuth, to.sunAzimuth, t)
  out.sunElevation = lerp(from.sunElevation, to.sunElevation, t)
  out.night = lerp(from.night, to.night, t)
  out.leafPine = lerpColor(from.leafPine, to.leafPine, t)
  out.leafTree = lerpColor(from.leafTree, to.leafTree, t)
  out.bushCol = lerpColor(from.bushCol, to.bushCol, t)
  return out
}
