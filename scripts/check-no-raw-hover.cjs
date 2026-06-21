#!/usr/bin/env node
/*
 * check-no-raw-hover — 신규 raw :hover 차단 가드 (CSS-HOVER-001).
 *   터치 우선 앱: top-level pure-:hover 룰은 반드시 @media (hover: hover) 안에 있어야 한다.
 *   wrap-hover-media.cjs 가 일괄 래핑한 결과를 신규 코드가 깨지 않게 강제(sticky hover 방지).
 *
 *   FAIL(exit 1): top-level 에서 *모든* 셀렉터가 :hover 인 룰.
 *   통과: 혼합(.a, .b:hover) / :hover,:focus / @media·@supports 내부(이미 래핑됨/focus 게이팅 방지).
 *
 *   사용: node scripts/check-no-raw-hover.cjs [src]
 *   해결: node scripts/wrap-hover-media.cjs src
 */
const fs = require('fs')
const path = require('path')

const TARGET = process.argv[2] || 'src'

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

// wrap-hover-media.cjs 와 동일한 top-level 분리기 (at-rule 내부는 rule 로 잡지 않음)
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

const violations = []
for (const file of listCss(TARGET, [])) {
  const css = fs.readFileSync(file, 'utf8')
  if (!/:hover\b/.test(css)) continue
  for (const s of splitTopLevel(css)) {
    if (s.type === 'rule' && /:hover\b/.test(s.prelude)) {
      const sels = s.prelude.split(',')
      if (sels.every(sel => /:hover\b/.test(sel))) {
        violations.push([file, s.prelude.trim().replace(/\s+/g, ' ').slice(0, 90)])
      }
    }
  }
}

if (violations.length) {
  console.error(`\n[F / CSS-HOVER-001] top-level :hover 는 @media (hover: hover) 로 감싸야 합니다 (터치 sticky hover 방지). ${violations.length}건:`)
  violations.forEach(([f, sel]) => console.error(`  ${f.replace(/\\/g, '/')}  →  ${sel}`))
  console.error('\n해결: node scripts/wrap-hover-media.cjs src\n')
  process.exit(1)
}
console.log('check:hover OK — top-level raw :hover 0건')
