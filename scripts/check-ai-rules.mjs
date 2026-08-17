#!/usr/bin/env node
/**
 * AI Rule Guard (train-dia 적응판) — 2026-08-18
 *
 * ZINOSB `scripts/ai-rule-guard.mjs` 를 train-dia 로 적응 이식한 것.
 * **기존 가드가 이미 잡는 건 안 잡는다** — 중복 경보는 결국 전부 무시하게 만든다:
 *   폰트/터치타겟 → check-text-size · raw :hover → check-no-raw-hover
 *   z-index → check-zlayer · safe-area → check-safearea · 표면/테마/리듬 → 각 가드
 * 여기서는 **CLAUDE.md 의 P0 중 어떤 가드도 안 보던 것**만 본다.
 *
 * FAIL (P0 — CLAUDE.md §1):
 *   F1 / CSS-INLINE-001  §1.7  inline style={{ }} (STYLE-EXCEPTION 주석 없이)
 *   F2 / TS-ANY-001            `as any`
 *   F3 / UI-A11Y-001     §1.6  <button> type 속성 누락
 *   F4 / UI-ALERT-001    §1.5  alert() / confirm() — 토스트·인라인 UI 로
 *   F5 / UI-A11Y-002     §1.6  outline:none 인데 **어떤 포커스 표시도 없음**
 *                              (border-color / box-shadow / background 로 표시하면 정당 — 오히려 권장)
 *   F6 / UI-SCROLLLOCK-001     document.body 스크롤을 직접 잠금
 *                              → lib/overlay/scrollLockManager 경유 (중첩 시 화면 영구 잠김 사고)
 *
 * WARN:
 *   W1 / UI-PRESS-001    §2.6  :active 의 비표준 scale (표준 3티어: 0.98 카드 / 0.95 버튼 / 0.9 아이콘)
 *   W2 / UI-PRESS-002    §2.6  :active 에 transform 이 있는데 transition 이 안 보임 (snap 금지)
 *   W3 / CONSOLE-001     §5    console.log 잔류
 *   W4 / CSS-TOKEN-001   §1.4  tsx 하드코딩 색상
 *
 * 모드: --staged / --changed 는 **변경 라인만**(레거시 보호), --all 은 전수 리포트.
 *   node scripts/check-ai-rules.mjs --all
 *
 * Exit: FAIL 있으면 1. 본문 룰: docs/rules/ui/design-system.md · CLAUDE.md §1~§2
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

/** press 표준 3티어 (CLAUDE.md §2.6) — 카드 / 버튼 / 아이콘 */
const STANDARD_PRESS_SCALES = [0.98, 0.95, 0.9]

/** 프로덕션에 안 나가는 곳 — 규칙을 강제할 이유가 없다 */
function isExcluded(rel) {
  return rel.includes('components/dev/')
    || rel.includes('__tests__/')
    || /\.test\.(ts|tsx)$/.test(rel)
    || rel.includes('scripts/')
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts|css)$/.test(full)) out.push(full)
  }
  return out
}

function getDiffFiles(mode) {
  const cached = mode === 'staged' ? '--cached' : ''
  try {
    const out = execSync(`git diff ${cached} --name-only --diff-filter=ACMR`, {
      cwd: REPO_ROOT, encoding: 'utf8',
    })
    return out.split('\n')
      .filter((f) => /\.(tsx|ts|css)$/.test(f) && f.startsWith('src/'))
      .map((f) => path.join(REPO_ROOT, f))
  } catch { return [] }
}

/** 이번 변경에서 새로 추가된 라인 번호 집합. all 모드면 null(=전부 대상) */
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
  } catch { return null }
}

const fails = []
const warns = []

function report(list, rel, lineNo, code, msg) {
  list.push({ rel, lineNo, code, msg })
}

/** 직전 2줄에 예외 주석이 있으면 통과 */
function hasException(lines, i, ...tokens) {
  const ctx = [lines[i - 2] ?? '', lines[i - 1] ?? '', lines[i] ?? ''].join(' ')
  return tokens.some((t) => ctx.includes(t))
}

function analyzeTs(rel, src, changed) {
  const lines = src.split('\n')
  const isNew = (n) => changed === null || changed.has(n)

  lines.forEach((line, i) => {
    const lineNo = i + 1
    if (!isNew(lineNo)) return

    const isComment = /^\s*(\/\/|\*|\/\*)/.test(line)

    // F1 — inline style
    if (/\bstyle=\{\{/.test(line) && !hasException(lines, i, 'STYLE-EXCEPTION')) {
      report(fails, rel, lineNo, 'F1',
        'inline style={{ }} — CSS Module 로 옮길 것. 동적 런타임 값이면 직전 줄에 // STYLE-EXCEPTION: 사유 (CLAUDE.md §1.7)')
    }

    // F2 — as any
    if (/\bas\s+any\b/.test(line) && !isComment) {
      report(fails, rel, lineNo, 'F2',
        '`as any` 금지 — unknown + 타입가드 또는 Zod parse (TS-ANY-001)')
    }

    // F3 — <button> type 누락. 여는 태그가 여러 줄에 걸치므로 5줄 창으로 본다.
    if (/<button(\s|>)/.test(line) && !isComment) {
      const window = lines.slice(i, i + 5).join(' ')
      if (!/type\s*=/.test(window)) {
        report(fails, rel, lineNo, 'F3',
          '<button> 에 type 명시 필요 — 폼 안에서 type 없는 버튼은 submit 으로 동작해 의도치 않게 폼이 제출된다 (CLAUDE.md §1.6)')
      }
    }

    // F4 — alert() / confirm()
    if (/(?:^|[^.\w])(alert|confirm)\s*\(/.test(line) && !isComment
        && !hasException(lines, i, 'ALERT-EXCEPTION')) {
      report(fails, rel, lineNo, 'F4',
        'alert()/confirm() 금지 — showToast 또는 인라인 UI/모달로 (CLAUDE.md §1.5)')
    }

    // F6 — body 스크롤 직접 잠금
    //   모달 20곳이 각자 잠그다가 중첩에서 무너지던 것을 SSOT 로 모았다(2026-08-18).
    //   직접 만지면 전역 카운터가 그 오버레이를 몰라 같은 사고가 재발한다.
    if (/document\.body\.style\.(overflow|position)\s*=/.test(line) && !isComment
        && !rel.includes('lib/overlay/scrollLockManager')
        && !rel.includes('lib/originGuard')) { // 킬 스위치 = 되돌리지 않는 영구 차단이라 성격이 다르다
      report(fails, rel, lineNo, 'F6',
        'body 스크롤을 직접 잠그지 말 것 — acquireScrollLock/releaseScrollLock (@/lib/overlay/scrollLockManager) 또는 useModalA11y 경유. ' +
        '직접 만지면 중첩 오버레이에서 배경이 새거나, 다 닫힌 뒤에도 화면이 잠긴 채로 남는다 (UI-SCROLLLOCK-001)')
    }

    // W3 — console.log
    if (/console\.log\s*\(/.test(line) && !isComment) {
      report(warns, rel, lineNo, 'W3', 'console.log 잔류 — 커밋 전 제거 (CLAUDE.md §5)')
    }

    // W4 — tsx 하드코딩 색상 (문자열 리터럴·주석 제외)
    if (/(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/.test(line) && !isComment
        && !/['"`]#[0-9a-fA-F]+['"`]/.test(line)
        && !hasException(lines, i, 'STYLE-EXCEPTION', 'COLOR-EXCEPTION')) {
      report(warns, rel, lineNo, 'W4', '하드코딩 색상 — var(--dia-*) 토큰 사용 (CLAUDE.md §1.4)')
    }
  })
}

/**
 * CSS 는 라인이 아니라 **규칙 단위**로 본다.
 * `:active { transform: scale(...) }` 같은 판정은 셀렉터와 본문을 같이 봐야 하기 때문이다.
 */
function analyzeCss(rel, src, changed) {
  const lines = src.split('\n')
  const isNew = (n) => changed === null || changed.has(n)

  // 같은 파일 어딘가에 focus-visible 대체가 있는지 (F5 판정용)
  const fileHasFocusVisible = /:focus-visible/.test(src)

  /**
   * outline 을 끄면서 **다른 방식으로 포커스를 보여 주는지** 판정한다.
   * 텍스트 입력은 사각 outline 대신 border-color / box-shadow 로 표시하는 게 오히려 권장이라
   * (ZINOSB UI-INPUT-FOCUS-001), 그것까지 위반으로 잡으면 가드가 거짓말을 하게 된다.
   * 실제로 첫 구현에서 train-dia 의 정상 입력 11곳을 전부 오탐했다.
   */
  const showsFocusOtherwise = (body) =>
    /border-color|box-shadow|background|outline-offset|border:/.test(body)

  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = ruleRe.exec(src)) !== null) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@') || selector.startsWith('/*')) continue

    const lineNo = src.slice(0, m.index).split('\n').length
    const bodyEndLine = src.slice(0, m.index + m[0].length).split('\n').length
    // 규칙 중 한 줄이라도 이번 변경에 포함되면 검사 대상
    let touched = changed === null
    if (!touched) {
      for (let n = lineNo; n <= bodyEndLine; n++) if (changed.has(n)) { touched = true; break }
    }
    if (!touched) continue

    const idx = lines.findIndex((_, k) => k === lineNo - 1)
    const excAt = Math.max(0, idx)

    // F5 — outline:none 인데 어떤 포커스 표시도 없음
    if (/outline:\s*none/.test(body)
        && !fileHasFocusVisible
        && !showsFocusOtherwise(body)
        && !hasException(lines, excAt, 'A11Y-EXCEPTION', 'STYLE-EXCEPTION')) {
      report(fails, rel, lineNo, 'F5',
        `outline:none 인데 포커스 표시가 전혀 없다 (${selector.replace(/\s+/g, ' ').slice(0, 50)}) — ` +
        '키보드/스위치 사용자가 지금 어디에 있는지 알 수 없다. ' +
        ':focus-visible 링 또는 border-color/box-shadow 로 표시할 것 (CLAUDE.md §1.6)')
    }

    if (/:active/.test(selector)) {
      const scaleMatch = body.match(/scale\(\s*(0?\.\d+)\s*\)/)
      if (scaleMatch) {
        const v = parseFloat(scaleMatch[1])
        if (!STANDARD_PRESS_SCALES.includes(v)
            && !hasException(lines, excAt, 'PRESS-EXCEPTION', 'STYLE-EXCEPTION')) {
          report(warns, rel, lineNo, 'W1',
            `:active scale(${v}) — 표준 3티어만: 0.98(카드) / 0.95(버튼·칩·탭) / 0.9(소형 아이콘) (CLAUDE.md §2.6)`)
        }
      }

      // W2 — transform 이 있는데 transition 이 어디에도 안 보이면 snap 이 된다.
      //   transition 은 보통 :active 가 아니라 기본 규칙에 선언하므로 **파일 전체**에서 찾는다.
      if (/transform:/.test(body) && !/transition/.test(src)) {
        report(warns, rel, lineNo, 'W2',
          `:active 에 transform 이 있는데 이 파일에 transition 선언이 없다 — press 가 툭 끊긴다 (CLAUDE.md §2.6)`)
      }
    }
  }
}

function main() {
  let files
  if (MODE === 'all') {
    files = walk(SRC)
  } else {
    files = getDiffFiles(MODE)
    if (files.length === 0) {
      console.log(`check:ai-rules — ${MODE} 대상 0건, skip`)
      process.exit(0)
    }
  }

  for (const file of files) {
    if (!fs.existsSync(file)) continue
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    if (isExcluded(rel)) continue

    const src = fs.readFileSync(file, 'utf8')
    const changed = getChangedLineSet(file, MODE)
    if (file.endsWith('.css')) analyzeCss(rel, src, changed)
    else analyzeTs(rel, src, changed)
  }

  const byCode = (list) => {
    const g = {}
    for (const it of list) (g[it.code] ??= []).push(it)
    return g
  }

  if (warns.length > 0) {
    console.log(`\n⚠️  WARN ${warns.length}건`)
    for (const [code, items] of Object.entries(byCode(warns))) {
      console.log(`  [${code}] ${items.length}건`)
      for (const it of items.slice(0, 12)) console.log(`    ${it.rel}:${it.lineNo}  ${it.msg}`)
      if (items.length > 12) console.log(`    … 외 ${items.length - 12}건`)
    }
  }

  if (fails.length > 0) {
    console.log(`\n❌ P0 위반 ${fails.length}건 — read: CLAUDE.md §1 · docs/rules/ui/design-system.md`)
    for (const [code, items] of Object.entries(byCode(fails))) {
      console.log(`  [${code}] ${items.length}건`)
      for (const it of items.slice(0, 20)) console.log(`    ${it.rel}:${it.lineNo}  ${it.msg}`)
      if (items.length > 20) console.log(`    … 외 ${items.length - 20}건`)
    }
    process.exit(1)
  }

  console.log(`✅ check:ai-rules — P0 위반 0건${warns.length ? ` (WARN ${warns.length})` : ''}`)
  process.exit(0)
}

main()
