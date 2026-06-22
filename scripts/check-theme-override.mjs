#!/usr/bin/env node
/**
 * ★ train-dia 이식본 (ZINOSB 시스템 적응 복사 2026-06-23)
 *
 * CSS-THEME-OVERRIDE-001 가드 — 테마 오버라이드가 다크 gradient/이미지를 못 지우는 버그 거부.
 *
 * 진호 P0 (2026-06-22, 지도 바텀시트): 다크 베이스가 `background:`(shorthand) 로 navy gradient
 * *이미지* 를 깔았는데, 라이트 오버라이드(:global([data-theme="light"]) ...)가 `background-color:`
 * longhand 만 바꿈 → background-color 는 background-image 를 못 지운다 → 다크 gradient 가 라이트에서도
 * 그대로 남아 "라이트인데 시커멓게" 보였다.
 *
 * 잡는 패턴:
 *   같은 클래스에 대해
 *     - BASE 규칙(테마 스코프 없음, 즉 다크 기본)이 `background:`(shorthand) 또는 `background-image:` 로
 *       gradient/url(이미지) 를 깔았는데,
 *     - 반대 테마 오버라이드([data-theme="light"] / .light / :root.light / :not([data-theme="dark"]))가
 *       `background-color:` 만 세팅하고 `background:`/`background-image:` 는 안 건드림
 *   → FAIL. 오버라이드를 `background:`(shorthand) 또는 `background-image:` 로 이미지째 교체하거나,
 *     테마 토큰(--z-sheet-surface, --z-card-fill 등 테마가 값을 가르는 변수)을 써라.
 *
 * ★ train-dia 라이트 테마 토글 (zinosb 와 다름):
 *   train-dia 는 라이트를 `:root.light` 클래스 + `html[data-theme='light']` 둘 다 쓴다
 *   (stores/theme.ts). CSS Module 에선 `:global(:root.light) .className` 형태로 자주 나온다.
 *   → themeScope() 가 `.light` 클래스 prefix(:root.light 포함) 도 light 로 판정.
 *   다크 베이스는 `:root`(클래스 없음) = base, `html[data-theme='dark']` = dark.
 *
 * 레거시 마비 방지:
 *   - 변경 라인만(--staged/--changed). 전체 스캔(all)은 리포트.
 *   - 직전 줄 THEME-EXCEPTION / STYLE-EXCEPTION 주석이면 면제.
 *   - 베이스 background 가 단색(토큰/색)이면 통과(이미지 관여할 때만 FAIL).
 *
 * Usage:
 *   node scripts/check-theme-override.mjs            # 전체 스캔(리포트)
 *   node scripts/check-theme-override.mjs --staged   # pre-commit (변경 라인만)
 *   node scripts/check-theme-override.mjs --changed  # working tree 변경분
 *
 * Exit: 0 = OK, 1 = FAIL
 * 본문 룰: docs/rules/ui/design-system.md CSS-THEME-OVERRIDE-001
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

const IMAGE_RE = /(linear|radial|conic)-gradient|url\(/
// background shorthand(=background:) — background-color/background-image/background-* longhand 은 제외.
const BG_SHORTHAND_RE = /(^|[;{]|\s)background:\s*([^;]+);/g
const BG_IMAGE_RE = /(^|[;{]|\s)background-image:\s*([^;]+);/g
const BG_COLOR_RE = /(^|[;{]|\s)background-color:\s*([^;]+);/

function themeScope(selector) {
  if (/\[data-theme=["']?light["']?\]/.test(selector)) return 'light'
  // ★ train-dia: :root.light / .light 클래스 prefix 도 라이트.
  if (/:root\.light\b/.test(selector)) return 'light'
  if (/\.light\b/.test(selector)) return 'light'
  if (/:not\(\s*\[data-theme=["']?dark["']?\]\s*\)/.test(selector)) return 'light'
  if (/\[data-theme=["']?dark["']?\]/.test(selector)) return 'dark'
  return 'base' // 테마 스코프 없음 (:root 클래스 없음 등) = 다크 기본
}

/** 셀렉터에서 스타일 대상 = 마지막 .className 토큰 (CSS Module 로컬 클래스). */
function targetClass(selector) {
  const cls = selector.match(/\.([a-zA-Z_][\w-]*)/g)
  if (!cls || cls.length === 0) return null
  return cls[cls.length - 1].slice(1)
}

/** body 의 background 성격 분석. */
function analyzeBg(body) {
  let shorthandHasImage = false
  let m
  BG_SHORTHAND_RE.lastIndex = 0
  while ((m = BG_SHORTHAND_RE.exec(body)) !== null) {
    if (IMAGE_RE.test(m[2])) shorthandHasImage = true
  }
  let imageLonghand = false
  BG_IMAGE_RE.lastIndex = 0
  while ((m = BG_IMAGE_RE.exec(body)) !== null) {
    if (IMAGE_RE.test(m[2]) && !/\bnone\b/.test(m[2])) imageLonghand = true
  }
  const hasBgShorthand = /(^|[;{]|\s)background:\s*/.test(body)
  const hasBgImage = /(^|[;{]|\s)background-image:\s*/.test(body)
  const hasBgColor = BG_COLOR_RE.test(body)
  return {
    hasImage: shorthandHasImage || imageLonghand, // 이미지/그라데이션을 실제로 깖
    hasBgShorthand,
    hasBgImage,
    // background-color 만 건드리고 background/background-image 는 안 건드림
    colorOnly: hasBgColor && !hasBgShorthand && !hasBgImage,
  }
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
  const changed = getChangedLineSet(file, mode)

  // 클래스별로 base / light / dark 규칙 수집
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  const byClass = new Map() // class -> { base:[], light:[], dark:[] }
  let m
  while ((m = ruleRe.exec(src)) !== null) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@') || selector.startsWith('/*')) continue
    const cls = targetClass(selector)
    if (!cls) continue
    const scope = themeScope(selector)
    const startLine = src.slice(0, m.index).split('\n').length
    const before = src.slice(0, m.index).split('\n').slice(-3).join('\n')
    const exempt = /THEME-EXCEPTION|STYLE-EXCEPTION/.test(before)
    if (!byClass.has(cls)) byClass.set(cls, { base: [], light: [], dark: [] })
    byClass.get(cls)[scope].push({ body, startLine, exempt, bg: analyzeBg(body) })
  }

  const fails = []
  for (const [cls, g] of byClass) {
    // 베이스(다크 기본) 중 이미지/그라데이션을 깐 규칙
    const baseImage = g.base.find(r => r.bg.hasImage)
    if (!baseImage) continue
    // 반대 테마(light) 오버라이드 중 background-color 만 바꾸는 규칙 → 버그
    for (const ov of g.light) {
      if (ov.exempt) continue
      if (ov.bg.colorOnly) {
        // 변경 라인 모드: 오버라이드 또는 베이스가 변경됐을 때만
        if (mode !== 'all') {
          const ovChanged = changed && changed.has(ov.startLine)
          if (!ovChanged) continue
        }
        fails.push({
          file: rel, line: ov.startLine, className: `.${cls}`,
          msg: `라이트 오버라이드가 background-color 만 바꿔 다크 gradient/이미지(.${cls} 베이스 ${rel}:${baseImage.startLine})가 라이트에 잔존. background:(shorthand) 또는 background-image: 로 이미지째 교체하거나 --z-sheet-*/--z-card-fill 같은 테마 토큰 사용.`,
        })
      }
    }
  }
  return fails
}

function main() {
  let files
  if (MODE === 'all') {
    files = walk(SRC)
  } else {
    files = getDiffCssFiles(MODE)
    if (files.length === 0) {
      console.log(`check:theme-override — ${MODE} CSS 0건, skip`)
      process.exit(0)
    }
  }
  const all = []
  for (const f of files) {
    if (!fs.existsSync(f)) continue
    all.push(...checkFile(f, MODE))
  }
  if (all.length === 0) {
    console.log('✅ check:theme-override — CSS-THEME-OVERRIDE-001 위반 0건')
    process.exit(0)
  }
  console.error('\n❌ CSS-THEME-OVERRIDE-001 — 테마 오버라이드가 다크 이미지를 못 지움 (FAIL):')
  for (const f of all) {
    console.error(`  ${f.file}:${f.line}  ${f.className}`)
    console.error(`    → ${f.msg}`)
  }
  console.error('\n  background-color 는 background-image(gradient/url)를 못 지운다 → 다크 gradient 가 라이트에 잔존.')
  console.error('  해법: 오버라이드를 background:(shorthand)로 풀세팅하거나 테마 토큰(--z-sheet-surface 등) 사용.')
  console.error('  의도된 예외는 규칙 직전 줄에 /* THEME-EXCEPTION: 사유 */ 주석.')
  console.error('  본문: docs/rules/ui/design-system.md CSS-THEME-OVERRIDE-001')
  process.exit(1)
}

main()
