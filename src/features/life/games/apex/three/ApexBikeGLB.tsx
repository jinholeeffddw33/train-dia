'use client'

/**
 * APEX RUSH — 실사 GLB 자전거 (산타크루즈 V10 다운힐) + 바퀴 회전 + 조향 + 프레임 컬러
 *
 * ★카메라 밀착 1인칭(진호 2026-07-06): playing 은 root 를 카메라 트랜스폼에 복사 → 자전거가
 *   화면 하단 고정. ready 는 트랙 위 라이더 지점(메뉴 쇼케이스 — 드래그 회전/줌은 ApexCanvas).
 *  - 바퀴: 이름(_M_Wheel_*)으로 수집 → 월드 z 앞/뒤 클러스터 → 허브 pivot → 속도 비례 회전.
 *  - 조향: 핸들바+스템+앞포크(Fox40)+앞바퀴를 스템(헤드튜브) 축으로 회전 (최대 20°).
 *  - 컬러: M_Frame 재질만 교체 — 전 컬러 균일 단색 틴트(albedo map 제거, 노멀/메탈러프 유지로
 *    도장 질감 보존). 원본 텍스처의 실브랜드 워드마크가 map 제거로 함께 사라져 모든 컬러 일관
 *    (진호 2026-07-07 "레드일 때만 로고 보여서 이상"). 실시간 미리보기(메뉴 칩 클릭 즉시).
 *  - 점프: 공중에서 노즈 피치(상승=앞바퀴 들림/하강=숙임) + 자전거를 아래로 내려 더 보이게
 *    (진호 2026-07-07 "점프 시 자전거 더 보이고 회전"). 카메라 시선 상승은 GameScene 이 담당.
 *  - 팔: 제거 확정 (진호 2026-07-07 "그냥 팔 빼버려").
 *
 * ⚠️ clone(true)은 원본 GLTF 의 geometry/material 을 공유 — dispose 금지(색 실종 사고 2026-07-06).
 *   우리가 만든 틴트 clone 재질만 언마운트 시 dispose.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Euler, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { ApexSim } from '../engine/sim'
import type { TrickKind } from '../engine/types'

const BIKE_URL = '/game/apex/models/santa-cruz-dh.bike.glb'

// ══ 배치 정합 (게임 육안 튜닝값) ══
const SCALE = 1.2
const YAW = 0
/** playing(1인칭): 카메라 로컬 오프셋 — 자전거 아래(-Y)+앞(-Z).
 *  진호 2026-07-07 가로: "스템만 보임, 탑튜브 프레임도 보이게" — 카메라 쪽으로 당겨(-Z 0.94→0.78,
 *  더 크게=프레임 인) + 살짝 위로(-Y 1.15→1.02, 화면 하단에 안 붙게). */
const CAM_BIKE_Y = -1.02
const CAM_BIKE_Z = -0.78
/** ready(쇼케이스): 바닥 정합 */
const READY_Y = 0.78
const WHEEL_DIR = 1
/** 조향 최대각 (진호 "최대 20도") + lean→조향 계수 */
const STEER_MAX = 0.35
const STEER_K = 1.4

useGLTF.preload(BIKE_URL, '/draco/')

const DEG = Math.PI / 180
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
/**
 * 🤸 에어트릭 회전 — bg=자전거 그룹, steer=핸들/앞포크/앞바퀴 그룹. p=진행(0~1), dir=±1(좌우).
 *  p=1(착지)에서 모든 트릭이 정면 복귀(backflip 2π=0, whip/tabletop sin(π)=0)해 안전 착지.
 *  ★핵심(진호 2026-07-07): 라이더가 핸들을 잡고 있으므로 앞바퀴(steer)는 프레임(bg) 회전을 그대로
 *   따라가지 않고 '카운터'로 틀어져 진행방향/위쪽에 가깝게 남는다 — 프레임만 크게 돈다.
 */
function applyTrick(bg: Group, steer: Group, kind: TrickKind, p: number, dir: number): void {
  if (kind === 'backflip') {
    // 뒤로 한바퀴 — 노즈업(+x) 방향으로 2π
    bg.rotation.set(Math.PI * 2 * easeInOut(p), YAW, 0)
    steer.rotation.y = 0
  } else if (kind === 'whip') {
    // 프레임을 옆으로 105°(yaw) 던졌다 복귀 + 살짝 눕기 (진호 2026-07-07 90°→105°). 앞바퀴는 60°
    //   카운터 → 프레임(105°) 대비 월드 ~45°(대각선)로 진행방향 쪽을 봄 (진호 "완전 앞은 아니고 대각선").
    const s = Math.sin(Math.PI * p)
    bg.rotation.set(0, YAW + s * 105 * DEG * dir, s * 0.22 * dir)
    steer.rotation.y = -s * 60 * DEG * dir
  } else if (kind === 'tabletop') {
    // 테이블탑 — 자전거를 옆으로 80° 눕힘(90은 과함) + 앞바퀴는 눕는 반대(카운터)로 55° 틀어 위를 봄
    //   (진호 2026-07-07 50→55°, 5° 더 기울임).
    const s = Math.sin(Math.PI * p)
    bg.rotation.set(0, YAW, s * 80 * DEG * dir)
    steer.rotation.y = -s * 55 * DEG * dir
  } else if (kind === 'tailwhip') {
    // 테일휩(진호 2026-07-07 "핸들은 가만히, 자전거가 한바퀴") — 라이더가 핸들을 잡은 채 프레임(+뒷바퀴)이
    //   한바퀴. bg 를 yaw 360° 돌리되 steer(핸들+앞포크+앞바퀴)를 같은 각 역방향으로 상쇄 → 핸들바는
    //   월드에서 정면 고정, 프레임만 스윙. p=1 에서 rot=2π → 프레임·핸들 모두 정면 복귀(안전 착지).
    const rot = Math.PI * 2 * easeInOut(p) * dir
    bg.rotation.set(0, YAW + rot, 0)
    steer.rotation.y = -rot
  } else {
    // 바스핀(진호 2026-07-07 "핸들바만 회전, 연결된 앞바퀴·서스펜션도 같이") — 프레임은 정면 유지,
    //   핸들바만 헤드튜브 축으로 한바퀴. steer 그룹이 핸들+앞포크(Fox40 서스펜션)+앞바퀴를 묶고 있어
    //   축 연동이 자연 충족. 프레임은 아주 살짝만 기울여 역동감. p=1 에서 steer=2π → 정면 복귀.
    bg.rotation.set(0, YAW, -0.05 * Math.sin(Math.PI * p) * dir)
    steer.rotation.y = Math.PI * 2 * easeInOut(p) * dir
  }
}

interface ApexBikeGLBProps {
  sim: ApexSim
  /** 프레임 컬러 hex — BIKE_COLORS 의 original 이면 원본 도장 유지 */
  bikeColor: number
}

export function ApexBikeGLB({ sim, bikeColor }: ApexBikeGLBProps) {
  const camera = useThree((s) => s.camera)
  const rootRef = useRef<Group>(null)
  const bikeGroupRef = useRef<Group>(null)
  const bikeGLTF = useGLTF(BIKE_URL, '/draco/')

  const { bike, steerGroup, frontHub, rearHub, wheelRadius, frameMeshes, frameOrigMat } = useMemo(() => {
    const c = bikeGLTF.scene.clone(true)
    c.updateWorldMatrix(true, true)
    const box = new Box3()
    const ctr = new Vector3()

    const wheelMeshes: Mesh[] = []
    const steerMeshes: Mesh[] = []
    const caliperMeshes: Mesh[] = []
    const frames: Mesh[] = []
    c.traverse((o) => {
      if (!(o instanceof Mesh)) return
      o.castShadow = true
      // 바퀴(M_Wheel/rim) + 디스크 로터(M_ShimanoBrake) — 로터는 허브에 붙어 바퀴와 함께 회전/조향
      //   (진호 2026-07-07 "앞 로터가 안 붙어있다"). 스핀하는 디스크만 허브로.
      if (/wheel|tyre|tire|rim|shimanobrake/i.test(o.name)) wheelMeshes.push(o)
      // 조향 어셈블리(steer): 핸들바+그립+스템+앞포크(Fox40) + 콕핏(브레이크레버/시프터) — 조향을 따른다.
      //   FoxDHX2=리어쇼크 제외(프레임 분리 사고).
      if (/handlebar|stem|fox40|brakelever|shifter/i.test(o.name)) steerMeshes.push(o)
      // 브레이크 캘리퍼 — 앞은 포크 장착(조향 따름)/뒤는 프레임 고정. z 로 앞만 골라 steer 에 (아래).
      if (/brakecaliper/i.test(o.name)) caliperMeshes.push(o)
      if (/_M_Frame_/i.test(o.name)) frames.push(o)
    })

    // 앞/뒤 바퀴 허브 pivot
    const front = new Group()
    const rear = new Group()
    let radius = 0.34
    // 캘리퍼 앞/뒤 판별용 허브 z (아래 캘리퍼 분류에서 사용)
    let frontZ = 0
    let rearZ = 0
    if (wheelMeshes.length >= 2) {
      const entries = wheelMeshes.map((m) => {
        box.setFromObject(m)
        return { m, z: box.getCenter(ctr.clone()).z, box: box.clone() }
      })
      const zs = entries.map((e) => e.z)
      const midZ = (Math.min(...zs) + Math.max(...zs)) / 2
      const g1 = entries.filter((e) => e.z < midZ)
      const g2 = entries.filter((e) => e.z >= midZ)
      const centerOf = (g: typeof entries) => {
        const v = new Vector3()
        g.forEach((e) => v.add(e.box.getCenter(ctr.clone())))
        return v.multiplyScalar(1 / Math.max(1, g.length))
      }
      front.position.copy(centerOf(g1))
      rear.position.copy(centerOf(g2))
      frontZ = front.position.z
      rearZ = rear.position.z
      c.add(front, rear)
      g1.forEach((e) => front.attach(e.m))
      g2.forEach((e) => rear.attach(e.m))
      const wb = new Box3().setFromObject(g1.length ? front : rear)
      radius = Math.max(0.1, (wb.max.y - wb.min.y) / 2)
    }

    // 조향 그룹 — 회전축 = 스템(헤드튜브) 위치 (앞바퀴 축이면 스템이 궤도 회전 → 분리 사고)
    const steer = new Group()
    const stemMeshes = steerMeshes.filter((m) => /stem/i.test(m.name))
    if (stemMeshes.length) {
      const sb = new Box3()
      stemMeshes.forEach((m, i) => {
        const b = new Box3().setFromObject(m)
        if (i === 0) sb.copy(b); else sb.union(b)
      })
      steer.position.copy(sb.getCenter(new Vector3()))
    } else {
      steer.position.copy(front.position)
    }
    c.add(steer)
    steer.attach(front)
    steerMeshes.forEach((m) => steer.attach(m))

    // 앞 브레이크 캘리퍼만 조향 그룹으로 (뒤 캘리퍼는 프레임 고정 = 본체 유지). 캘리퍼는 스핀 안 하므로
    //   허브(front)가 아닌 steer 에 붙여 조향만 따르게 한다 (진호 2026-07-07 "앞 캘리퍼가 살짝 떠있다").
    if (caliperMeshes.length && frontZ !== rearZ) {
      const cb = new Box3()
      const cc = new Vector3()
      caliperMeshes.forEach((m) => {
        const z = cb.setFromObject(m).getCenter(cc).z
        if (Math.abs(z - frontZ) <= Math.abs(z - rearZ)) steer.attach(m)
      })
    }

    // 프레임 원본 재질 (전 프레임 메시가 M_Frame 하나를 공유)
    const om = frames[0]?.material
    const origMat = (om instanceof MeshStandardMaterial) ? om : null

    return { bike: c, steerGroup: steer, frontHub: front, rearHub: rear, wheelRadius: radius, frameMeshes: frames, frameOrigMat: origMat }
  }, [bikeGLTF.scene])

  // ── 프레임 컬러 실시간 적용 — 틴트 재질은 색상별 1회 생성 후 캐시 ──
  const tintCache = useRef(new Map<number, MeshStandardMaterial>())
  useEffect(() => {
    if (!frameOrigMat) return
    // 전 컬러 균일 틴트 — albedo(map)만 제거해 단색, 노멀/러프/메탈 맵은 유지(도장 질감·굴곡 보존).
    //   원본 텍스처의 실브랜드 워드마크가 이 map 제거로 함께 사라져 모든 컬러가 일관 (진호 2026-07-07).
    let mat = tintCache.current.get(bikeColor)
    if (!mat) {
      mat = frameOrigMat.clone()
      mat.map = null
      mat.color.setHex(bikeColor)
      tintCache.current.set(bikeColor, mat)
    }
    frameMeshes.forEach((m) => { m.material = mat as MeshStandardMaterial })
  }, [bikeColor, frameMeshes, frameOrigMat])

  // 언마운트: 우리가 만든 틴트 clone 만 dispose (원본/공유 리소스는 건드리지 않음)
  useEffect(() => {
    const cache = tintCache.current
    return () => {
      cache.forEach((m) => m.dispose())
      cache.clear()
    }
  }, [])

  const poseRef = useRef({ s: 0, x: 0, z: 0, lean: 0, speed: 0 })
  const spinRef = useRef(0)
  /** 공중 정도(0~1 스무딩) + 노즈 피치(스무딩) — 점프 연출 (진호 2026-07-07) */
  const airRef = useRef(0)
  const pitchRef = useRef(0)
  /** 트릭 3인칭 배치 블렌드용 임시 객체 (매 프레임 new 금지) */
  const tmp = useMemo(() => ({ v: new Vector3(), q: new Quaternion(), e: new Euler(0, 0, 0, 'YXZ') }), [])

  useFrame((_, delta) => {
    const root = rootRef.current
    const bg = bikeGroupRef.current
    if (!root || !bg) return
    const st = sim.state
    const pose = sim.getRenderPose(poseRef.current)

    if (st.phase === 'playing') {
      airRef.current += ((st.airborne ? 1 : 0) - airRef.current) * Math.min(1, 6 * delta)
      const air = airRef.current
      const tc = st.trickCam
      if (st.airTrick || tc > 0.001) {
        // 🤸 에어트릭 = 3인칭 (진호 2026-07-07 "1인칭이라 앞부분만 보여, 뒷바퀴가 안 보임 → 3인칭으로").
        //   자전거를 카메라 glue 에서 풀어 '트랙 위 실제 위치/방향'으로 tc 블렌드 → 카메라(GameScene)가
        //   뒤+위+옆에서 자전거 전체를 본다. tc 스무딩이라 이륙/착지 시 튐 없이 1인칭↔3인칭 전환.
        const smp = sim.track.sampleAt(pose.s)
        root.rotation.order = 'YXZ'
        tmp.v.set(smp.px + smp.rightX * pose.x, smp.py + pose.z + 0.35, smp.pz + smp.rightZ * pose.x)
        tmp.e.set(-Math.atan(smp.grade) * 0.8, Math.atan2(-smp.dirX, -smp.dirZ), 0)
        tmp.q.setFromEuler(tmp.e)
        root.position.lerpVectors(camera.position, tmp.v, tc)
        root.quaternion.copy(camera.quaternion).slerp(tmp.q, tc)
        // bg 오프셋: 1인칭(tc=0)이면 카메라 콕핏 오프셋, 3인칭(tc=1)이면 0(자전거가 root 위치)
        bg.position.set(0, CAM_BIKE_Y * (1 - tc), CAM_BIKE_Z * (1 - tc))
        if (st.airTrick) {
          const p = st.trickDur > 0 ? Math.min(1, st.trickTime / st.trickDur) : 0
          applyTrick(bg, steerGroup, st.airTrick, p, st.trickDir)
        } else {
          // 착지 후 tc 감소 중 — 트릭 회전 해제(정면 복귀), 조향은 아래 lean 로직이 잡음
          bg.rotation.set(0, YAW, -pose.lean * 0.5)
        }
      } else {
        // 1인칭 헬멧캠 — 자전거는 카메라에 밀착 glue + 점프 노즈 피치.
        //   자전거 정면 = 카메라 -Z(=bg 로컬 -Z). rotation.x 양수 → 앞이 올라감(노즈 업).
        //   상승(vz>0)=앞바퀴 들림, 하강(vz<0)=앞으로 숙임 → 실제 점프 궤적 자세.
        root.position.copy(camera.position)
        root.quaternion.copy(camera.quaternion)
        const targetPitch = st.airborne ? Math.max(-0.42, Math.min(0.5, st.vz * 0.045)) : 0
        pitchRef.current += (targetPitch - pitchRef.current) * Math.min(1, 8 * delta)
        // 공중엔 자전거를 위로 올리고 살짝 당겨 프레임에 더 크게 들어오게 (진호 "점프 시 더 보이게")
        bg.position.set(0, CAM_BIKE_Y + air * 0.28, CAM_BIKE_Z + air * 0.14)
        bg.rotation.set(pitchRef.current, YAW, -pose.lean * 0.5)
      }
    } else {
      const smp = sim.track.sampleAt(pose.s)
      root.position.set(
        smp.px + smp.rightX * pose.x,
        smp.py + pose.z + READY_Y,
        smp.pz + smp.rightZ * pose.x,
      )
      root.rotation.order = 'YXZ'
      root.rotation.set(
        -Math.atan(smp.grade) * 0.8,
        Math.atan2(-smp.dirX, -smp.dirZ),
        -pose.lean * 0.55,
      )
      bg.position.set(0, 0, 0)
      bg.rotation.set(0, YAW, 0)
    }

    // 조향 — 핸들+앞포크+앞바퀴 y회전 (최대 20°). 트릭 중엔 applyTrick 이 steerGroup 을 잡으므로 덮어쓰지 않음.
    if (!(st.phase === 'playing' && st.airTrick)) {
      steerGroup.rotation.y = Math.max(-STEER_MAX, Math.min(STEER_MAX, -pose.lean * STEER_K))
    }

    // 바퀴 구름 — 속도 비례
    const spin = WHEEL_DIR * (pose.speed / wheelRadius) * delta
    spinRef.current -= spin
    frontHub.rotation.x = spinRef.current
    rearHub.rotation.x = spinRef.current
  }, -9)

  return (
    <group ref={rootRef}>
      <group ref={bikeGroupRef} scale={SCALE}>
        <primitive object={bike} />
      </group>
    </group>
  )
}
