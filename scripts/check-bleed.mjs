#!/usr/bin/env node
/**
 * UI-BLEED-001 / UI-BLEED-002 가드 (ZINOSB 적응 이식 2026-08-09)
 *
 * 배경 —
 *   train-dia 는 AppShell 이 가로 게터를 잡지 않고 탭마다 .container 가 자기 게터를 잡는다.
 *   헤더는 그 게터를 음수 마진으로 상쇄해 full-width 로 빠져나갔다가(.z-app-header frost)
 *   안쪽 패딩으로 되돌린다. "빠져나간 양"과 "되돌린 양"이 같은 토큰을 안 쓰면 조용히 어긋난다.
 *
 * ★ ZINOSB 실사고 (이 가드가 두 룰인 이유):
 *   게터 16 vs 복귀 28 이 3개월 생존했다. 같은 화면의 다른 요소와도 12px 어긋났는데,
 *   **탈출(margin)만 검사하던 가드는 "위반 0건"을 냈다**. margin 이 정답이면 복귀가
 *   28px 이어도 통과였기 때문이다. 그래서 복귀(padding)까지 보는 002 가 따로 필요하다.
 *
 * 잡는 것:
 *   [FAIL] UI-BLEED-001 — 가로 음수 마진 상쇄에 --dia-page-pad 가 아닌 값 사용
 *          (raw px / --dia-space-* 직접 / 숫자). 게터 값이 바뀌면 같이 안 움직인다.
 *   [FAIL] UI-BLEED-002 — 블리드한 규칙의 *가로 복귀 패딩*이 var(--dia-page-pad) 도 0 도 아님.
 *          calc(게터 + 무언가) 도 금지 — 더 들여쓰려면 자식 요소에 줘라.
 *
 * 안 잡는 것:
 *   - 세로 음수 마진 (margin-top/bottom) — 게터와 무관
 *   - globals.css 의 .diaBleed* 유틸 정의부 (거기가 정답 자리)
 *   - 직전 2줄 내 BLEED-EXCEPTION 주석
 *
 * Exit: FAIL 있으면 1, 아니면 0.
 * 본문 룰: docs/rules/ui/design-system.md UI-BLEED-001 / UI-BLEED-002
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')

const EXC = /BLEED-EXCEPTION/
const GUTTER = 'var(--dia-page-pad)'

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

/** padding shorthand 에서 가로(좌우) 칸을 뽑는다. 1값=전체 / 2값=[세로,가로] / 3값=[상,가로,하] / 4값=[상,우,하,좌] */
function horizontalOf(padValue) {
  const parts = []
  let depth = 0, cur = ''
  for (const ch of padValue.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) { if (cur) { parts.push(cur); cur = '' } }
    else cur += ch
  }
  if (cur) parts.push(cur)
  if (parts.length === 1) return [parts[0]]
  if (parts.length === 2) return [parts[1]]
  if (parts.length === 3) return [parts[1]]
  return [parts[1], parts[3]]
}

const files = walk(SRC)
const fails = []

for (const f of files) {
  const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/')
  const isGlobals = rel.endsWith('src/app/globals.css')
  const raw = fs.readFileSync(f, 'utf8')
  const src = stripComments(raw)
  const rawLines = raw.split('\n')

  for (const m of src.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@')) continue
    // 유틸 정의부는 정답 자리
    if (isGlobals && /\.dia(Bleed|BleedInset|ScrollRow)\b/.test(selector)) continue

    // ★ m.index 는 앞 규칙의 '}' 직후(= 개행 앞)를 가리켜 항상 이전 줄이 나온다.
    //   셀렉터의 첫 비공백 위치로 보정해야 실제 줄이 나온다.
    const lineNo = src.slice(0, m.index + (m[1].length - m[1].trimStart().length)).split('\n').length
    if (EXC.test(rawLines.slice(Math.max(0, lineNo - 3), lineNo + 1).join('\n'))) continue

    // ── 게터 블리드 판정 ──
    // ★ "음수 가로 마진"이라고 다 블리드가 아니다. -1px(srOnly), -8px(아이콘 정렬 넛지),
    //   -150px(left:50% 센터링 트릭)은 게터와 무관한 광학 보정이다. 초안에서 이것들을
    //   전부 잡아 거짓 FAIL 8건이 났다. 블리드는 **게터 크기만큼 좌우 대칭으로** 빠지는 것.
    // 판정: (margin-inline | margin 단축의 가로칸 | left+right 둘 다 음수)  AND
    //       크기가 간격 토큰이거나 raw px 가 게터(16px) 이상
    const GUTTER_PX = 16
    const isGutterSized = (h) =>
      /var\(--dia-(page-pad|space-[4-9]|space-1[0-9])\)/.test(h) ||
      (() => { const m = h.match(/-(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) >= GUTTER_PX : false })()
    const isNeg = (h) => /-1\s*\*/.test(h) || /^\s*-\s*var\(/.test(h) || /^\s*-\d/.test(h)

    const decls = body.match(/margin(?:-inline|-left|-right)?\s*:\s*[^;]*/g) ?? []
    const candidates = []
    let negLeft = null, negRight = null
    for (const decl of decls) {
      const prop = decl.split(':')[0].trim()
      const val = decl.split(':').slice(1).join(':').trim()
      if (prop === 'margin-inline') { if (isNeg(val)) candidates.push({ prop, h: val }) }
      else if (prop === 'margin-left') { if (isNeg(val)) negLeft = val }
      else if (prop === 'margin-right') { if (isNeg(val)) negRight = val }
      else if (prop === 'margin') {
        for (const h of horizontalOf(val)) if (isNeg(h)) candidates.push({ prop, h })
      }
    }
    // 한쪽만 음수 = 정렬 넛지/센터링. 좌우 둘 다여야 게터 탈출로 본다.
    if (negLeft && negRight) candidates.push({ prop: 'margin-left/right', h: negLeft })

    let bleedFound = false
    for (const { prop, h } of candidates) {
      if (!isGutterSized(h)) continue      // 게터 크기 미만 = 광학 보정, 대상 아님
      bleedFound = true
      if (!h.includes('--dia-page-pad')) {
        fails.push({ rule: 'UI-BLEED-001', file: rel, line: lineNo, msg: `블리드 상쇄에 게터 토큰 미사용: ${prop}: ${h} → calc(-1 * var(--dia-page-pad))` })
      }
    }

    if (!bleedFound) continue

    // 복귀 패딩 검사 (UI-BLEED-002)
    const padDecl = body.match(/padding(?:-inline|-left|-right)?\s*:\s*([^;]+)/g) ?? []
    for (const decl of padDecl) {
      const prop = decl.split(':')[0].trim()
      const val = decl.split(':').slice(1).join(':').trim()
      const isHorizProp = /padding-inline|padding-left|padding-right/.test(prop)
      const horiz = isHorizProp ? [val] : horizontalOf(val)
      for (const h of horiz) {
        const ok = h === GUTTER || h === '0' || h === '0px'
        if (!ok) {
          fails.push({ rule: 'UI-BLEED-002', file: rel, line: lineNo, msg: `블리드 복귀 가로 패딩이 게터와 다름: ${prop} 의 가로칸 "${h}" → var(--dia-page-pad) 또는 0 (더 들여쓰려면 자식에 주기)` })
        }
      }
    }
  }
}

if (fails.length > 0) {
  const byRule = {}
  for (const f of fails) (byRule[f.rule] ??= []).push(f)
  for (const [rule, list] of Object.entries(byRule)) {
    console.log(`\n❌ [F / ${rule}] ${list.length}건 — read: docs/rules/ui/design-system.md`)
    for (const f of list) console.log(`  ${f.file}:${f.line}  ${f.msg}`)
  }
  console.log('\n  유틸을 쓰면 손으로 안 적어도 된다: .diaBleed / .diaBleedInset / .diaScrollRow')
  console.log('  예외는 직전 줄 /* BLEED-EXCEPTION: 사유 */.')
  console.log(`  (스캔 우주: src/ 아래 css ${files.length}개 파일)`)
  process.exit(1)
}

console.log(`✅ check:bleed — UI-BLEED-001 / UI-BLEED-002 위반 0건 (스캔 ${files.length}파일)`)
process.exit(0)
