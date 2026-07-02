#!/usr/bin/env node
/**
 * UI-TEXT-SIZE-001 가드 — 50-60대 가독 하한 + 글자 크기 설정 우회 방지.
 * (2026-07-02 대개편 감사에서 신설 — 달력 출근시각 10px 같은 사고 재발 방지)
 *
 * 잡는 패턴 (변경 라인만 --staged/--changed · 전체는 all 리포트):
 *   [FAIL] font-size 에 13px 미만 raw 값 — 어떤 경우에도 불허 (CLAUDE.md §1.1)
 *   [WARN] font-size 에 13px 이상 raw px — var(--dia-text-*) 토큰 권장
 *          (raw px 는 font-small/large/xlarge 글자 크기 설정을 우회한다)
 *   [WARN] 버튼성 셀렉터(btn/button/chip/tab/fab)의 min-height|height < 40px raw
 *          — 터치 타겟 44px 권장(최소 40px)
 *
 * 안 잡는 것:
 *   - var(--dia-*) / em / rem / % / inherit (토큰·상대 단위)
 *   - components/dev/ (프로덕션 미노출)
 *   - 직전 2줄 내 TEXT-EXCEPTION / STYLE-EXCEPTION / SIZE-EXCEPTION 주석
 *
 * Exit: FAIL 있으면 1, 아니면 0.
 * 본문 룰: docs/rules/ui/design-system.md UI-TEXT-SIZE-001
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

const FONT_RE = /\bfont-size\s*:\s*([^;{}]+)/g
const TOUCH_SEL_RE = /\.[a-zA-Z_][\w-]*(?:[Bb]tn|[Bb]utton|[Cc]hip|[Tt]ab\b|[Ff]ab)\b/
const HEIGHT_RE = /\b(min-height|height)\s*:\s*([^;{}]+)/g

function rawPx(value) {
  const v = value.trim()
  if (/var\(/.test(v)) return null
  const m = v.match(/^(\d*\.?\d+)px$/)
  return m ? parseFloat(m[1]) : null
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && (full.endsWith('.module.css') || full.endsWith('globals.css'))) out.push(full)
  }
  return out
}

function getDiffCssFiles(mode) {
  const cached = mode === 'staged' ? '--cached' : ''
  try {
    const out = execSync(`git diff ${cached} --name-only --diff-filter=ACMR`, { cwd: REPO_ROOT, encoding: 'utf8' })
    return out.split('\n')
      .filter(f => (f.endsWith('.module.css') || f.endsWith('globals.css')) && f.startsWith('src/'))
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
  if (rel.includes('components/dev/')) return { fails: [], warns: [] }
  const changed = getChangedLineSet(file, mode)
  const lines = src.split('\n')
  const fails = []
  const warns = []

  const pushIfChanged = (arr, lineNo, msg) => {
    const prev = lines.slice(Math.max(0, lineNo - 3), lineNo - 1).join('\n')
    if (/TEXT-EXCEPTION|STYLE-EXCEPTION|SIZE-EXCEPTION/.test(prev)) return
    if (mode !== 'all' && changed && !changed.has(lineNo)) return
    arr.push({ file: rel, line: lineNo, msg })
  }

  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(src)) !== null) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@') || selector.startsWith('/*')) continue

    let g
    FONT_RE.lastIndex = 0
    while ((g = FONT_RE.exec(body)) !== null) {
      const px = rawPx(g[1])
      if (px === null) continue
      const declOffset = m.index + m[0].indexOf(g[0])
      const lineNo = src.slice(0, declOffset).split('\n').length
      if (px < 13) {
        pushIfChanged(fails, lineNo, `font-size: ${px}px — 13px 미만 절대 금지`)
      } else {
        pushIfChanged(warns, lineNo, `font-size: ${px}px — raw px 는 글자 크기 설정을 우회, var(--dia-text-*) 사용`)
      }
    }

    if (TOUCH_SEL_RE.test(selector)) {
      HEIGHT_RE.lastIndex = 0
      while ((g = HEIGHT_RE.exec(body)) !== null) {
        const px = rawPx(g[2])
        if (px === null || px >= 40) continue
        const declOffset = m.index + m[0].indexOf(g[0])
        const lineNo = src.slice(0, declOffset).split('\n').length
        pushIfChanged(warns, lineNo, `${g[1]}: ${px}px — 인터랙티브 요소 터치 타겟 44px 권장(최소 40px)`)
      }
    }
  }
  return { fails, warns }
}

function main() {
  let files
  if (MODE === 'all') {
    files = walk(SRC)
  } else {
    files = getDiffCssFiles(MODE)
    if (files.length === 0) {
      console.log(`check:text-size — ${MODE} CSS 0건, skip`)
      process.exit(0)
    }
  }
  const fails = []
  const warns = []
  for (const f of files) {
    if (!fs.existsSync(f)) continue
    const r = checkFile(f, MODE)
    fails.push(...r.fails)
    warns.push(...r.warns)
  }
  if (warns.length > 0) {
    console.log(`\n⚠️  UI-TEXT-SIZE-001 (WARN) ${warns.length}건:`)
    for (const w of warns) console.log(`  ${w.file}:${w.line}  ${w.msg}`)
  }
  if (fails.length > 0) {
    console.log(`\n❌ [F / UI-TEXT-SIZE-001] 13px 미만 텍스트 ${fails.length}건 — read: docs/rules/ui/design-system.md`)
    for (const f of fails) console.log(`  ${f.file}:${f.line}  ${f.msg}`)
    console.log('  예외가 필요하면 직전 줄에 /* TEXT-EXCEPTION: 사유 */ (장식/dev 전용만).')
    process.exit(1)
  }
  console.log(`✅ check:text-size — UI-TEXT-SIZE-001 위반 0건${warns.length ? ` (WARN ${warns.length})` : ''}`)
  process.exit(0)
}

main()
