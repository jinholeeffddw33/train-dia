#!/usr/bin/env node
/**
 * UI-ZLAYER-001 가드 — 레이어급 z-index 는 토큰 경유 (ZINOSB 적응 이식 2026-08-09)
 *
 * 왜 —
 *   z-index 숫자가 흩어져 있으면 "이게 저것보다 위인가"를 코드만 보고 판단할 수 없다.
 *   새 오버레이를 만들 때마다 "일단 큰 숫자"를 찍게 되고, 그렇게 1000 → 1100 → 1305 → 1310
 *   같은 사다리 아닌 사다리가 자란다. 실측(2026-08-09): raw z-index 24종 135건,
 *   그중 레이어급(≥10) 16종 45건. --dia-layer-* 토큰은 정의만 돼 있고 **사용 0회**였다.
 *
 * 잡는 것:
 *   [FAIL] z-index 가 10 이상인 raw 숫자 — var(--dia-layer-*) 사용
 *
 * 안 잡는 것:
 *   - 로컬 스택 -1 ~ 9 (컴포넌트 내부 겹침. 전역 의미가 없어 토큰화 대상이 아니다)
 *   - 토큰 정의 라인 (--dia-layer-* / --z-layer-* : N)
 *   - 직전 2줄 내 ZLAYER-EXCEPTION 주석
 *
 * ★ 이관은 **값 보존 치환**으로 했다 — 토큰이 현재 값을 그대로 갖는다.
 *   번호를 재배치하면 라이브에서 모달이 토스트 뒤로 숨는 사고가 난다.
 *   사다리 정리는 이름이 붙은 뒤의 다음 문제.
 *
 * Exit: FAIL 있으면 1, 아니면 0.
 * 본문 룰: docs/rules/ui/design-system.md UI-ZLAYER-001
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')

const LOCAL_MAX = 9
const DEF_LINE = /^\s*--[\w-]*layer[\w-]*\s*:/
const EXC = /ZLAYER-EXCEPTION/

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && ent.name.endsWith('.css')) out.push(full)
  }
  return out
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

const files = walk(SRC)
const fails = []

for (const f of files) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  const raw = fs.readFileSync(f, 'utf8')
  const lines = stripComments(raw).split('\n')
  const rawLines = raw.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (DEF_LINE.test(line)) continue
    if (EXC.test(rawLines.slice(Math.max(0, i - 2), i + 1).join('\n'))) continue
    for (const m of line.matchAll(/z-index\s*:\s*(-?\d+)/g)) {
      const v = parseInt(m[1], 10)
      if (v <= LOCAL_MAX) continue
      fails.push({ file: rel, line: i + 1, v, text: rawLines[i].trim().slice(0, 90) })
    }
  }
}

if (fails.length > 0) {
  console.log(`\n❌ [F / UI-ZLAYER-001] 레이어급 raw z-index ${fails.length}건 — var(--dia-layer-*) 를 쓸 것`)
  for (const f of fails) console.log(`  ${f.file}:${f.line}  z-index:${f.v}  ${f.text}`)
  console.log('  사다리: base 0 < sticky 10/11 < dropdown 20 < fixed 30 < overlay 50/60 < modal 100/150')
  console.log('          < toast 200 < fullscreen 1000/1100 < viewer 1150~1310 < critical 9999')
  console.log('  로컬 스택(-1~9)은 대상 아님. 예외는 직전 줄 /* ZLAYER-EXCEPTION: 사유 */.')
  console.log(`  (스캔 우주: src/ 아래 css ${files.length}개 파일)`)
  process.exit(1)
}

console.log(`✅ check:zlayer — UI-ZLAYER-001 위반 0건 (스캔 ${files.length}파일)`)
process.exit(0)
