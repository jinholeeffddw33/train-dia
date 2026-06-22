#!/usr/bin/env node
/**
 * ★ train-dia 이식본 (ZINOSB 시스템 적응 복사 2026-06-23)
 * UI-RHYTHM-001 가드 (WARN) — 카드/섹션 리듬 토큰 권장.
 *
 * 진호 directive(2026-06-22 전역 통일): 카드 사이 간격이 제각각(거래 10 / 커뮤 8 / 클럽 8).
 * 카드 리스트/그리드 컨테이너의 gap 은 의미 토큰(--dia-space-3=12 / --dia-space-6=24) 또는
 * --dia-space-* 스케일을 써서 전역에서 같은 리듬이 되게.
 *
 * 잡는 패턴 (변경 라인 · WARN 만 — 빌드 안 막음):
 *   컨테이너성 셀렉터(.*list / .*grid / .*feed / .*cards / .*items / .*stack / .*scroller)의
 *   gap / row-gap / column-gap 에 raw px 값(토큰 아님) → WARN.
 *
 * 안 잡는 것:
 *   - var(--dia-*) 토큰 gap (정답)
 *   - 0 / 0px (간격 없음)
 *   - 컨테이너 이름 아님(버튼 안 아이콘 gap 등 — 셀렉터 이름으로 좁혀 오발동 최소화)
 *   - 직전 줄 RHYTHM-EXCEPTION / STYLE-EXCEPTION 주석
 *   - 변경 라인만(--staged/--changed). 전체(all)는 리포트.
 *
 * Exit: 항상 0 (WARN 전용 — 향후 fail 승격 후보)
 * 본문 룰: docs/rules/ui/design-system.md UI-RHYTHM-001
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')

const args = process.argv.slice(2)
const MODE = args.includes('--staged') ? 'staged'
  : args.includes('--changed') ? 'changed'
  : 'all'

// 카드 리스트/그리드 컨테이너성 클래스 이름
const CONTAINER_RE = /\.[a-zA-Z_][\w-]*(?:[Ll]ist|[Gg]rid|[Ff]eed|[Cc]ards|[Ii]tems|[Ss]tack|[Ss]croller)\b/
// gap 류 선언에 raw px (var 토큰 아님, 0 아님)
const GAP_RE = /\b(gap|row-gap|column-gap)\s*:\s*([^;{}]+)/g

function hasRawPx(value) {
  const v = value.trim()
  if (/var\(/.test(v)) return false
  const nums = [...v.matchAll(/(\d*\.?\d+)px/g)].map(x => parseFloat(x[1]))
  if (nums.length === 0) return false
  // 1~3px = 의도된 타이트 사진/스펙 그리드(붙은 타일) → 리듬 토큰 대상 아님
  if (Math.max(...nums) <= 3) return false
  return true
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && full.endsWith('.module.css')) out.push(full)
  }
  return out
}

function getDiffCssFiles(mode) {
  const cached = mode === 'staged' ? '--cached' : ''
  try {
    const out = execSync(`git diff ${cached} --name-only --diff-filter=ACMR`, { cwd: REPO_ROOT, encoding: 'utf8' })
    return out.split('\n')
      .filter(f => f.endsWith('.module.css') && f.startsWith('src/'))
      .map(f => path.join(REPO_ROOT, f))
  } catch { return [] }
}

function getChangedLineSet(file, mode) {
  if (mode === 'all') return null
  const cached = mode === 'staged' ? '--cached' : ''
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  try {
    const diff = execSync(`git diff ${cached} --unified=0 -- "${rel}"`, { cwd: REPO_ROOT, encoding: 'utf8' })
    const set = new Set()
    let cur = 0
    for (const line of diff.split('\n')) {
      const hunk = line.match(/^@@\s-\d+(?:,\d+)?\s\+(\d+)(?:,\d+)?\s@@/)
      if (hunk) { cur = parseInt(hunk[1], 10) - 1; continue }
      if (line.startsWith('+') && !line.startsWith('+++')) { cur++; set.add(cur) }
      else if (!line.startsWith('-') && !line.startsWith('---')) { cur++ }
    }
    return set
  } catch { return null }
}

function checkFile(file, mode) {
  const src = fs.readFileSync(file, 'utf8')
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  const changed = getChangedLineSet(file, mode)
  const lines = src.split('\n')
  const warns = []

  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(src)) !== null) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@') || selector.startsWith('/*')) continue
    if (!CONTAINER_RE.test(selector)) continue
    let g
    GAP_RE.lastIndex = 0
    while ((g = GAP_RE.exec(body)) !== null) {
      if (!hasRawPx(g[2])) continue
      const declOffset = m.index + m[0].indexOf(g[0])
      const lineNo = src.slice(0, declOffset).split('\n').length
      const prev = lines.slice(Math.max(0, lineNo - 3), lineNo - 1).join('\n')
      if (/RHYTHM-EXCEPTION|STYLE-EXCEPTION/.test(prev)) continue
      if (mode !== 'all' && changed && !changed.has(lineNo)) continue
      warns.push({ file: rel, line: lineNo, decl: `${g[1]}: ${g[2].trim()}`, sel: selector.split(',')[0].trim() })
    }
  }
  return warns
}

function main() {
  let files
  if (MODE === 'all') {
    files = walk(SRC)
  } else {
    files = getDiffCssFiles(MODE)
    if (files.length === 0) {
      console.log(`check:card-rhythm — ${MODE} CSS 0건, skip`)
      process.exit(0)
    }
  }
  const all = []
  for (const f of files) {
    if (!fs.existsSync(f)) continue
    all.push(...checkFile(f, MODE))
  }
  if (all.length === 0) {
    console.log('✅ check:card-rhythm — UI-RHYTHM-001 위반 0건')
    process.exit(0)
  }
  console.log(`\n⚠️  UI-RHYTHM-001 (WARN) — 카드/섹션 컨테이너 gap 에 raw px (토큰 권장) ${all.length}건:`)
  for (const f of all) {
    console.log(`  ${f.file}:${f.line}  ${f.sel} { ${f.decl} }`)
  }
  console.log('\n  카드 간격은 var(--dia-space-3)(12), 섹션 간격은 var(--dia-space-6)(24), 그 외 --dia-space-* 스케일 사용 권장.')
  console.log('  의도된 예외는 규칙 직전 줄에 /* RHYTHM-EXCEPTION: 사유 */ 주석.')
  console.log('  (WARN — 빌드는 막지 않음. 본문: docs/rules/ui/design-system.md UI-RHYTHM-001)')
  process.exit(0)
}

main()
