/**
 * APEX RUSH — 자전거 GLB awaitable preload
 * useGLTF(drei)는 preload 가 fire-and-forget(void)이라 "언제 준비됐는지"를 await 할 수 없다.
 * 그 결과 메뉴/씬은 modelPack 만 기다리고 뜬 뒤, 자전거 GLB(2.4MB draco+webp)가 뒤늦게
 * 붙으며 pop-in(진호 2026-07-07 "자전거 불러오는데 시간 걸림"). 여기서 같은 GLB 를 직접
 * 로드해 HTTP 캐시를 데운 뒤 resolve → 로딩 베일이 자전거까지 준비된 후 걷힌다. drei 의
 * useGLTF 는 뒤이어 브라우저 캐시에서 즉시 파싱(재다운로드 0)한다.
 *
 * ⚠️ 실패해도 resolve — 게이트를 영영 막지 않는다(useGLTF 가 자체 재시도/에러 처리).
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export const BIKE_MODEL_URL = '/game/apex/models/santa-cruz-dh.bike.glb'

let promise: Promise<void> | null = null

export function preloadBikeModel(): Promise<void> {
  if (promise) return promise
  promise = new Promise<void>((resolve) => {
    if (typeof window === 'undefined') { resolve(); return }
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)
    const done = () => { draco.dispose(); resolve() }
    loader.load(BIKE_MODEL_URL, done, undefined, done)
  })
  return promise
}
