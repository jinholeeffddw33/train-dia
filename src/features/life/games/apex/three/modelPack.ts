/**
 * APEX RUSH — CC0 모델 팩 런타임 파서
 * scripts/apex-build-model-pack.mjs 가 구운 apex-pack.bin(.gz) 을 로드해
 * 양자화 해제(int16 pos / int8 normal / uint8 color) 후 BufferGeometry 로 복원.
 *
 * - 네트워크/파싱은 모듈 레벨 1회 캐시 (재시작·재마운트 무비용)
 * - BufferGeometry 는 assets 생성 시마다 새로 만들어 dispose 수명 주기를 assets 와 일치
 *   (WKWebView jetsam 방어 — 게임 언마운트 시 GPU 버퍼 전부 해제)
 */

import { BufferAttribute, BufferGeometry } from 'three'

interface PackPartMeta {
  name: string
  vtx: number
  idxCount: number
  center: [number, number, number]
  half: [number, number, number]
  white?: boolean
  posOff: number
  nrmOff: number
  colOff: number
  idxOff: number
}

interface PackModelMeta {
  size: [number, number, number]
  parts: PackPartMeta[]
}

export interface ApexPackData {
  models: Record<string, PackModelMeta>
  bin: DataView
}

/**
 * 팩 포맷 버전 — scripts/apex-build-model-pack.mjs 의 PACK_VERSION 과 짝.
 * 팩 재생성 시 양쪽 함께 +1. URL 캐시버스터(?v=N)로 스테일 HTTP 캐시 지뢰를 원천 차단하고,
 * manifest 검증으로 이중 방어 (불일치 → packError 재시도 경로, 렌더 크래시 아님).
 */
export const PACK_VERSION = 2

const PACK_URL = '/game/apex/apex-pack.bin'

let packPromise: Promise<ApexPackData> | null = null
// 실패 후 재시도는 HTTP 캐시를 뚫는다 (오염된 캐시 항목 교체)
let bustHttpCache = false

/** 팩 캐시 무효화 — 파싱 이후 단계(지오메트리 복원)에서 실패했을 때 호출 */
export function invalidateApexPack(): void {
  packPromise = null
  bustHttpCache = true
}

async function fetchPackBytes(): Promise<ArrayBuffer> {
  const cacheMode: RequestCache = bustHttpCache ? 'reload' : 'force-cache'
  const bust = `?v=${PACK_VERSION}`
  // CDN 이 octet-stream 을 압축 안 해줄 수 있어 사전 gzip 본을 우선 시도
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const res = await fetch(`${PACK_URL}.gz${bust}`, { cache: cacheMode })
      if (res.ok && res.body) {
        // CDN 이 Content-Encoding 을 붙여 이미 투명 해제된 경우 매직으로 판별
        const raw = await res.arrayBuffer()
        const head = new Uint8Array(raw, 0, 2)
        if (head[0] === 0x1f && head[1] === 0x8b) {
          const ds = new DecompressionStream('gzip')
          const stream = new Response(new Blob([raw]).stream().pipeThrough(ds))
          return await stream.arrayBuffer()
        }
        return raw
      }
    } catch {
      // gz 실패 → 원본 폴백
    }
  }
  const res = await fetch(PACK_URL + bust, { cache: cacheMode })
  if (!res.ok) throw new Error(`model pack fetch failed: ${res.status}`)
  return res.arrayBuffer()
}

function parsePack(buf: ArrayBuffer): ApexPackData {
  const view = new DataView(buf)
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 8))
  if (magic !== 'APXPACK1') throw new Error('bad model pack magic')
  const jsonLen = view.getUint32(8, true)
  const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 16, jsonLen))) as {
    version: number
    models: Record<string, PackModelMeta>
  }
  if (manifest.version !== PACK_VERSION) {
    throw new Error(`model pack version mismatch: ${manifest.version} !== ${PACK_VERSION}`)
  }
  const pad = (4 - (jsonLen % 4)) % 4
  const binBase = 16 + jsonLen + pad
  return { models: manifest.models, bin: new DataView(buf, binBase) }
}

/** 팩 로드 성공 후 호출 — 다음 세션의 재시도 플래그 원복 */
function markPackHealthy(): void {
  bustHttpCache = false
}

/** 팩 로드 (모듈 캐시 — 실패 시 다음 호출이 캐시 무시하고 재시도) */
export function loadApexPack(): Promise<ApexPackData> {
  if (!packPromise) {
    packPromise = fetchPackBytes()
      .then(parsePack)
      .then((pack) => {
        markPackHealthy()
        return pack
      })
      .catch((err) => {
        invalidateApexPack()
        throw err
      })
  }
  return packPromise
}

/** 파트 1개 → BufferGeometry (호출자가 dispose 책임) */
function buildPartGeometry(pack: ApexPackData, part: PackPartMeta): BufferGeometry {
  const { bin } = pack
  const base = bin.byteOffset
  const geo = new BufferGeometry()

  // 포지션 dequantize → float32
  const qpos = new Int16Array(bin.buffer, base + part.posOff, part.vtx * 3)
  const pos = new Float32Array(part.vtx * 3)
  for (let i = 0; i < part.vtx * 3; i += 3) {
    pos[i] = part.center[0] + (qpos[i] / 32767) * part.half[0]
    pos[i + 1] = part.center[1] + (qpos[i + 1] / 32767) * part.half[1]
    pos[i + 2] = part.center[2] + (qpos[i + 2] / 32767) * part.half[2]
  }
  geo.setAttribute('position', new BufferAttribute(pos, 3))

  // 노멀 int8 normalized (GPU 에서 [-1,1] 복원)
  const nrm = new Int8Array(bin.buffer, base + part.nrmOff, part.vtx * 3).slice()
  geo.setAttribute('normal', new BufferAttribute(nrm, 3, true))

  if (!part.white && part.colOff >= 0) {
    const col = new Uint8Array(bin.buffer, base + part.colOff, part.vtx * 3).slice()
    geo.setAttribute('color', new BufferAttribute(col, 3, true))
  }

  const idx = new Uint16Array(bin.buffer, base + part.idxOff, part.idxCount).slice()
  geo.setIndex(new BufferAttribute(idx, 1))
  return geo
}

/** 모델의 특정 파트(기본 'all') 지오메트리 */
export function packGeometry(pack: ApexPackData, model: string, part = 'all'): BufferGeometry {
  const meta = pack.models[model]
  if (!meta) throw new Error(`pack model missing: ${model}`)
  const p = meta.parts.find((x) => x.name === part)
  if (!p) throw new Error(`pack part missing: ${model}/${part}`)
  return buildPartGeometry(pack, p)
}
