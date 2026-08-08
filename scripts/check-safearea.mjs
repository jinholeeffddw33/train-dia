#!/usr/bin/env node
/**
 * CSS-SAFEAREA-001 / CSS-VIEWPORT-UNIT-001 가드
 * (2026-08-09 ZINOSB Safe Area System v4 이식과 함께 신설)
 *
 * 왜 필요한가 —
 *   layout.tsx 가 viewportFit:'cover' + appleWebApp.statusBarStyle:'black-translucent' 라
 *   콘텐츠가 이미 상태바 뒤까지 올라가 있다. 이 상태에서 raw env(safe-area-inset-*) 를
 *   직접 쓰면, env() 가 0 을 반환하는 환경(iOS PWA standalone WebKit 버그)에서 fallback 0px
 *   이 그대로 먹혀 헤더가 노치·다이내믹 아일랜드 밑으로 들어간다.
 *   보정식(html.pwa-ios 의 max(env,20px))은 토큰 한 곳에만 있으므로, 화면이 raw env() 를
 *   쓰면 그 보정을 통째로 우회한다 = 토큰이 있으나 마나가 된다.
 *
 *   2026-08-09 이식 직전 실측: raw env() 179건 vs var(--sat) 6건 · --sab 는 정의조차 없었음.
 *   이관으로 소비처 171건을 토큰으로 돌렸고, 이 가드가 재유입을 막는다.
 *
 * 잡는 패턴 (전량 스캔 — 이관 완료로 위반 0 이라 baseline 불필요):
 *   [FAIL] CSS-SAFEAREA-001      raw env(safe-area-inset-*) 사용
 *   [FAIL] CSS-VIEWPORT-UNIT-001 짝 없는 bare 100vh (인접 줄에 100dvh 폴백이 없음)
 *
 * 안 잡는 것:
 *   - 토큰 *정의* 라인 (--sat/--sab/--sal/--sar: env(...))  ← 여기가 raw env() 의 정답 자리
 *   - 100vh 바로 앞/뒤 줄에 같은 속성의 100dvh 가 있는 폴백 짝 (점진적 향상 패턴)
 *   - 직전 2줄 내 SAFEAREA-EXCEPTION / VIEWPORT-EXCEPTION 주석
 *
 * ★ 스캔 우주 = src/ 아래 *모든* .css + .tsx + .ts.
 *   기존 가드들처럼 .module.css/globals.css 로 좁히면 tokens.css·premium-fake-glass.css·
 *   apex-globals.css 가 렌즈 밖이 되어 "위반 0건"이 거짓이 된다.
 *
 * Exit: FAIL 있으면 1, 아니면 0.
 * 본문 룰: docs/rules/ui/design-system.md CSS-SAFEAREA-001
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SRC = path.join(REPO_ROOT, 'src')

const RAW_ENV_RE = /env\(\s*safe-area-inset-(top|bottom|left|right)\b/
const TOKEN_DEF_RE = /^\s*--(sat|sab|sal|sar)\s*:/
const VH_RE = /\b100vh\b/
const DVH_RE = /\b100dvh\b/
const EXC_RE = /SAFEAREA-EXCEPTION|VIEWPORT-EXCEPTION/

const TOKEN_FOR = { top: '--sat', bottom: '--sab', left: '--sal', right: '--sar' }

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (ent.isFile() && /\.(css|tsx|ts)$/.test(ent.name)) out.push(full)
  }
  return out
}

/**
 * 주석을 공백으로 치환하되 줄 수·줄 길이는 보존한다(줄번호 유지).
 * ★ 이게 없으면 가드가 "env(safe-area-inset-*) 를 쓰지 말라"고 설명하는 *주석 산문* 자체를
 *   위반으로 잡는다(실제로 이 파일의 layout.tsx 안내 주석에서 발생). 룰을 문서화할수록
 *   위반이 늘어나는 자기모순이라 반드시 벗겨내고 스캔한다.
 */
function stripComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  out = out
    .split('\n')
    .map((line) => {
      // URL(https://) 의 // 는 주석이 아니다 — 앞이 ':' 이면 건너뛴다
      const i = line.search(/(^|[^:])\/\//)
      if (i === -1) return line
      const at = line.indexOf('//', i)
      return line.slice(0, at) + ' '.repeat(line.length - at)
    })
    .join('\n')
  return out
}

function checkFile(file) {
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  const raw = fs.readFileSync(file, 'utf8')
  const lines = stripComments(raw).split('\n')
  // 예외 주석은 *원본* 에서 찾아야 한다 (위에서 벗겨냈으므로)
  const rawLines = raw.split('\n')
  const fails = []

  const excused = (i) => EXC_RE.test(rawLines.slice(Math.max(0, i - 2), i).join('\n'))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ── CSS-SAFEAREA-001 ──
    if (RAW_ENV_RE.test(line) && !TOKEN_DEF_RE.test(line) && !excused(i)) {
      const side = line.match(RAW_ENV_RE)[1]
      fails.push({
        rule: 'CSS-SAFEAREA-001',
        file: rel,
        line: i + 1,
        msg: `raw env(safe-area-inset-${side}) — var(${TOKEN_FOR[side]}) 를 쓸 것 (플랫폼 보정 우회)`,
      })
    }

    // ── CSS-VIEWPORT-UNIT-001 ──
    if (VH_RE.test(line) && !DVH_RE.test(line) && !excused(i)) {
      const prop = (line.match(/([\w-]+)\s*:/) || [])[1] ?? ''
      const prev = lines[i - 1] ?? ''
      const next = lines[i + 1] ?? ''
      const paired =
        (DVH_RE.test(prev) && (!prop || prev.includes(prop))) ||
        (DVH_RE.test(next) && (!prop || next.includes(prop)))
      if (!paired) {
        fails.push({
          rule: 'CSS-VIEWPORT-UNIT-001',
          file: rel,
          line: i + 1,
          msg: `bare 100vh — 바로 다음 줄에 같은 속성의 100dvh 폴백을 덧붙일 것 (iOS 주소창 높이)`,
        })
      }
    }
  }
  return fails
}

function main() {
  const files = walk(SRC)
  const fails = []
  for (const f of files) fails.push(...checkFile(f))

  if (fails.length > 0) {
    const byRule = {}
    for (const f of fails) (byRule[f.rule] ??= []).push(f)
    for (const [rule, list] of Object.entries(byRule)) {
      console.log(`\n❌ [F / ${rule}] ${list.length}건 — read: docs/rules/ui/design-system.md`)
      for (const f of list) console.log(`  ${f.file}:${f.line}  ${f.msg}`)
    }
    console.log('\n  예외가 필요하면 직전 줄에 /* SAFEAREA-EXCEPTION: 사유 */ 또는 /* VIEWPORT-EXCEPTION: 사유 */.')
    console.log(`  (스캔 우주: src/ 아래 css+tsx+ts ${files.length}개 파일)`)
    process.exit(1)
  }

  console.log(`✅ check:safearea — CSS-SAFEAREA-001 / CSS-VIEWPORT-UNIT-001 위반 0건 (스캔 ${files.length}파일)`)
  process.exit(0)
}

main()
