#!/usr/bin/env node
/**
 * UI-MOTION-001 가드 — transition 의 duration/easing 은 토큰 경유 (ZINOSB 적응 이식 2026-08-09)
 *
 * 왜 —
 *   실측(2026-08-09): transition duration 이 **22종 210선언(334개 값)** 으로 흩어져 있었다.
 *   기존 `--dia-transition-*` 3종(150/250/350ms)은 **사용 0회** — 정의만 있고 실사용 지배값
 *   (0.12s 97 · 0.15s 53)과 아예 안 맞아서 아무도 안 썼다. 또 하나의 미완주 마이그레이션.
 *   같은 성격의 인터랙션인데 0.12/0.14/0.15/0.18 이 섞이면 "이 앱은 왜 반응이 들쭉날쭉하지"가 된다.
 *
 * ★ 토큰은 "예쁜 숫자"가 아니라 **실사용 지배값 그대로** 잡았다(값 보존).
 *   0.1 / 0.12 / 0.15 는 CLAUDE.md §2.6 press 3티어(아이콘/버튼/카드)와도 일치한다.
 *
 * 잡는 것 (baseline 래칫 — 기존 잔량은 등록, 신규 유입만 FAIL):
 *   [FAIL] transition 선언 안의 raw duration (0.14s 처럼 토큰 밖 값)
 *   [FAIL] raw cubic-bezier(...)  — var(--dia-ease-*) 사용
 *   [FAIL] baseline stale (갚았는데 baseline 을 안 낮춤)
 *
 * 안 잡는 것:
 *   - `animation` 의 duration — 루프/장식이라 인터랙션 스케일과 성격이 다르다
 *   - prefers-reduced-motion 오버라이드(0.01ms)
 *   - tokens.css 의 토큰 정의부
 *   - 직전 2줄 내 MOTION-EXCEPTION 주석
 *
 * 부채를 갚았으면: npm run check:motion:update
 * 본문 룰: docs/rules/ui/design-system.md UI-MOTION-001
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')
const BASELINE = path.join(REPO_ROOT, 'docs', 'ops', 'motion-baseline.json')

const UPDATE = process.argv.includes('--update')
const REPORT = process.argv.includes('--report')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && ent.name.endsWith('.css')) out.push(full)
  }
  return out
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const current = {}
for (const f of walk(SRC)) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  if (rel.endsWith('src/styles/tokens.css')) continue
  const raw = fs.readFileSync(f, 'utf8')
  const src = stripComments(raw)
  let n = 0

  // transition 선언(멀티라인 포함) 안의 raw duration
  for (const m of src.matchAll(/transition(?:-duration)?\s*:([^;{}]*);/g)) {
    const body = m[1]
    if (/0\.01ms/.test(body)) continue
    n += [...body.matchAll(/(?<![\w.-])\d+(?:\.\d+)?m?s(?![\w-])/g)].length
  }
  // raw cubic-bezier (transition/animation 무관 — easing 은 전부 토큰)
  n += [...src.matchAll(/cubic-bezier\s*\(/g)].length

  if (n > 0) current[rel] = n
}

const total = Object.values(current).reduce((a, b) => a + b, 0)

if (UPDATE) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
  fs.writeFileSync(BASELINE, JSON.stringify({
    _comment: 'UI-MOTION-001 baseline — 파일별 raw transition duration + raw cubic-bezier 잔량. 갚으면 npm run check:motion:update.',
    total, files: current,
  }, null, 2) + '\n', 'utf8')
  console.log(`[motion] baseline 갱신 — 파일 ${Object.keys(current).length}개 / raw ${total}건`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.log('❌ baseline 없음 — npm run check:motion:update 로 먼저 생성')
  process.exit(1)
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
const bf = base.files ?? {}

if (REPORT) {
  console.log(`[motion] 현재 raw ${total}건 / baseline ${base.total}건 · 파일 ${Object.keys(current).length}개`)
  for (const [f, n] of Object.entries(current).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}건  ${f}`)
  process.exit(0)
}

const fails = [], stale = []
for (const [f, n] of Object.entries(current)) {
  const b = bf[f]
  if (b === undefined) fails.push(`${f}  baseline 에 없는 파일이 raw 모션값 ${n}건 사용`)
  else if (n > b) fails.push(`${f}  raw ${b} → ${n} 증가 (새 부채 유입)`)
}
for (const [f, b] of Object.entries(bf)) {
  const n = current[f] ?? 0
  if (n < b) stale.push(`${f}  ${b} → ${n} 로 줄었다. npm run check:motion:update`)
}

if (fails.length || stale.length) {
  if (fails.length) {
    console.log(`\n❌ [F / UI-MOTION-001] 새 부채 ${fails.length}건 — var(--dia-dur-*) / var(--dia-ease-*) 사용`)
    for (const f of fails) console.log(`  ${f}`)
    console.log('  duration: instant 0.1 · fast 0.12 · base 0.15 · slow 0.2 · slower 0.3')
    console.log('  easing  : --dia-ease / -out(진입) / -in(퇴장) / -press / -spring')
  }
  if (stale.length) {
    console.log(`\n❌ [F / UI-MOTION-001] baseline stale ${stale.length}건`)
    for (const f of stale) console.log(`  ${f}`)
  }
  console.log('\n  예외는 직전 줄 /* MOTION-EXCEPTION: 사유 */.')
  process.exit(1)
}

console.log(`✅ check:motion — UI-MOTION-001 신규 위반 0건 (raw ${total}건 = baseline)`)
process.exit(0)
