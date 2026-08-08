#!/usr/bin/env node
/**
 * API-ENVELOPE-001 가드 — API 라우트 응답은 봉투 SSOT 경유 (ZINOSB 적응 이식 2026-08-09)
 *
 * 왜 baseline 래칫인가 —
 *   실측(2026-08-09): API 39개 / raw NextResponse.json **340건**.
 *   전부 한 번에 바꾸면 그 API 를 읽는 프론트 소비처를 동시에 다 고쳐야 하고, 하나라도
 *   놓치면 그 화면이 **조용히 빈다**. 기관사 175명이 실제 근무 정보를 보는 앱이라
 *   일괄 변환은 선택지가 아니다(진호 2026-08-09 지시).
 *   → 기존 340건은 baseline 에 등록(WARN 취급), **신규 유입만 FAIL**.
 *   → 전환할 때는 한 커밋 = 한 API + 그 소비처 전부.
 *
 * 판정:
 *   [FAIL] 파일의 raw NextResponse.json 수가 baseline 보다 **늘었다** = 새 부채 유입
 *   [FAIL] baseline 에 없는 새 API 파일이 raw 를 쓴다
 *   [FAIL] baseline 이 stale — 실제로 줄었는데 baseline 을 안 낮췄다
 *          ("등록만 해두면 영원히 통과"하는 구멍 차단)
 *
 * 부채를 갚았으면: npm run check:envelope:update
 *
 * 봉투 SSOT: src/lib/api/response.ts (errorResponse / okJson / internalError / parseBody)
 * 본문 룰: docs/rules/registry.json API-ENVELOPE-001
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const API_DIR = path.join(REPO_ROOT, 'src', 'app', 'api')
const BASELINE = path.join(REPO_ROOT, 'docs', 'ops', 'api-envelope-baseline.json')

const UPDATE = process.argv.includes('--update')
const REPORT = process.argv.includes('--report')

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && ent.name.endsWith('.ts')) out.push(full)
  }
  return out
}
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .split('\n').map((l) => { const i = l.search(/(^|[^:])\/\//); if (i === -1) return l; const at = l.indexOf('//', i); return l.slice(0, at) })
   .join('\n')

const current = {}
for (const f of walk(API_DIR)) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  const body = stripComments(fs.readFileSync(f, 'utf8'))
  const n = [...body.matchAll(/NextResponse\.json\s*\(/g)].length
  if (n > 0) current[rel] = n
}

const total = Object.values(current).reduce((a, b) => a + b, 0)

if (UPDATE) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
  fs.writeFileSync(BASELINE, JSON.stringify({
    _comment: 'API-ENVELOPE-001 baseline — 파일별 raw NextResponse.json 잔량. 전환하면 npm run check:envelope:update 로 낮춘다(안 낮추면 stale=FAIL).',
    _updated: process.env.ENVELOPE_BASELINE_DATE ?? 'unknown',
    total,
    files: current,
  }, null, 2) + '\n', 'utf8')
  console.log(`[envelope] baseline 갱신 — 파일 ${Object.keys(current).length}개 / raw ${total}건`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.log('❌ baseline 파일이 없다 — npm run check:envelope:update 로 먼저 생성할 것')
  process.exit(1)
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
const baseFiles = base.files ?? {}

if (REPORT) {
  console.log(`[envelope] 현재 raw ${total}건 / baseline ${base.total}건 · 파일 ${Object.keys(current).length}개`)
  const converted = Object.keys(baseFiles).filter((f) => (current[f] ?? 0) < baseFiles[f])
  console.log(`  전환 진행 파일: ${converted.length}개 ${converted.length ? '→ ' + converted.join(', ') : ''}`)
  process.exit(0)
}

const fails = []
for (const [file, n] of Object.entries(current)) {
  const b = baseFiles[file]
  if (b === undefined) fails.push({ file, msg: `baseline 에 없는 파일이 raw NextResponse.json ${n}건 사용 — 신규 라우트는 봉투 SSOT 를 쓸 것` })
  else if (n > b) fails.push({ file, msg: `raw NextResponse.json ${b} → ${n} 로 증가 (새 부채 유입)` })
}
const stale = []
for (const [file, b] of Object.entries(baseFiles)) {
  const n = current[file] ?? 0
  if (n < b) stale.push({ file, msg: `${b} → ${n} 로 줄었다. baseline 을 낮춰라: npm run check:envelope:update` })
}

if (fails.length || stale.length) {
  if (fails.length) {
    console.log(`\n❌ [F / API-ENVELOPE-001] 새 부채 ${fails.length}건 — src/lib/api/response.ts 의 errorResponse/okJson/internalError/parseBody 사용`)
    for (const f of fails) console.log(`  ${f.file}  ${f.msg}`)
  }
  if (stale.length) {
    console.log(`\n❌ [F / API-ENVELOPE-001] baseline stale ${stale.length}건 — 갚은 부채를 baseline 에도 반영해야 한다`)
    for (const f of stale) console.log(`  ${f.file}  ${f.msg}`)
  }
  console.log(`\n  (현재 raw ${total}건 / baseline ${base.total}건 · 전환은 "한 커밋 = 한 API + 그 소비처 전부")`)
  process.exit(1)
}

console.log(`✅ check:envelope — API-ENVELOPE-001 신규 위반 0건 (raw ${total}건 = baseline, 파일 ${Object.keys(current).length}개)`)
process.exit(0)
