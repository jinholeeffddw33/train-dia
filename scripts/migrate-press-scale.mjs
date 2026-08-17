#!/usr/bin/env node
/**
 * 1회성 마이그레이션 — :active press scale 을 표준 3티어로 통일 (2026-08-18).
 *
 * CLAUDE.md §2.6 이 정한 3티어:
 *   0.98 카드/대형 서피스 · 0.95 버튼/칩/탭 · 0.9 소형 아이콘
 * 실측에서 0.99 / 0.97 / 0.96 / 0.94 / 0.92 같은 값이 67건 흩어져 있었다.
 * 한 화면 안에서 누를 때마다 눌리는 깊이가 다르면 "정성 들여 만든 앱" 느낌이 깨진다.
 *
 * 분류 방법:
 *   1) 셀렉터에 카드/시트/타일 계열 이름이 있으면 → 0.98
 *   2) 아이콘/작은 버튼 계열이면 → 0.9
 *   3) 나머지(버튼·칩·탭 등) → 0.95
 *   4) 셀렉터로 판단이 안 서면 **가장 가까운 표준값으로 반올림** — 시각 변화가 가장 작다
 *
 * 사용: node scripts/migrate-press-scale.mjs [--dry]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')
const DRY = process.argv.includes('--dry')

const STANDARD = [0.98, 0.95, 0.9]

/** 카드/대형 서피스 — 넓은 면이라 살짝만 눌려야 자연스럽다 */
const CARD_RE = /card|tile|sheet|panel|surface|item|row|banner|thumb|cell|box|entry/i
/** 소형 아이콘 — 작아서 많이 눌려야 눌린 게 보인다 */
const ICON_RE = /icon|iconbtn|close|chevron|arrow|dot|badge|fab|circle/i

function classify(selector) {
  if (ICON_RE.test(selector)) return 0.9
  if (CARD_RE.test(selector)) return 0.98
  return null // 셀렉터로는 판단 보류 → 반올림에 맡긴다
}

function nearestStandard(v) {
  return STANDARD.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), STANDARD[0])
}

/**
 * 게임은 제외한다 — apex/스네이크 등은 앱 UI 가 아니라 **자체 촉감 설계**를 가진 별개 세계다.
 * 앱 표준을 강제하면 게임 조작감이 의도 없이 바뀐다.
 */
function isGameCss(rel) {
  return rel.includes('features/life/games/')
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (full.endsWith('.css')) out.push(full)
  }
  return out
}

const changes = []

for (const file of walk(SRC)) {
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  if (isGameCss(rel)) continue
  const src = fs.readFileSync(file, 'utf8')
  let out = src
  let fileChanged = false

  // 규칙 단위로 순회 — :active 셀렉터 안의 scale() 만 건드린다.
  // (@keyframes 안의 scale 은 애니메이션이라 절대 건드리면 안 된다)
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  const edits = []
  while ((m = ruleRe.exec(src)) !== null) {
    const selector = m[1].trim()
    const body = m[2]
    if (!selector || selector.startsWith('@')) continue
    if (!/:active/.test(selector)) continue

    const scaleRe = /scale\(\s*(0?\.\d+)\s*\)/g
    let s
    while ((s = scaleRe.exec(body)) !== null) {
      const v = parseFloat(s[1])
      if (STANDARD.includes(v)) continue
      const target = classify(selector) ?? nearestStandard(v)
      if (target === v) continue

      const absStart = m.index + m[0].indexOf(body) + s.index
      edits.push({
        absStart,
        length: s[0].length,
        replacement: `scale(${target})`,
        line: src.slice(0, absStart).split('\n').length,
        selector: selector.replace(/\s+/g, ' ').slice(0, 48),
        from: v,
        to: target,
      })
    }
  }

  // 뒤에서부터 치환해야 앞쪽 인덱스가 안 밀린다
  for (const e of edits.sort((a, b) => b.absStart - a.absStart)) {
    out = out.slice(0, e.absStart) + e.replacement + out.slice(e.absStart + e.length)
    fileChanged = true
    changes.push({ rel, ...e })
  }

  if (fileChanged && !DRY) fs.writeFileSync(file, out, 'utf8')
}

const byTarget = changes.reduce((acc, c) => { acc[c.to] = (acc[c.to] ?? 0) + 1; return acc }, {})
console.log(`\n${DRY ? '[DRY RUN] ' : ''}press scale 통일 ${changes.length}건`)
console.log('  목표값 분포:', Object.entries(byTarget).map(([k, v]) => `${k}→${v}건`).join(' · '))
for (const c of changes.slice(0, 40)) {
  console.log(`  ${c.rel}:${c.line}  ${c.from} → ${c.to}   ${c.selector}`)
}
if (changes.length > 40) console.log(`  … 외 ${changes.length - 40}건`)
