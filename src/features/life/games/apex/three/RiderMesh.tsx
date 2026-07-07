'use client'

/**
 * APEX RUSH — 라이더 + 로드바이크 (절차 모델 V2, 에셋 0)
 *
 * V2 전면 리빌드 (진호: "자전거도 부족해 — 최대로"):
 *  - 진짜 로드바이크 지오메트리: 탑/다운/시트/헤드튜브 + 좌우 시트스테이/체인스테이/포크 쌍
 *    + 드롭바 후크 + 스템 + 크랭크셋(체인링/크랭크암/페달) + 림/스포크/허브 바퀴
 *  - 페달링 2링크 IK: 크랭크 각도 → 페달 위치 → 무릎이 실제로 굽혀지는 다리 (실사감의 핵심)
 *  - 팔도 IK — 어깨(터킹 연동)→핸들바 고정, 팔꿈치 자연 굽힘
 *  - 모델 로컬 -Z = 전방, 바닥 y=0, 루트 스케일 1.25 (V3 존재감 유지)
 *
 * 바퀴/크랭크 회전, 린(롤), 경사 피치, 에어 자세, 크래시 연출 포함.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Group, Matrix4,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, Quaternion,
  SphereGeometry, TorusGeometry, Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ApexSim } from '../engine/sim'
import type { ApexAssets } from './assets'
import { CRASH_SLOWMO_DURATION } from '../constants'

interface RiderMeshProps {
  sim: ApexSim
  assets: ApexAssets
  /** 커스터마이즈 프레임 색 (hex) */
  bikeColor: number
}

// ── 바이크 앵커 (로컬 좌표, 바닥 y=0) ──
const FRONT_AXLE = new Vector3(0, 0.34, -0.52)
const REAR_AXLE = new Vector3(0, 0.34, 0.48)
const BB = new Vector3(0, 0.30, 0.05) // 바텀브래킷
const HEAD_TOP = new Vector3(0, 0.70, -0.37)
const HEAD_BOT = new Vector3(0, 0.585, -0.425)
const SEAT_CLUSTER = new Vector3(0, 0.70, 0.22)
const SADDLE = new Vector3(0, 0.815, 0.25)
const BAR_CENTER = new Vector3(0, 0.755, -0.44)
const CRANK_R = 0.17
const HIPS = new Vector3(0, 0.82, 0.17)
// bodyRef(힙 피벗) 로컬 오프셋
const SHOULDER_L = new Vector3(-0.13, 0.27, -0.27)
const SHOULDER_R = new Vector3(0.13, 0.27, -0.27)
const HAND_L = new Vector3(-0.135, 0.765, -0.42) // 월드(바이크 로컬) — 브레이크 후드 위
const HAND_R = new Vector3(0.135, 0.765, -0.42)
// 힙→페달 최대 거리 0.704 / 어깨→핸들 최대 0.54 — 총장이 이를 넘어야 IK 가 실제로 굽는다
// (0.27+0.27 / 0.20+0.20 이던 초기값은 스트로크 절반에서 완전 신전 + 세그먼트 고무줄 — 적대 리뷰 확정)
const THIGH_LEN = 0.36
const SHIN_LEN = 0.36
const UPPER_ARM_LEN = 0.28
const FOREARM_LEN = 0.28

const UP = new Vector3(0, 1, 0)

/** 정적 튜브 배치 계산 (position/quaternion/scale — JSX 프롭용, 굵기는 r 필드가 덮음) */
function tubeBetween(p1: Vector3, p2: Vector3) {
  const dir = new Vector3().subVectors(p2, p1)
  const len = dir.length()
  const quat = new Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
  return {
    position: new Vector3().addVectors(p1, p2).multiplyScalar(0.5),
    quaternion: quat,
    scale: new Vector3(1, len, 1),
  }
}

/** 동적 세그먼트 갱신 (스크래치 재사용, GC 0) */
const segDir = new Vector3()
function updateSegment(mesh: Mesh | null, p1: Vector3, p2: Vector3, r: number): void {
  if (!mesh) return
  segDir.subVectors(p2, p1)
  const len = segDir.length() || 1e-4
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5)
  mesh.scale.set(r, len, r)
  mesh.quaternion.setFromUnitVectors(UP, segDir.multiplyScalar(1 / len))
}

/** 2링크 IK — 시작(root)→목표(target), 굽힘 방향 bendDir 로 중간 관절 계산 */
const ikAlong = new Vector3()
const ikPerp = new Vector3()
function solveIK(root: Vector3, target: Vector3, l1: number, l2: number, bendDir: Vector3, outJoint: Vector3): void {
  ikAlong.subVectors(target, root)
  let d = ikAlong.length()
  const dMax = l1 + l2 - 1e-3
  const dMin = Math.abs(l1 - l2) + 1e-3
  if (d > dMax) d = dMax
  else if (d < dMin) d = dMin
  ikAlong.normalize()
  const a1 = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a1 * a1))
  // bendDir 를 along 에 직교화
  ikPerp.copy(bendDir).addScaledVector(ikAlong, -bendDir.dot(ikAlong))
  if (ikPerp.lengthSq() < 1e-8) ikPerp.set(0, 0, -1)
  ikPerp.normalize()
  outJoint.copy(root).addScaledVector(ikAlong, a1).addScaledVector(ikPerp, h)
}

// 프레임별 스크래치
const hipWorld = new Vector3()
const footPos = new Vector3()
const kneePos = new Vector3()
const shoulderPos = new Vector3()
const elbowPos = new Vector3()
const bendLeg = new Vector3(0, 0.35, -1)
const bendArmL = new Vector3(-0.5, -1, -0.15)
const bendArmR = new Vector3(0.5, -1, -0.15)

export function RiderMesh({ sim, assets, bikeColor }: RiderMeshProps) {
  const rootRef = useRef<Group>(null)
  const bikeRef = useRef<Group>(null)
  const wheelFRef = useRef<Group>(null)
  const wheelRRef = useRef<Group>(null)
  const crankRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const blobRef = useRef<Mesh>(null)
  const shieldRef = useRef<Mesh>(null)
  // 다리/팔 동적 세그먼트
  const thighL = useRef<Mesh>(null)
  const thighR = useRef<Mesh>(null)
  const shinL = useRef<Mesh>(null)
  const shinR = useRef<Mesh>(null)
  const kneeL = useRef<Mesh>(null)
  const kneeR = useRef<Mesh>(null)
  const shoeL = useRef<Mesh>(null)
  const shoeR = useRef<Mesh>(null)
  const pedalL = useRef<Mesh>(null)
  const pedalR = useRef<Mesh>(null)
  const upperArmL = useRef<Mesh>(null)
  const upperArmR = useRef<Mesh>(null)
  const foreArmL = useRef<Mesh>(null)
  const foreArmR = useRef<Mesh>(null)
  const elbowL = useRef<Mesh>(null)
  const elbowR = useRef<Mesh>(null)
  /** 크랭크 각 누적 (페달/다리 IK 공유) */
  const crankAngleRef = useRef(0)
  /** 렌더 보간 포즈 (스크래치) */
  const poseRef = useRef({ s: 0, x: 0, z: 0, lean: 0, speed: 0 })

  const mats = useMemo(() => {
    // 프레임만 Phong — 금속 하이라이트 (나머지는 씬 통일 Lambert)
    const frame = new MeshPhongMaterial({ color: new Color(bikeColor), shininess: 90, specular: 0x8a8f99 })
    const dark = new MeshLambertMaterial({ color: 0x2c3040 })
    const silver = new MeshLambertMaterial({ color: 0x9aa2ae })
    const tire = new MeshLambertMaterial({ color: 0x1f2229 })
    const skin = new MeshLambertMaterial({ color: 0xe4b294 })
    const suit = new MeshLambertMaterial({ color: 0x262b3d }) // 빕숏
    const jersey = new MeshLambertMaterial({ color: new Color(bikeColor).multiplyScalar(0.85) })
    const helmet = new MeshLambertMaterial({ color: 0xeef1f5 })
    const helmetAccent = new MeshLambertMaterial({ color: new Color(bikeColor).multiplyScalar(0.9) })
    const shoe = new MeshLambertMaterial({ color: 0xf2f4f8 })
    const goggle = new MeshLambertMaterial({ color: 0x14161f })
    const glow = new MeshBasicMaterial({ color: new Color(bikeColor), toneMapped: false })
    const shield = new MeshBasicMaterial({
      color: 0x5fd0ff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false,
    })
    return { frame, dark, silver, tire, skin, suit, jersey, helmet, helmetAccent, shoe, goggle, glow, shield }
  }, [bikeColor])

  const geos = useMemo(() => ({
    /** 단위 실린더 — scale(r, len, r) 로 모든 튜브 */
    tube: new CylinderGeometry(1, 1, 1, 7),
    joint: new SphereGeometry(1, 7, 6),
    box: new BoxGeometry(1, 1, 1),
    rim: new TorusGeometry(0.285, 0.013, 6, 26),
    spoke: new CylinderGeometry(0.006, 0.006, 0.56, 4),
    hub: new CylinderGeometry(0.022, 0.022, 0.06, 8),
    chainring: new CylinderGeometry(0.085, 0.085, 0.016, 14),
    barHook: new TorusGeometry(0.052, 0.015, 6, 10, Math.PI * 1.25),
    helmetTail: new CylinderGeometry(0.001, 0.062, 0.16, 8),
  }), [])

  // 색 변경/언마운트 시 로컬 리소스 해제 (R3F 는 외부 생성분 dispose 안 함)
  useEffect(() => {
    return () => { for (const m of Object.values(mats)) m.dispose() }
  }, [mats])
  useEffect(() => {
    return () => { for (const g of Object.values(geos)) g.dispose() }
  }, [geos])

  // 정적 부품 병합 (재질별 1 드로우콜 — 개별 mesh 30+개는 모바일 드로우콜 낭비)
  const merged = useMemo(() => {
    const compose = (
      geo: BufferGeometry,
      position: Vector3 | [number, number, number],
      quatOrEuler?: Quaternion | [number, number, number],
      scale?: [number, number, number],
    ): BufferGeometry => {
      const p = position instanceof Vector3 ? position : new Vector3(...position)
      const q = quatOrEuler instanceof Quaternion
        ? quatOrEuler
        : new Quaternion().setFromEuler(new Euler(...(quatOrEuler ?? [0, 0, 0])))
      const s = new Vector3(...(scale ?? [1, 1, 1]))
      return geo.clone().applyMatrix4(new Matrix4().compose(p, q, s))
    }
    const tube = (p1: Vector3, p2: Vector3, r: number): BufferGeometry => {
      const t = tubeBetween(p1, p2)
      return compose(geos.tube, t.position, t.quaternion, [r, t.scale.y, r])
    }

    const stay = 0.05
    const rearL = REAR_AXLE.clone().setX(-stay)
    const rearR = REAR_AXLE.clone().setX(stay)
    const frontL = FRONT_AXLE.clone().setX(-stay)
    const frontR = FRONT_AXLE.clone().setX(stay)

    // 프레임 색 (bikeColor 재질) — 메인 삼각형 + 스테이 쌍
    const frame = mergeGeometries([
      tube(HEAD_TOP, SEAT_CLUSTER, 0.022),
      tube(HEAD_BOT, BB, 0.026),
      tube(BB, SEAT_CLUSTER, 0.022),
      tube(HEAD_TOP, HEAD_BOT, 0.03),
      tube(SEAT_CLUSTER, rearL, 0.013),
      tube(SEAT_CLUSTER, rearR, 0.013),
      tube(BB, rearL, 0.013),
      tube(BB, rearR, 0.013),
    ])

    // 다크 정적 — 포크/시트포스트/스템/드롭바(가로+후크+후드)/안장
    const dark = mergeGeometries([
      tube(HEAD_BOT, frontL, 0.014),
      tube(HEAD_BOT, frontR, 0.014),
      tube(SEAT_CLUSTER, SADDLE, 0.014),
      tube(HEAD_TOP, BAR_CENTER, 0.014),
      compose(geos.tube, BAR_CENTER, [0, 0, Math.PI / 2], [0.014, 0.34, 0.014]),
      compose(geos.barHook, [-0.17, BAR_CENTER.y - 0.01, BAR_CENTER.z], [0.2, Math.PI / 2, 0]),
      compose(geos.barHook, [0.17, BAR_CENTER.y - 0.01, BAR_CENTER.z], [0.2, Math.PI / 2, 0]),
      compose(geos.box, [-0.135, 0.762, -0.445], [0.5, 0, 0], [0.03, 0.06, 0.035]),
      compose(geos.box, [0.135, 0.762, -0.445], [0.5, 0, 0], [0.03, 0.06, 0.035]),
      compose(geos.box, [0, SADDLE.y + 0.015, SADDLE.z], undefined, [0.085, 0.03, 0.17]),
    ])

    // 바퀴 내부 실버 (림 + 스포크 3) — 두 바퀴가 같은 지오를 공유
    const wheelSilver = mergeGeometries([
      compose(geos.rim, [0, 0, 0], [0, Math.PI / 2, 0]),
      geos.spoke.clone(),
      compose(geos.spoke, [0, 0, 0], [Math.PI / 3, 0, 0]),
      compose(geos.spoke, [0, 0, 0], [-Math.PI / 3, 0, 0]),
    ])

    // 크랭크암 쌍 (스핀 그룹 내)
    const crank = mergeGeometries([
      compose(geos.tube, [-0.1, CRANK_R / 2, 0], undefined, [0.013, CRANK_R, 0.013]),
      compose(geos.tube, [0.1, -CRANK_R / 2, 0], undefined, [0.013, CRANK_R, 0.013]),
    ])

    return { frame, dark, wheelSilver, crank }
  }, [geos])

  useEffect(() => {
    return () => { for (const g of Object.values(merged)) g.dispose() }
  }, [merged])

  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root) return
    const st = sim.state
    // 1인칭 주행 중엔 본체 숨김 (CockpitMesh 가 대신). 크래시 순간 체이스로 복귀해
    // 자전거 고꾸라지는 연출이 다시 보이도록 phase==='playing' 에만 숨긴다.
    const fpHidden = st.phase === 'playing'
    root.visible = !fpHidden
    if (blobRef.current) blobRef.current.visible = !fpHidden
    if (fpHidden) return
    // 보간 포즈 — 60Hz 스텝과 고주사율 rAF 위상 어긋남 저더 제거
    const pose = sim.getRenderPose(poseRef.current)
    const smp = sim.track.sampleAt(pose.s)

    // 위치
    root.position.set(
      smp.px + smp.rightX * pose.x,
      smp.py + pose.z,
      smp.pz + smp.rightZ * pose.x,
    )
    // 방향 (YXZ: heading → pitch → roll)
    root.rotation.order = 'YXZ'
    root.rotation.y = Math.atan2(-smp.dirX, -smp.dirZ)
    const airPitch = st.airborne ? Math.min(0.22, st.vz * 0.03) : 0
    root.rotation.x = -Math.atan(smp.grade) * 0.8 + airPitch
    root.rotation.z = -pose.lean * 0.55

    // 크래시 연출: 자전거가 앞으로 고꾸라짐
    const bike = bikeRef.current
    if (bike) {
      if (st.phase === 'crashing' || st.phase === 'dead') {
        const t = Math.min(1, st.crashTimer / CRASH_SLOWMO_DURATION)
        bike.rotation.x = -t * 1.4
        bike.position.y = Math.sin(t * Math.PI) * 0.5
        bike.rotation.z = t * 0.9
      } else {
        bike.rotation.x = 0
        bike.rotation.z = 0
        bike.position.y = 0
      }
    }

    // ── 바퀴/크랭크 회전 ──
    const wheelSpin = (pose.speed / 0.34) * delta
    if (wheelFRef.current) wheelFRef.current.rotation.x -= wheelSpin
    if (wheelRRef.current) wheelRRef.current.rotation.x -= wheelSpin
    // 케이던스 — 에어에선 프리휠 (다리 멈춤)
    const cadence = st.airborne ? 0 : wheelSpin * 0.36
    crankAngleRef.current -= cadence
    if (crankRef.current) crankRef.current.rotation.x = crankAngleRef.current

    // ── 라이더 자세: 속도 높을수록 터킹(숙임 = 음수 Rx), 에어에선 살짝 폄(양수) ──
    // three.js Rx(+)는 상체를 뒤로 젖히는 방향 — 부호 주의 (적대 리뷰 확정: 반전돼 있었음)
    const body = bodyRef.current
    let tuck = 0
    if (body) {
      tuck = st.airborne ? 0.08 : -Math.min(0.22, pose.speed * 0.005)
      body.rotation.x += (tuck - body.rotation.x) * Math.min(1, 8 * delta)
      tuck = body.rotation.x
    }

    // ── 다리 페달링 IK (크랭크 각 → 페달 → 무릎) ──
    const phi = crankAngleRef.current
    for (const side of [-1, 1] as const) {
      const a = side === -1 ? phi : phi + Math.PI
      // 페달 위치 (y-z 평면 원운동, x 는 바깥쪽)
      footPos.set(
        side * 0.115,
        BB.y + Math.cos(a) * CRANK_R,
        BB.z + Math.sin(a) * CRANK_R,
      )
      const pedal = side === -1 ? pedalL.current : pedalR.current
      if (pedal) pedal.position.copy(footPos)
      const shoe = side === -1 ? shoeL.current : shoeR.current
      if (shoe) shoe.position.set(footPos.x, footPos.y + 0.035, footPos.z - 0.015)

      // 힙 (bodyRef 회전 무시 근사 — 힙은 피벗이라 고정)
      hipWorld.set(side * 0.085, HIPS.y, HIPS.z)
      solveIK(hipWorld, footPos, THIGH_LEN, SHIN_LEN, bendLeg, kneePos)
      updateSegment(side === -1 ? thighL.current : thighR.current, hipWorld, kneePos, 0.036)
      updateSegment(side === -1 ? shinL.current : shinR.current, kneePos, footPos, 0.026)
      const knee = side === -1 ? kneeL.current : kneeR.current
      if (knee) knee.position.copy(kneePos)
    }

    // ── 팔 IK (어깨는 터킹 따라 이동, 손은 바 고정) ──
    for (const side of [-1, 1] as const) {
      const sh = side === -1 ? SHOULDER_L : SHOULDER_R
      // bodyRef(힙 피벗) 회전 rotation.x = tuck 적용한 어깨 월드(바이크 로컬) 좌표
      const cy = Math.cos(tuck), sy = Math.sin(tuck)
      shoulderPos.set(
        sh.x,
        HIPS.y + sh.y * cy - sh.z * sy,
        HIPS.z + sh.y * sy + sh.z * cy,
      )
      const hand = side === -1 ? HAND_L : HAND_R
      solveIK(shoulderPos, hand, UPPER_ARM_LEN, FOREARM_LEN, side === -1 ? bendArmL : bendArmR, elbowPos)
      updateSegment(side === -1 ? upperArmL.current : upperArmR.current, shoulderPos, elbowPos, 0.03)
      updateSegment(side === -1 ? foreArmL.current : foreArmR.current, elbowPos, hand, 0.024)
      const elbow = side === -1 ? elbowL.current : elbowR.current
      if (elbow) elbow.position.copy(elbowPos)
    }

    // 🛡 실드 구 — 보유 중일 때만, 살짝 펄스
    const shield = shieldRef.current
    if (shield) {
      shield.visible = st.shield
      if (st.shield) {
        const pulse = 3.2 * (1 + Math.sin(st.time * 5) * 0.05)
        shield.scale.set(pulse, pulse, pulse)
      }
    }

    // 블롭 섀도 — 지면 고정, 점프 시 축소 (라이더 1.55 스케일에 맞춤)
    const blob = blobRef.current
    if (blob) {
      blob.position.set(
        smp.px + smp.rightX * pose.x,
        smp.py + 0.03,
        smp.pz + smp.rightZ * pose.x,
      )
      blob.rotation.y = root.rotation.y
      const shrink = Math.max(0.4, 1 - pose.z * 0.12)
      blob.scale.set(0.86 * shrink, 1, 1.72 * shrink)
      const m = blob.material
      if (!Array.isArray(m) && 'opacity' in m) {
        m.opacity = Math.max(0.25, 1 - pose.z * 0.15)
      }
    }
  })

  // 라이더/자전거 전체 그림자 캐스팅 (실드/글로우 제외)
  useEffect(() => {
    const bike = bikeRef.current
    if (bike) {
      bike.traverse((obj) => {
        if (obj instanceof Mesh) obj.castShadow = true
      })
    }
  }, [])

  return (
    <>
      <group ref={rootRef} scale={[1.55, 1.55, 1.55]}>
        <group ref={bikeRef}>
          {/* ── 바퀴 (타이어 + 병합 실버(림/스포크) + 허브, 그룹째 스핀) ── */}
          {[FRONT_AXLE, REAR_AXLE].map((axle, i) => (
            <group key={i} position={axle}>
              <group ref={i === 0 ? wheelFRef : wheelRRef}>
                <mesh geometry={assets.geo.wheel} material={mats.tire} rotation={[0, Math.PI / 2, 0]} />
                <mesh geometry={merged.wheelSilver} material={mats.silver} />
                <mesh geometry={geos.hub} material={mats.dark} rotation={[0, 0, Math.PI / 2]} />
              </group>
            </group>
          ))}

          {/* ── 정적 병합 파트 (재질별 1 드로우콜) ── */}
          <mesh geometry={merged.frame} material={mats.frame} />
          <mesh geometry={merged.dark} material={mats.dark} />

          {/* ── 크랭크셋: 체인링(고정) + 크랭크암 병합(스핀) + 페달(수평 유지) ── */}
          <mesh geometry={geos.chainring} material={mats.silver} position={BB} rotation={[0, 0, Math.PI / 2]} />
          <group ref={crankRef} position={BB}>
            <mesh geometry={merged.crank} material={mats.dark} />
          </group>
          <mesh ref={pedalL} geometry={geos.box} material={mats.dark} scale={[0.09, 0.018, 0.06]} />
          <mesh ref={pedalR} geometry={geos.box} material={mats.dark} scale={[0.09, 0.018, 0.06]} />

          {/* ── 다리 (페달링 IK — 매 프레임 갱신) ── */}
          <mesh ref={thighL} geometry={geos.tube} material={mats.suit} />
          <mesh ref={thighR} geometry={geos.tube} material={mats.suit} />
          <mesh ref={shinL} geometry={geos.tube} material={mats.skin} />
          <mesh ref={shinR} geometry={geos.tube} material={mats.skin} />
          <mesh ref={kneeL} geometry={geos.joint} material={mats.suit} scale={[0.038, 0.038, 0.038]} />
          <mesh ref={kneeR} geometry={geos.joint} material={mats.suit} scale={[0.038, 0.038, 0.038]} />
          <mesh ref={shoeL} geometry={geos.box} material={mats.shoe} scale={[0.055, 0.045, 0.13]} />
          <mesh ref={shoeR} geometry={geos.box} material={mats.shoe} scale={[0.055, 0.045, 0.13]} />

          {/* ── 팔 (IK — 매 프레임 갱신) ── */}
          <mesh ref={upperArmL} geometry={geos.tube} material={mats.jersey} />
          <mesh ref={upperArmR} geometry={geos.tube} material={mats.jersey} />
          <mesh ref={foreArmL} geometry={geos.tube} material={mats.skin} />
          <mesh ref={foreArmR} geometry={geos.tube} material={mats.skin} />
          <mesh ref={elbowL} geometry={geos.joint} material={mats.jersey} scale={[0.032, 0.032, 0.032]} />
          <mesh ref={elbowR} geometry={geos.joint} material={mats.jersey} scale={[0.032, 0.032, 0.032]} />

          {/* ── 상체 (힙 피벗 — 터킹 연동) ── */}
          <group ref={bodyRef} position={HIPS}>
            {/* 골반/빕숏 */}
            <mesh geometry={geos.box} material={mats.suit} position={[0, 0.02, 0.02]} rotation={[0.5, 0, 0]} scale={[0.19, 0.14, 0.16]} />
            {/* 몸통 (숙임) — 저지 */}
            <mesh geometry={geos.box} material={mats.jersey} position={[0, 0.16, -0.12]} rotation={[0.95, 0, 0]} scale={[0.21, 0.34, 0.15]} />
            {/* 등 라인 하이라이트 */}
            <mesh geometry={geos.box} material={mats.helmet} position={[0, 0.20, -0.115]} rotation={[0.95, 0, 0]} scale={[0.07, 0.3, 0.155]} />
            {/* 목 + 머리 + 에어로 헬멧 + 고글 */}
            <mesh geometry={geos.tube} material={mats.skin} position={[0, 0.30, -0.28]} rotation={[0.7, 0, 0]} scale={[0.035, 0.08, 0.035]} />
            <mesh geometry={geos.joint} material={mats.skin} position={[0, 0.35, -0.315]} scale={[0.062, 0.066, 0.068]} />
            <mesh geometry={geos.joint} material={mats.helmet} position={[0, 0.375, -0.30]} scale={[0.072, 0.062, 0.085]} />
            <mesh geometry={geos.helmetTail} material={mats.helmetAccent} position={[0, 0.375, -0.21]} rotation={[-1.35, 0, 0]} />
            <mesh geometry={geos.box} material={mats.goggle} position={[0, 0.355, -0.375]} scale={[0.10, 0.028, 0.02]} />
          </group>

          {/* 프레임 액센트 글로우 (시트스테이 리플렉터) */}
          <mesh geometry={geos.joint} material={mats.glow} position={[0, 0.5, 0.42]} scale={[0.02, 0.02, 0.02]} />
        </group>

        {/* 🛡 실드 구 (보유 시 표시) */}
        <mesh ref={shieldRef} geometry={assets.geo.itemShield} material={mats.shield} position={[0, 0.85, 0]} scale={[3.2, 3.2, 3.2]} visible={false} renderOrder={4} />
      </group>

      {/* 블롭 섀도 (루트와 분리 — 항상 지면) */}
      <mesh ref={blobRef} geometry={assets.geo.blob} material={assets.mat.blob} renderOrder={1} />
    </>
  )
}
