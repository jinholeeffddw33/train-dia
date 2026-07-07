'use client'

/**
 * APEX RUSH — 하늘 돔 (셰이더 그라데이션 + 태양 디스크 + 밤 별)
 * 카메라에 따라다니는 대형 구. 팔레트 uniform 은 GameScene 이 매 프레임 갱신.
 */

import { forwardRef, useEffect, useMemo } from 'react'
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three'

export interface SkyUniforms {
  topColor: { value: Color }
  horizonColor: { value: Color }
  bottomColor: { value: Color }
  sunDir: { value: [number, number, number] }
  sunColor: { value: Color }
  nightness: { value: number }
}

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 bottomColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float nightness;

// hash 기반 별 (도심 밤 페이드인)
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// value noise + 2옥타브 fbm (구름)
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  float h = vDir.y;
  vec3 col;
  if (h >= 0.0) {
    float t = pow(min(1.0, h * 1.6), 0.75);
    col = mix(horizonColor, topColor, t);
  } else {
    float t = min(1.0, -h * 3.0);
    col = mix(horizonColor, bottomColor, t);
  }

  // 구름 — 지평선 위 저고도 밴드, 2옥타브 fbm. 밤엔 옅게.
  if (h > 0.02) {
    vec2 cuv = vDir.xz / (vDir.y + 0.35);
    float n = vnoise(cuv * 2.1) * 0.62 + vnoise(cuv * 4.7 + 13.7) * 0.38;
    float cloud = smoothstep(0.58, 0.82, n);
    float band = smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.28, 0.62, h));
    vec3 cloudCol = mix(horizonColor * 1.12 + vec3(0.07), topColor * 0.9 + vec3(0.12), 0.4);
    col = mix(col, cloudCol, cloud * band * (0.5 - nightness * 0.3));
  }

  // 태양 디스크 + 이중 글로우 (halo)
  float d = dot(normalize(vDir), normalize(sunDir));
  float disc = smoothstep(0.9985, 0.9995, d);
  float glow = pow(max(d, 0.0), 24.0) * 0.5 + pow(max(d, 0.0), 6.0) * 0.16;
  col += sunColor * (disc + glow);

  // 별 (위쪽 하늘, nightness 로 페이드)
  if (nightness > 0.01 && h > 0.05) {
    vec2 uv = vDir.xz / (vDir.y + 0.4);
    float star = step(0.997, hash21(floor(uv * 160.0)));
    float twinkle = 0.6 + 0.4 * hash21(floor(uv * 160.0) + 7.0);
    col += vec3(star * twinkle * nightness * min(1.0, h * 4.0));
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export const SkyDome = forwardRef<Mesh>(function SkyDome(_props, ref) {
  const { geometry, material } = useMemo(() => {
    const geometry = new SphereGeometry(420, 24, 16)
    const material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new Color(0x2b2f63) },
        horizonColor: { value: new Color(0x8f7bd0) },
        bottomColor: { value: new Color(0xe0a9c8) },
        sunDir: { value: [0.4, 0.3, -0.85] },
        sunColor: { value: new Color(0xffd9a0) },
        nightness: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    })
    return { geometry, material }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      renderOrder={-10}
      frustumCulled={false}
      onUpdate={(m) => { m.matrixAutoUpdate = true }}
    />
  )
})
