#!/usr/bin/env node
// ============================================================================
// install-hooks.mjs — git hooks path 를 .githooks 로 가리킴
//
// 동작:
//   git config core.hooksPath .githooks
//   (Windows 에서도 동작 — pre-commit 는 sh 셔뱅 + Git Bash 가 처리)
//
// 우회: git commit --no-verify
// 제거: node scripts/install-hooks.mjs --uninstall
//
// 기본 자동 설치 X — 명시적으로 npm run install:hooks 실행해야 함.
// 단일 앱 레이아웃: 레포 루트 = scripts/ 의 부모, .githooks 는 루트 직하.
// ============================================================================

import { execSync } from 'node:child_process'
import { existsSync, chmodSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(import.meta.dirname ?? '.', '..')
const HOOKS_DIR = join(ROOT, '.githooks')
const args = process.argv.slice(2)
const UNINSTALL = args.includes('--uninstall')

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
}

try {
  if (UNINSTALL) {
    run('git config --unset core.hooksPath')
    console.log('✅ git hooks uninstalled (core.hooksPath unset).')
    process.exit(0)
  }

  if (!existsSync(HOOKS_DIR)) {
    console.error(`❌ ${HOOKS_DIR} not found.`)
    process.exit(1)
  }

  // chmod +x for pre-commit (POSIX 환경에서만 의미. Windows 는 무해.)
  const preCommit = join(HOOKS_DIR, 'pre-commit')
  if (existsSync(preCommit)) {
    try {
      const mode = statSync(preCommit).mode
      chmodSync(preCommit, mode | 0o755)
    } catch { /* Windows fs.chmod 일부 무시 — 무해 */ }
  }

  run('git config core.hooksPath .githooks')
  const verify = run('git config core.hooksPath')
  console.log(`✅ git hooks installed. core.hooksPath = ${verify}`)
  console.log('   - 상태 확인: npm run check:hooks')
  console.log('   - 우회 금지: git commit --no-verify')
  console.log('   - 제거: node scripts/install-hooks.mjs --uninstall  (운영 commit 전 절대 비추)')
} catch (e) {
  console.error(`❌ install-hooks failed: ${e.message}`)
  process.exit(1)
}
