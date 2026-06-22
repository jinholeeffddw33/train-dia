#!/usr/bin/env node
// ============================================================================
// ensure-hooks.mjs — git pre-commit hook 활성 여부 확인
//
// 검사:
//   1. git config core.hooksPath == .githooks
//   2. .githooks/pre-commit 파일 존재
//   3. (POSIX) 실행 권한 확인 — Windows 는 .sh 셔뱅 + Git Bash 가 처리
//
// 모드:
//   --soft : 비활성이면 안내만 출력하고 exit 0 (postinstall 용)
//   --strict (기본): 비활성이면 exit 1 (check:hooks 용)
//
// 사용:
//   node scripts/ensure-hooks.mjs            # strict (commit 전 / CI)
//   node scripts/ensure-hooks.mjs --soft     # postinstall (개발자 환경 부드럽게)
//
// 단일 앱 레이아웃: 레포 루트 = scripts/ 의 부모, .githooks 는 루트 직하.
// ============================================================================

import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(import.meta.dirname ?? '.', '..')
const SOFT = process.argv.includes('--soft')

const fails = []
const warns = []

function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return '' }
}

// 1. core.hooksPath
const hooksPath = run('git config core.hooksPath')
if (hooksPath !== '.githooks') {
  fails.push(`core.hooksPath = "${hooksPath || '(unset)'}"  (expected ".githooks")`)
}

// 2. pre-commit 존재
const preCommit = join(ROOT, '.githooks', 'pre-commit')
if (!existsSync(preCommit)) {
  fails.push('.githooks/pre-commit missing')
}

// 3. POSIX 실행 권한 (Windows 에서는 stat 모드 의미 약함 → warn)
if (existsSync(preCommit) && process.platform !== 'win32') {
  try {
    const mode = statSync(preCommit).mode
    const isExec = (mode & 0o111) !== 0
    if (!isExec) warns.push('.githooks/pre-commit not executable — run: chmod +x .githooks/pre-commit')
  } catch { /* 무시 */ }
}

// ── 보고 ──
const allOk = fails.length === 0

if (allOk) {
  console.log(`✅ pre-commit hook 활성. core.hooksPath = ${hooksPath}`)
  if (warns.length) {
    console.log(`\n⚠️  WARN:`)
    for (const w of warns) console.log(`   ${w}`)
  }
  process.exit(0)
}

console.log(`❌ pre-commit hook NOT 활성.`)
console.log('')
for (const f of fails) console.log(`   - ${f}`)
console.log('')
console.log(`📌 활성화: npm run install:hooks   (한 번만)`)
console.log(`📌 확인:   npm run check:hooks`)
console.log('')

if (SOFT) {
  console.log('(soft mode — exit 0)')
  process.exit(0)
}
process.exit(1)
