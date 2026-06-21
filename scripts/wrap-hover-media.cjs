#!/usr/bin/env node
/*
 * wrap-hover-media — 터치 우선 앱: top-level pure-:hover 룰을 @media (hover: hover) 로 감싼다.
 *   (진호 2026-06-21 "hover 전역 제거"). 데스크톱에선 유지 / 터치에선 미발동 = sticky hover 제거.
 *
 * 안전장치:
 *   - 셀렉터 리스트의 *모든* 셀렉터가 :hover 일 때만 감쌈(혼합 .a,.b:hover / :hover,:focus 는 스킵 — focus/비호버 게이팅 방지).
 *   - at-rule(@media/@keyframes/@supports) 내부는 건드리지 않음(top-level 만).
 *   - 불변식: 파일별 :hover 개수 불변 + 브레이스 균형(추가된 wrap 쌍만큼만 증가) 확인. 깨지면 그 파일 스킵.
 *   - apps/admin 제외(PC 우선). --dry 면 미적용(카운트만).
 */
const fs = require('fs')
const path = require('path')

const TARGET = process.argv[2] || 'apps/web/app'
const DRY = process.argv.includes('--dry')

function listCss(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      listCss(p, acc)
    } else if (e.name.endsWith('.css')) acc.push(p)
  }
  return acc
}

function splitTopLevel(css) {
  const segs = []
  let i = 0
  const n = css.length
  while (i < n) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const e = end === -1 ? n : end + 2
      segs.push({ type: 'raw', raw: css.slice(i, e) })
      i = e; continue
    }
    if (/\s/.test(ch)) {
      let j = i
      while (j < n && /\s/.test(css[j])) j++
      segs.push({ type: 'raw', raw: css.slice(i, j) })
      i = j; continue
    }
    // prelude until top-level ';' or '{'
    let j = i
    let handled = false
    while (j < n) {
      const c = css[j]
      if (c === '/' && css[j + 1] === '*') { const end = css.indexOf('*/', j + 2); j = end === -1 ? n : end + 2; continue }
      if (c === '"' || c === "'") { const q = c; j++; while (j < n && css[j] !== q) { if (css[j] === '\\') j++; j++ } j++; continue }
      if (c === ';') { segs.push({ type: 'raw', raw: css.slice(i, j + 1) }); j++; handled = true; break }
      if (c === '{') {
        const prelude = css.slice(i, j)
        let depth = 1; let k = j + 1
        while (k < n && depth > 0) {
          const cc = css[k]
          if (cc === '/' && css[k + 1] === '*') { const end = css.indexOf('*/', k + 2); k = end === -1 ? n : end + 2; continue }
          if (cc === '"' || cc === "'") { const q = cc; k++; while (k < n && css[k] !== q) { if (css[k] === '\\') k++; k++ } k++; continue }
          if (cc === '{') depth++
          else if (cc === '}') depth--
          k++
        }
        const isAt = prelude.trimStart().startsWith('@')
        segs.push({ type: isAt ? 'atrule' : 'rule', prelude, raw: css.slice(i, k) })
        j = k; handled = true; break
      }
      j++
    }
    if (!handled) { segs.push({ type: 'raw', raw: css.slice(i, j) }) }
    if (j <= i) j = i + 1
    i = j
  }
  return segs
}

function count(str, re) { return (str.match(re) || []).length }

let totalFiles = 0, totalWraps = 0, skippedFiles = 0
const changedFiles = []

for (const file of listCss(TARGET, [])) {
  const up = file.replace(/\\/g, '/')
  if (up.includes('apps/admin/') || up.includes('/features/admin/')) continue // 관리자=PC 우선, hover 유지
  const css = fs.readFileSync(file, 'utf8')
  if (!/:hover\b/.test(css)) continue
  const segs = splitTopLevel(css)
  let wraps = 0
  const out = segs.map(s => {
    if (s.type === 'rule' && /:hover\b/.test(s.prelude)) {
      const sels = s.prelude.split(',')
      const allHover = sels.every(sel => /:hover\b/.test(sel))
      if (allHover) { wraps++; return `@media (hover: hover) {\n${s.raw}\n}` }
    }
    return s.raw
  }).join('')
  if (wraps === 0) continue
  // 불변식 검증
  const hoverSame = count(css, /:hover\b/g) === count(out, /:hover\b/g)
  const braceBalanced = count(out, /\{/g) === count(out, /\}/g)
    && count(out, /\{/g) === count(css, /\{/g) + wraps
  if (!hoverSame || !braceBalanced) {
    console.log(`  SKIP(불변식 위반) ${file}  hoverSame=${hoverSame} braceOk=${braceBalanced}`)
    skippedFiles++
    continue
  }
  totalFiles++; totalWraps += wraps
  changedFiles.push([file, wraps])
  if (!DRY) fs.writeFileSync(file, out)
}

console.log(`\n${DRY ? '[DRY] ' : ''}wrap :hover → @media(hover): ${totalWraps} wraps across ${totalFiles} files, skipped ${skippedFiles}`)
changedFiles.sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([f, w]) => console.log(`  ${w}\t${f.replace(/\\/g, '/')}`))
