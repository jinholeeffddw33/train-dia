#!/usr/bin/env node
/**
 * ★ train-dia 이식본 (ZINOSB 시스템 적응 복사 2026-06-23)
 * UI-SURFACE-3D-001 가드 — 칩/버튼/세그먼트 표면 안티패턴 거부.
 *
 * 진호 directive (2026-06-20): "테두리에만 색칠한 칩/버튼 절대 금지. 평면 단색
 * 꽉찬 칩 금지 — 채울 거면 3D 표면으로." 전역 디자인 통일의 강제 가드.
 *
 * 잡는 안티패턴 (칩/버튼/세그먼트 셀렉터 한정):
 *   AP1 (테두리만 색칠) : border 가 var(--z-accent/색) 인데 box-shadow 도 gradient 도
 *                          없어 안이 비어 보이는 hollow outline.
 *   AP2 (평면 단색 꽉참): background 가 단일 솔리드 컬러(var(--z-accent) / #hex)인데
 *                          box-shadow·gradient·backdrop-filter 가 전혀 없는 평면 칩.
 *   해법: tokens.css Dimensional Surface System(--z-card-fill/--z-pill-shadow/--z-seg-*)
 *         또는 globals.css .z-glass-surface/.z-glass-pill/.z-segment 사용.
 *
 * 핵심 설계 — 레거시 마비 방지:
 *   - 변경 라인만 검사(--staged/--changed). 기존 277+52건 레거시는 건드리기 전까지 통과.
 *   - 클래스 body 전체를 봐서(box-shadow/gradient 유무) 진짜 평면만 잡음 → 좋은 3D 칩은 통과.
 *   - 칩/버튼/세그먼트 셀렉터만(읽기전용 badge·점·바·프로그레스 제외) → false-positive 억제.
 *   - 직전 줄 SURFACE-EXCEPTION / STYLE-EXCEPTION 주석이면 면제.
 *   - :hover/:focus/.active 같은 의사상태 룰은 classRe 가 애초에 안 잡음(상태 강조 정당).
 *
 * Usage:
 *   node scripts/check-surface-3d.mjs            # 전체 스캔 (리포트)
 *   node scripts/check-surface-3d.mjs --staged   # pre-commit (변경 라인만)
 *   node scripts/check-surface-3d.mjs --changed  # working tree 변경분
 *
 * Exit: 0 = OK, 1 = FAIL
 * 본문 룰: docs/rules/ui/design-system.md UI-SURFACE-3D-001
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

// 검사 대상 = 인터랙티브 칩/버튼/세그먼트 셀렉터만.
// (2026-06-20 진호 제보로 seg/scope/period/view/feed/genre/categor 추가 — 로컬 세그먼트 사각지대 메움)
const INCLUDE_RE = /(chip|pill|segment|\bseg|scope|period|view|feed|sort|genre|categor|toggle|tab|filter|btn|button|cta|option|choice)/i
// 의도된 평면(점·바·프로그레스·구분선·트랙·손잡이)·라벨(badge)·비표면 컨테이너(table)는 제외.
const EXCLUDE_RE = /(progress|divider|underline|scrollbar|tabbar|tablist|navtab|toolbar|statusbar|snackbar|hairline|skeleton|spinner|indicator|tabsrow|tablerow|table|badge|knob|thumb|^dot|dot$|slidedot|track$|^bar$|barfill)/i

// 솔리드 컬러 배경 (평면 단색) — step9급 솔리드 토큰 또는 hex. -muted/-subtle/-10/-glow/-hover 등 변형은 제외.
const SOLID_BG_RE = /\bbackground(-color)?:\s*(var\(\s*--z-(accent|lime-?(9|10)?|sky-?9?|violet-?9?|indigo-?9?|rose-?9?|mint-?9?|cyan-?9?|success|danger|warning|info|gold|primary|safe|hotdeal|amber-?9?|blue-?9?|red-?9?)\s*\)|#[0-9a-fA-F]{3,8})\s*(!important)?\s*;/
// 컬러 테두리 (테두리만 색칠 후보)
const BORDER_COLOR_RE = /\bborder(-top|-bottom|-left|-right|-block|-inline)?(-color)?:\s*[^;]*var\(\s*--z-(accent|lime|sky|violet|indigo|rose|mint|cyan|success|danger|warning|info|gold|primary)\b/

const HAS_BOX_SHADOW_RE = /\bbox-shadow:\s*(?!none\s*;)/
const HAS_GRADIENT_RE = /(linear|radial|conic)-gradient/
const HAS_BACKDROP_RE = /\bbackdrop-filter:\s*(?!none\s*;)/

// 읽기전용 라벨/배지 컴포넌트 — 인터랙티브 칩 아님 → 파일 단위 면제.
const FILE_ALLOWLIST = [
  'components/ui/response-badge.module.css',
  'components/ui/creator-badge-inline.module.css',
  'components/ui/featured-badge-coin.module.css',
  'components/ui/condition-indicator.module.css',
]

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
    const out = execSync(`git diff ${cached} --name-only --diff-filter=ACMR`, {
      cwd: REPO_ROOT, encoding: 'utf8',
    })
    return out.split('\n')
      .filter(f => f.endsWith('.module.css') && f.startsWith('src/'))
      .map(f => path.join(REPO_ROOT, f))
  } catch {
    return []
  }
}

/** 파일의 변경(추가) 라인 번호 Set. all 모드면 null(전부 검사). */
function getChangedLineSet(file, mode) {
  if (mode === 'all') return null
  const cached = mode === 'staged' ? '--cached' : ''
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  try {
    const diff = execSync(`git diff ${cached} --unified=0 -- "${rel}"`, {
      cwd: REPO_ROOT, encoding: 'utf8',
    })
    const set = new Set()
    let cur = 0
    for (const line of diff.split('\n')) {
      const hunk = line.match(/^@@\s-\d+(?:,\d+)?\s\+(\d+)(?:,\d+)?\s@@/)
      if (hunk) { cur = parseInt(hunk[1], 10) - 1; continue }
      if (line.startsWith('+') && !line.startsWith('+++')) { cur++; set.add(cur) }
      else if (!line.startsWith('-') && !line.startsWith('---')) { cur++ }
    }
    return set
  } catch {
    return null
  }
}

function rangeIntersects(set, start, end) {
  if (set === null) return true
  for (let i = start; i <= end; i++) if (set.has(i)) return true
  return false
}

function checkFile(file, mode) {
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  if (FILE_ALLOWLIST.some(a => rel.endsWith(a))) return []
  const src = fs.readFileSync(file, 'utf8')
  const changed = getChangedLineSet(file, mode)
  const fails = []

  const classRe = /\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{([^}]*)\}/g
  let m
  while ((m = classRe.exec(src)) !== null) {
    const name = m[1]
    const body = m[2]
    if (!INCLUDE_RE.test(name) || EXCLUDE_RE.test(name)) continue

    const startLine = src.slice(0, m.index).split('\n').length
    const endLine = startLine + m[0].split('\n').length - 1
    if (!rangeIntersects(changed, startLine, endLine)) continue

    // 직전 ~2줄 SURFACE-EXCEPTION / STYLE-EXCEPTION 면제
    const before = src.slice(0, m.index).split('\n').slice(-3).join('\n')
    if (/SURFACE-EXCEPTION|STYLE-EXCEPTION/.test(before)) continue

    const hasShadow = HAS_BOX_SHADOW_RE.test(body)
    const hasGrad = HAS_GRADIENT_RE.test(body)
    const hasBackdrop = HAS_BACKDROP_RE.test(body)

    // AP2 — 평면 단색 꽉참
    if (SOLID_BG_RE.test(body) && !hasShadow && !hasGrad && !hasBackdrop) {
      fails.push({
        file: rel, line: startLine, className: `.${name}`, kind: 'AP2',
        msg: '평면 단색 칩/버튼 금지 — box-shadow + gradient/backdrop(3D 표면) 또는 --z-card-fill/--z-seg-on-fill 사용',
      })
      continue
    }
    // AP1 — 테두리만 색칠 (box-shadow·gradient 없는 hollow outline)
    if (BORDER_COLOR_RE.test(body) && !/border[^;]*transparent/.test(body) && !hasShadow && !hasGrad) {
      fails.push({
        file: rel, line: startLine, className: `.${name}`, kind: 'AP1',
        msg: '테두리만 색칠한 칩/버튼 금지 — 선택/강조는 표면 위계(raised/inset, box-shadow)로. --z-seg-* / .z-segment 사용',
      })
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
      console.log(`check:surface-3d — ${MODE} CSS 0건, skip`)
      process.exit(0)
    }
  }

  const all = []
  for (const f of files) {
    if (!fs.existsSync(f)) continue
    all.push(...checkFile(f, MODE))
  }

  if (all.length === 0) {
    console.log('✅ check:surface-3d — UI-SURFACE-3D-001 위반 0건')
    process.exit(0)
  }

  console.error('\n❌ UI-SURFACE-3D-001 — 칩/버튼 표면 안티패턴 (FAIL):')
  for (const f of all) {
    console.error(`  ${f.file}:${f.line}  ${f.className}  [${f.kind}]`)
    console.error(`    → ${f.msg}`)
  }
  console.error('\n  평면 단색칩 / 테두리만 색칠한 버튼은 전역 금지 (진호 directive 2026-06-20).')
  console.error('  채울 땐 3D 표면: tokens.css --z-card-fill/--z-pill-shadow/--z-seg-* 또는')
  console.error('  globals.css .z-glass-surface / .z-glass-pill / .z-segment.')
  console.error('  의도된 예외는 클래스 직전 줄에 /* SURFACE-EXCEPTION: 사유 */ 주석.')
  console.error('  본문: docs/rules/ui/design-system.md UI-SURFACE-3D-001')
  process.exit(1)
}

main()
