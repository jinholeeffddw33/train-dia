'use client'

/**
 * APEX RUSH — 1인칭 코크핏 V2 (실사 디테일 + 라이더 모션)
 *
 * 카메라 트랜스폼을 매 프레임 복사해 화면 하단에 고정 (priority -9 —
 * GameScene(-10)이 카메라를 먼저 갱신한 뒤 실행되도록).
 *
 * ★멀미 교정(V12): 수평선 롤은 GameScene 이 미세하게만(0.10) — 대신 핸들바가
 *   크게 눕는다(-lean*0.5). "세상은 안정, 자전거만 기운다" = 레이싱 게임 표준.
 * ★에어 모션: 점프 중 바를 당겨 몸이 일어나고(바가 시야에서 내려가며 위로 회전),
 *   착지 순간 살짝 눌림 — GameScene 카메라 상승과 합쳐 바니홉 체감.
 * ★실사 디테일(진호 "핸들은 진짜 실사급으로"): 바테이프 그립+홈 링, 후드 위
 *   손가락, 브레이크 케이블 커브, 스템 탑캡, 속도 연동 바이크 컴퓨터 스크린.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, MeshPhongMaterial, Quaternion, QuadraticBezierCurve3,
  SphereGeometry, TorusGeometry, TubeGeometry, Vector3,
} from 'three'
import type { ApexSim } from '../engine/sim'

interface CockpitMeshProps {
  sim: ApexSim
  bikeColor: number
}

const UP = new Vector3(0, 1, 0)

/** 두 점 사이 튜브 배치 (정적 — JSX 프롭용) */
function tubeProps(p1: [number, number, number], p2: [number, number, number], r: number) {
  const a = new Vector3(...p1)
  const b = new Vector3(...p2)
  const dir = new Vector3().subVectors(b, a)
  const len = dir.length()
  return {
    position: new Vector3().addVectors(a, b).multiplyScalar(0.5),
    quaternion: new Quaternion().setFromUnitVectors(UP, dir.normalize()),
    scale: new Vector3(r, len, r),
  }
}

export function CockpitMesh({ sim, bikeColor }: CockpitMeshProps) {
  const camera = useThree((s) => s.camera)
  const rootRef = useRef<Group>(null)
  const innerRef = useRef<Group>(null)
  const poseRef = useRef({ s: 0, x: 0, z: 0, lean: 0, speed: 0 })
  /** 에어/착지 모션 상태 (이벤트는 GameScene 이 소비 → airborne 전이로 자체 검출) */
  const motionRef = useRef({ airLift: 0, landDip: 0, wasAirborne: false })

  const mats = useMemo(() => ({
    // 바/스템 = 금속 하이라이트 (실사감의 핵심 — Lambert 무광이면 플라스틱처럼 보임)
    bar: new MeshPhongMaterial({ color: 0x23262e, shininess: 55, specular: 0x767c88 }),
    frame: new MeshPhongMaterial({ color: new Color(bikeColor), shininess: 90, specular: 0x8a8f99 }),
    tape: new MeshLambertMaterial({ color: 0x2e3039 }), // 바테이프 (무광 — 금속과 대비)
    dark: new MeshLambertMaterial({ color: 0x1c1f27 }),
    skin: new MeshLambertMaterial({ color: 0xe4b294 }),
    glove: new MeshLambertMaterial({ color: 0x191c24 }),
    jersey: new MeshLambertMaterial({ color: new Color(bikeColor).multiplyScalar(0.85) }),
    tire: new MeshLambertMaterial({ color: 0x1f2229 }),
    screen: new MeshBasicMaterial({ color: 0x93d02c, toneMapped: false }), // 컴퓨터 발광
  }), [bikeColor])

  const geos = useMemo(() => {
    // 브레이크 케이블 — 후드 앞에서 헤드튜브 쪽으로 늘어지는 커브 (좌우 대칭)
    const cableL = new TubeGeometry(
      new QuadraticBezierCurve3(
        new Vector3(-0.175, 0.005, -0.055),
        new Vector3(-0.20, -0.13, 0.0),
        new Vector3(-0.035, -0.20, 0.10),
      ), 10, 0.0035, 5,
    )
    const cableR = new TubeGeometry(
      new QuadraticBezierCurve3(
        new Vector3(0.175, 0.005, -0.055),
        new Vector3(0.20, -0.13, 0.0),
        new Vector3(0.035, -0.20, 0.10),
      ), 10, 0.0035, 5,
    )
    return {
      tube: new CylinderGeometry(1, 1, 1, 10),
      joint: new SphereGeometry(1, 9, 8),
      box: new BoxGeometry(1, 1, 1),
      hook: new TorusGeometry(0.062, 0.015, 7, 14, Math.PI * 1.2),
      tapeRing: new TorusGeometry(0.0205, 0.0026, 5, 10),
      tireArc: new TorusGeometry(0.34, 0.021, 8, 24),
      rimArc: new TorusGeometry(0.315, 0.007, 6, 20),
      cableL,
      cableR,
    }
  }, [])

  // R3F 는 외부 생성 리소스 dispose 안 함 — 색 변경/언마운트 시 해제
  useEffect(() => {
    return () => { for (const m of Object.values(mats)) m.dispose() }
  }, [mats])
  useEffect(() => {
    return () => { for (const g of Object.values(geos)) g.dispose() }
  }, [geos])

  // 팔뚝 — 화면 하단 밖(어깨 방향)에서 후드 손으로 뻗음 (정적 배치)
  const armL = useMemo(() => tubeProps([-0.33, -0.38, 0.44], [-0.175, 0.015, -0.015], 0.027), [])
  const armR = useMemo(() => tubeProps([0.33, -0.38, 0.44], [0.175, 0.015, -0.015], 0.027), [])
  // 포크 쌍 — 스템 아래에서 휠 축으로
  const forkL = useMemo(() => tubeProps([-0.035, -0.045, 0.03], [-0.035, -0.43, -0.34], 0.011), [])
  const forkR = useMemo(() => tubeProps([0.035, -0.045, 0.03], [0.035, -0.43, -0.34], 0.011), [])

  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root) return
    const st = sim.state
    // 주행 중에만 — 크래시/메뉴 orbit 은 체이스 캠 + 라이더 본체
    const active = st.phase === 'playing'
    root.visible = active
    if (!active) return

    // 카메라에 밀착 (GameScene 이 -10 에서 카메라를 이미 갱신함)
    root.position.copy(camera.position)
    root.quaternion.copy(camera.quaternion)

    const pose = sim.getRenderPose(poseRef.current)
    const inner = innerRef.current
    if (!inner) return

    // 에어 모션 — airborne 전이 자체 검출 (이벤트는 GameScene 이 소비)
    const m = motionRef.current
    m.airLift += ((st.airborne ? 1 : 0) - m.airLift) * Math.min(1, 6 * delta)
    if (m.wasAirborne && !st.airborne) m.landDip = 1
    m.wasAirborne = st.airborne
    m.landDip *= Math.exp(-5 * delta)

    // 뱅킹(멀미 교정의 짝): 수평선 대신 바가 크게 눕고, 꺾는 방향으로 요
    inner.rotation.z = -pose.lean * 0.5
    inner.rotation.y = -pose.lean * 0.28
    // 점프: 바를 당겨 위로 회전(바니홉) + 시야에서 내려감(몸 일어남), 착지: 눌림
    // 진호 V17 "핸들바가 하단에 딱붙어 손목이 잘림 — 위로 올리고 더 많이 보이게":
    //   기준 y -0.40→-0.30 (바를 화면 위로 = 손목까지 프레임 인), z -0.58→-0.64 (살짝 멀리)
    inner.rotation.x = -m.airLift * 0.16 + m.landDip * 0.08
    inner.position.y = -0.30 - m.airLift * 0.06 + m.landDip * 0.035
    inner.position.z = -0.64 - m.airLift * 0.02
  }, -9)

  return (
    <group ref={rootRef} visible={false}>
      {/* 카메라 로컬: -Z 전방. 바 중심을 화면 하단 1/3 에 (손목까지 노출) */}
      <group ref={innerRef} position={[0, -0.30, -0.64]}>
        {/* ── 드롭바: 금속 크로스바(중앙) + 바테이프 그립(양끝) + 테이프 홈 링 ── */}
        <mesh geometry={geos.tube} material={mats.bar} rotation={[0, 0, Math.PI / 2]} scale={[0.015, 0.25, 0.015]} />
        <mesh geometry={geos.tube} material={mats.tape} position={[-0.165, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.019, 0.105, 0.019]} />
        <mesh geometry={geos.tube} material={mats.tape} position={[0.165, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.019, 0.105, 0.019]} />
        {[-0.135, -0.165, -0.198, 0.135, 0.165, 0.198].map((x) => (
          <mesh key={x} geometry={geos.tapeRing} material={mats.dark} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        ))}
        {/* 바 후크 (드롭) — 테이프 톤 */}
        <mesh geometry={geos.hook} material={mats.tape} position={[-0.215, -0.012, 0]} rotation={[0.25, Math.PI / 2, 0]} />
        <mesh geometry={geos.hook} material={mats.tape} position={[0.215, -0.012, 0]} rotation={[0.25, Math.PI / 2, 0]} />
        {/* 브레이크 후드 + 레버 */}
        <mesh geometry={geos.box} material={mats.dark} position={[-0.175, 0.008, -0.035]} rotation={[0.55, 0, 0]} scale={[0.034, 0.07, 0.04]} />
        <mesh geometry={geos.box} material={mats.dark} position={[0.175, 0.008, -0.035]} rotation={[0.55, 0, 0]} scale={[0.034, 0.07, 0.04]} />
        <mesh geometry={geos.box} material={mats.bar} position={[-0.175, -0.045, -0.06]} rotation={[0.35, 0, 0.06]} scale={[0.012, 0.075, 0.014]} />
        <mesh geometry={geos.box} material={mats.bar} position={[0.175, -0.045, -0.06]} rotation={[0.35, 0, -0.06]} scale={[0.012, 0.075, 0.014]} />
        {/* 브레이크 케이블 — 후드에서 헤드튜브로 늘어지는 커브 */}
        <mesh geometry={geos.cableL} material={mats.dark} />
        <mesh geometry={geos.cableR} material={mats.dark} />
        {/* 스템(프레임 색) + 탑캡 + 스페이서 */}
        <mesh geometry={geos.tube} material={mats.frame} position={[0, -0.015, 0.07]} rotation={[1.25, 0, 0]} scale={[0.014, 0.14, 0.014]} />
        <mesh geometry={geos.tube} material={mats.bar} position={[0, -0.042, 0.132]} rotation={[1.25, 0, 0]} scale={[0.018, 0.03, 0.018]} />
        <mesh geometry={geos.joint} material={mats.dark} position={[0, -0.005, 0.012]} scale={[0.017, 0.008, 0.017]} />
        {/* 바이크 컴퓨터 (아웃프론트 마운트) — 스크린은 HUD 톤 발광 */}
        <mesh geometry={geos.tube} material={mats.bar} position={[0, 0.004, -0.045]} rotation={[Math.PI / 2, 0, 0]} scale={[0.006, 0.075, 0.006]} />
        <mesh geometry={geos.box} material={mats.dark} position={[0, 0.012, -0.095]} rotation={[-0.42, 0, 0]} scale={[0.052, 0.012, 0.075]} />
        <mesh geometry={geos.box} material={mats.screen} position={[0, 0.0195, -0.093]} rotation={[-0.42, 0, 0]} scale={[0.04, 0.003, 0.058]} />
        {/* 손 — 장갑이 후드를 감싸고, 손가락 3개가 후드 앞으로 넘어감 + 엄지 안쪽 */}
        <mesh geometry={geos.joint} material={mats.glove} position={[-0.175, 0.035, -0.02]} scale={[0.042, 0.038, 0.055]} />
        <mesh geometry={geos.joint} material={mats.glove} position={[0.175, 0.035, -0.02]} scale={[0.042, 0.038, 0.055]} />
        {[-1, 1].map((side) => (
          <group key={side}>
            {[-0.012, 0, 0.012].map((dx) => (
              <mesh
                key={dx}
                geometry={geos.tube}
                material={mats.glove}
                position={[side * 0.175 + dx, 0.014, -0.058]}
                rotation={[1.05, 0, 0]}
                scale={[0.0085, 0.05, 0.0085]}
              />
            ))}
            <mesh
              geometry={geos.tube}
              material={mats.glove}
              position={[side * 0.148, 0.028, -0.012]}
              rotation={[0.4, 0, side * -0.9]}
              scale={[0.009, 0.038, 0.009]}
            />
          </group>
        ))}
        {/* 손목 피부 + 저지 팔뚝 (화면 밖 어깨에서) */}
        <mesh geometry={geos.joint} material={mats.skin} position={[-0.185, 0.05, 0.03]} scale={[0.034, 0.03, 0.04]} />
        <mesh geometry={geos.joint} material={mats.skin} position={[0.185, 0.05, 0.03]} scale={[0.034, 0.03, 0.04]} />
        <mesh geometry={geos.tube} material={mats.jersey} position={armL.position} quaternion={armL.quaternion} scale={armL.scale} />
        <mesh geometry={geos.tube} material={mats.jersey} position={armR.position} quaternion={armR.quaternion} scale={armR.scale} />
        {/* 포크 + 프론트 휠 상단 (바 너머로 살짝 보임 — 속도 체감 앵커) */}
        <mesh geometry={geos.tube} material={mats.frame} position={forkL.position} quaternion={forkL.quaternion} scale={forkL.scale} />
        <mesh geometry={geos.tube} material={mats.frame} position={forkR.position} quaternion={forkR.quaternion} scale={forkR.scale} />
        <mesh geometry={geos.tireArc} material={mats.tire} position={[0, -0.43, -0.36]} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={geos.rimArc} material={mats.dark} position={[0, -0.43, -0.36]} rotation={[0, Math.PI / 2, 0]} />
      </group>
    </group>
  )
}
