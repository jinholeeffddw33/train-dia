#!/usr/bin/env node
/**
 * 1회성 마이그레이션 — 모달들이 각자 잠그던 body 스크롤을 SSOT 로 옮긴다 (2026-08-18).
 *
 *   const prev = document.body.style.overflow      →  acquireScrollLock()
 *   document.body.style.overflow = 'hidden'
 *   ...
 *   document.body.style.overflow = prev            →  releaseScrollLock()
 *
 * 왜 스크립트인가: 13개 파일에 **완전히 같은 4줄**이 흩어져 있다. 손으로 고치면
 * 한둘은 반드시 다르게 고쳐지고, 그 하나가 나중에 중첩 사고의 씨앗이 된다.
 * 기계적으로 같은 것은 기계가 바꾸고, 다른 것(매칭 실패)은 사람이 본다.
 *
 * 안전장치: 패턴이 정확히 안 맞으면 **그 파일은 건드리지 않고 보고**한다.
 * 실행 후 반드시 `npx tsc --noEmit` + `node scripts/check-ai-rules.mjs --all` 로 검증할 것.
 *
 * 사용: node scripts/migrate-scroll-lock.mjs [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')
const DRY = process.argv.includes('--dry')

/** 잠금 SSOT 자신과 테스트는 제외 */
function isExempt(rel) {
  return rel.includes('lib/overlay/scrollLockManager')
    || rel.includes('__tests__/')
    || rel.includes('lib/originGuard') // 킬 스위치 — 되돌릴 일이 없는 영구 차단이라 성격이 다르다
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(full)) out.push(full)
  }
  return out
}

/** import 를 알파벳 순서 신경 안 쓰고 마지막 import 뒤에 넣는다 */
function addImport(src) {
  if (/from '@\/lib\/overlay\/scrollLockManager'/.test(src)) return src
  const importRe = /^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm
  let last = null
  let m
  while ((m = importRe.exec(src)) !== null) last = m
  const line = "import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';"
  if (!last) return line + '\n' + src
  const at = last.index + last[0].length
  return src.slice(0, at) + '\n' + line + src.slice(at)
}

const results = { changed: [], skipped: [], untouched: [] }

for (const file of walk(SRC)) {
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  if (isExempt(rel)) continue

  let src = fs.readFileSync(file, 'utf8')
  if (!/document\.body\.style\.overflow/.test(src)) continue

  const before = src

  // 1) 잠금: `const <var> = document.body.style.overflow;` + `document.body.style.overflow = 'hidden';`
  //    두 줄이 (사이에 다른 줄이 끼어도) 이어져 나오는 형태를 acquireScrollLock() 한 줄로.
  const lockRe = /([ \t]*)const\s+(\w+)\s*=\s*document\.body\.style\.overflow;\s*\n([\s\S]{0,200}?)[ \t]*document\.body\.style\.overflow\s*=\s*'hidden';/g
  const capturedVars = new Set()
  src = src.replace(lockRe, (_full, indent, varName, between) => {
    capturedVars.add(varName)
    // 사이에 있던 코드(리스너 등록 등)는 그대로 보존한다
    const mid = between.replace(/\n\s*$/, '')
    return `${indent}acquireScrollLock();` + (mid.trim() ? `\n${mid}` : '')
  })

  // 2) 해제: `document.body.style.overflow = <그 변수>;` → releaseScrollLock()
  for (const varName of capturedVars) {
    const unlockRe = new RegExp(`document\\.body\\.style\\.overflow\\s*=\\s*${varName};`, 'g')
    src = src.replace(unlockRe, 'releaseScrollLock();')
  }

  if (src === before) {
    results.skipped.push(rel)
    continue
  }

  // 잔재가 남았으면(변형 패턴) 되돌리고 사람이 보게 한다
  if (/document\.body\.style\.overflow/.test(src)) {
    results.skipped.push(rel + '  (부분 매칭 — 잔재 남음, 수동 확인 필요)')
    continue
  }

  src = addImport(src)
  if (!DRY) fs.writeFileSync(file, src, 'utf8')
  results.changed.push(rel)
}

console.log(`\n${DRY ? '[DRY RUN] ' : ''}전환됨 ${results.changed.length}개`)
results.changed.forEach((f) => console.log('  ✓ ' + f))
if (results.skipped.length) {
  console.log(`\n⚠ 수동 확인 필요 ${results.skipped.length}개`)
  results.skipped.forEach((f) => console.log('  ! ' + f))
}
console.log('\n다음: npx tsc --noEmit && npx vitest run')
