#!/usr/bin/env node
/**
 * UI-TOKEN-REF-001 가드 — 팬텀 var() 차단 (ZINOSB check-token-refs 적응 이식 2026-08-09)
 *
 * 왜 —
 *   CSS 커스텀 프로퍼티는 **silent fail** 이다. 정의되지 않은 토큰을 폴백 없이 참조하면
 *   그 선언 전체가 계산 시점에 무효가 되어 *조용히 사라진다*. 에러도, 경고도, 빌드 실패도 없다.
 *   실제 사례(2026-08-09 실측): apex 게임의 CTA 가
 *     background: linear-gradient(180deg, var(--z-3d-lime-hi) 0%, var(--z-3d-lime-lo) 100%);
 *   를 쓰는데 두 토큰이 train-dia 에 이식되지 않아 배경이 통째로 죽어 있었다.
 *
 * 심각도 2단계 —
 *   [FAIL] 폴백 없는 미정의 참조  var(--x)          → 선언이 조용히 죽는다 = 실버그
 *   [WARN] 폴백 있는 미정의 참조  var(--x, 폴백)     → 폴백으로 동작하지만, 주입처가 없으면
 *          "색을 갈아끼우려던 설계가 배선되지 않은 것"이라 항상 폴백값만 보인다
 *
 * ★ 정의로 인정하는 것 (여기를 좁게 잡으면 거짓 FAIL 이 쏟아진다 — 실제로 초안에서 발생):
 *   1. CSS 어디서든 `--x:` (줄머리 한정 금지 — `.cls { --x: v; }` 한 줄 규칙이 흔하다)
 *   2. JS/TS `setProperty('--x', ...)`
 *   3. JSX 인라인 `style={{ '--x': ... }}` / `"--x":` / `[`--x`]:`
 *   4. @property 등록
 *
 * 예외: 직전 2줄 내 `TOKEN-REF-EXCEPTION` 주석
 * Exit: FAIL 있으면 1, 아니면 0.
 * 본문 룰: docs/rules/ui/design-system.md UI-TOKEN-REF-001
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')

const REPORT = process.argv.includes('--report')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && /\.(css|tsx|ts)$/.test(ent.name)) out.push(full)
  }
  return out
}

/** 주석 제거(줄 구조 보존) — 룰을 설명하는 주석 산문이 위반으로 잡히는 자기모순 방지 */
function stripComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  return out
    .split('\n')
    .map((line) => {
      const i = line.search(/(^|[^:])\/\//)
      if (i === -1) return line
      const at = line.indexOf('//', i)
      return line.slice(0, at) + ' '.repeat(line.length - at)
    })
    .join('\n')
}

const files = walk(SRC)
const defined = new Set()
const bodies = new Map()

for (const f of files) {
  const body = stripComments(fs.readFileSync(f, 'utf8'))
  bodies.set(f, body)

  // 1) CSS 정의 — 줄 어디서든. `{` `;` 또는 줄머리 뒤에 오는 --x:
  for (const m of body.matchAll(/(?:^|[{;])\s*(--[\w-]+)\s*:/gm)) defined.add(m[1])
  // 4) @property 등록
  for (const m of body.matchAll(/@property\s+(--[\w-]+)/g)) defined.add(m[1])
  // 2) setProperty
  for (const m of body.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) defined.add(m[1])
  // 3) JSX 인라인 style 객체 키 — '--x': / "--x": / `--x`:
  for (const m of body.matchAll(/['"`](--[\w-]+)['"`]\s*:/g)) defined.add(m[1])
  // 3-b) 계산된 키 — style={{ ['--x' as string]: v }} 형태.
  //      TS 에서 커스텀 프로퍼티를 넣을 때 흔한 관용구인데, 3) 의 정규식은 닫는 따옴표 뒤에
  //      바로 ':' 이 와야 매칭돼서 ' as string]' 이 끼면 놓친다 (실제로 --reg-font-size 를
  //      거짓 팬텀으로 잡았다 — 2026-08-09).
  for (const m of body.matchAll(/\[\s*['"`](--[\w-]+)['"`]/g)) defined.add(m[1])
}

const fails = []
const warns = []

for (const f of files) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  const body = bodies.get(f)
  const lines = body.split('\n')
  const rawLines = fs.readFileSync(f, 'utf8').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes('var(')) continue
    if (/TOKEN-REF-EXCEPTION/.test(rawLines.slice(Math.max(0, i - 2), i + 1).join('\n'))) continue

    // var( --x [, fallback] ) — 폴백 유무를 콤마로 판별
    for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
      const tok = m[1]
      if (defined.has(tok)) continue
      const hasFallback = Boolean(m[2])
      const rec = { file: rel, line: i + 1, tok, text: rawLines[i].trim().slice(0, 110) }
      if (hasFallback) warns.push(rec)
      else fails.push(rec)
    }
  }
}

const uniq = (arr) => [...new Set(arr.map((r) => r.tok))]

if (REPORT) {
  console.log(`[token-refs] 스캔 ${files.length}파일 · 정의된 토큰 ${defined.size}종`)
  console.log(`  FAIL(폴백 없음) ${fails.length}건 / ${uniq(fails).length}종 → ${uniq(fails).join(', ') || '-'}`)
  console.log(`  WARN(폴백 있음) ${warns.length}건 / ${uniq(warns).length}종 → ${uniq(warns).join(', ') || '-'}`)
  for (const w of warns) console.log(`    ${w.file}:${w.line}  ${w.tok}`)
  process.exit(0)
}

if (warns.length > 0) {
  console.log(`\n⚠️  UI-TOKEN-REF-001 (WARN) ${warns.length}건 — 미정의지만 폴백이 있어 폴백값으로만 보인다:`)
  for (const w of warns) console.log(`  ${w.file}:${w.line}  ${w.tok}  ${w.text}`)
}

if (fails.length > 0) {
  console.log(`\n❌ [F / UI-TOKEN-REF-001] 폴백 없는 팬텀 var() ${fails.length}건 — 선언이 조용히 죽는다`)
  for (const f of fails) console.log(`  ${f.file}:${f.line}  ${f.tok}  ${f.text}`)
  console.log('  → 토큰을 정의하거나(tokens.css), 폴백을 주거나, 직전 줄에 /* TOKEN-REF-EXCEPTION: 사유 */.')
  console.log(`  (스캔 우주: src/ 아래 css+tsx+ts ${files.length}개 파일 · 정의 ${defined.size}종)`)
  process.exit(1)
}

console.log(`✅ check:token-refs — UI-TOKEN-REF-001 위반 0건 (스캔 ${files.length}파일 · 정의 ${defined.size}종)${warns.length ? ` · WARN ${warns.length}` : ''}`)
process.exit(0)
