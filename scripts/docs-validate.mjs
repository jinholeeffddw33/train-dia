#!/usr/bin/env node
// ============================================================================
// Docs Validate (train-dia 경량 적응본) — registry 무결성 + 문서 링크 검증
//
// ZINOSB scripts/docs-validate.mjs(v3) 이식. train-dia 는 .claude/rules 라우팅·
// ledger·ADR·decision-queue.md 가 없고 docs/ 가 평평하므로 해당 검사(D8/D9/W2)는 제외.
// 대신 train-dia registry 는 domains.*.mustRead 를 쓰므로 D3 을 신설했다.
//
// FAIL:
//   D1  registry ruleIds.canonical / autoCheck 스크립트 경로 실재
//   D2  archive/legacy/backup 문서가 active routing(canonical/CLAUDE.md 링크)에 진입했는가
//   D3  registry domains.*.mustRead 경로 실재 (RULE PREFLIGHT 가 읽는 문서)
//   D4  registry.json 필수 키/구조 (registry.schema.json)
//   D5  필수 문서 존재
//   D6  각 canonical 문서 안에 해당 Rule ID 텍스트 실재 (sanity)
//   D7  활성 문서(CLAUDE.md, docs/**)의 상대 링크가 실재 파일을 가리키는가
//
// WARN:
//   W1  registry.lastUpdated 90일 이상 묵음
//   W7  md 링크의 #anchor 가 대상 문서 헤딩에 없음 (slugify 근사 — 오탐 가능해 warn)
//
// 사용: node scripts/docs-validate.mjs      (외부 패키지 0개)
// ============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

const ROOT = resolve(import.meta.dirname ?? '.', '..')

const issues = { fail: [], warn: [] }
const fail = (where, rule, msg) => issues.fail.push({ where, rule, msg })
const warn = (where, rule, msg) => issues.warn.push({ where, rule, msg })

// train-dia 의 비활성 영역 — 여기 문서는 active routing 대상이 아니다
const ARCHIVE_PATTERNS = [/^docs\/archive\//, /\/archive\//, /\.deprecated\./, /^legacy\//, /^backup\//, /^AUDIT\//]
const isArchived = (p) => ARCHIVE_PATTERNS.some((r) => r.test(p.replace(/\\/g, '/')))
const checkPathExists = (refPath, where, ruleId) => {
  if (!existsSync(join(ROOT, refPath))) {
    fail(where, ruleId, `referenced path does not exist: ${refPath}`)
    return false
  }
  return true
}

// ── Load registry ──
const registryPath = join(ROOT, 'docs/rules/registry.json')
if (!existsSync(registryPath)) {
  fail('docs/rules/registry.json', 'D4', 'registry.json missing — cannot proceed')
  reportAndExit()
}

let registry
try {
  registry = JSON.parse(readFileSync(registryPath, 'utf8'))
} catch (e) {
  fail('docs/rules/registry.json', 'D4', `parse error: ${e.message}`)
  reportAndExit()
}

// ── Load schema ──
const schemaPath = join(ROOT, 'docs/rules/registry.schema.json')
if (!existsSync(schemaPath)) {
  fail('docs/rules/registry.schema.json', 'D4', 'registry.schema.json missing — schema validation skipped')
} else {
  let schema
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  } catch (e) {
    fail('docs/rules/registry.schema.json', 'D4', `schema parse error: ${e.message}`)
    schema = null
  }
  if (schema) validateNode(registry, schema, '$')
}

// ── D4 fallback: 핵심 키 sanity ──
if (!registry.version) fail('registry', 'D4', 'missing version')
if (!registry.lastUpdated) fail('registry', 'D4', 'missing lastUpdated')
if (!registry.ruleIds || typeof registry.ruleIds !== 'object') fail('registry', 'D4', 'missing or invalid ruleIds')
if (!registry.verificationCommands) fail('registry', 'D4', 'missing verificationCommands')
if (registry.lastUpdated && !/^\d{4}-\d{2}-\d{2}$/.test(registry.lastUpdated)) {
  fail('registry.lastUpdated', 'D4', `bad format (expect YYYY-MM-DD): ${registry.lastUpdated}`)
}

// ── D1 / D2 / D6: ruleIds ──
const validSeverity = new Set(['fail', 'warn', 'info'])
for (const [ruleId, def] of Object.entries(registry.ruleIds ?? {})) {
  if (!def.canonical) {
    fail(`registry.ruleIds.${ruleId}`, 'D4', 'missing canonical')
    continue
  }
  const exists = checkPathExists(def.canonical, `registry.ruleIds.${ruleId}.canonical`, 'D1')
  if (def.severity && !validSeverity.has(def.severity)) {
    fail(`registry.ruleIds.${ruleId}`, 'D4', `invalid severity "${def.severity}" (expect fail/warn/info)`)
  }
  if (!def.scope || !Array.isArray(def.scope) || def.scope.length === 0) {
    fail(`registry.ruleIds.${ruleId}`, 'D4', 'missing or empty scope array')
  }
  if (isArchived(def.canonical)) {
    fail(`registry.ruleIds.${ruleId}.canonical`, 'D2', `canonical points to archive: ${def.canonical}`)
  }
  if (exists) {
    const body = readFileSync(join(ROOT, def.canonical), 'utf8')
    if (!body.includes(ruleId)) {
      fail(def.canonical, 'D6', `Rule ID ${ruleId} not found in canonical doc body`)
    }
  }
  // autoCheck 가 스크립트/훅 경로를 지목하면 실재 검사 (프로즈 설명은 통과)
  if (typeof def.autoCheck === 'string') {
    const m = def.autoCheck.match(/((?:\.claude\/hooks|scripts)\/[\w./-]+\.(?:mjs|cjs|js|sh))/)
    if (m) checkPathExists(m[1], `registry.ruleIds.${ruleId}.autoCheck`, 'D1')
  }
}

// ── D3: domains.*.mustRead 실재 (RULE PREFLIGHT 가 실제로 여는 문서) ──
for (const [domain, def] of Object.entries(registry.domains ?? {})) {
  for (const p of def.mustRead ?? []) {
    const ok = checkPathExists(p, `registry.domains.${domain}.mustRead`, 'D3')
    if (ok && isArchived(p)) {
      fail(`registry.domains.${domain}.mustRead`, 'D2', `archived doc routed as active: ${p}`)
    }
  }
}

// ── D5: 필수 문서 ──
const required = [
  'CLAUDE.md',
  'docs/rules/registry.json',
  'docs/rules/registry.schema.json',
  'docs/rules/ui/design-system.md',
  'docs/ZINOSB_SYSTEM_PORT.md',
]
for (const p of required) {
  if (!existsSync(join(ROOT, p))) fail('required-docs', 'D5', `essential doc missing: ${p}`)
}

// ── D7: 활성 문서 상대 링크 무결성 ──
const activeDocs = []
collectMd(join(ROOT, 'docs'), activeDocs, (rel) => !isArchived(rel))
if (existsSync(join(ROOT, 'CLAUDE.md'))) activeDocs.push('CLAUDE.md')

const headingCache = new Map()
for (const rel of activeDocs) {
  const body = readFileSync(join(ROOT, rel), 'utf8')
  const dir = dirname(rel)
  const linkRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let m
  while ((m = linkRe.exec(body)) !== null) {
    const raw = m[2].trim()
    if (/^(https?:|mailto:|tel:|#|<)/.test(raw)) {
      if (raw.startsWith('#')) checkAnchor(rel, rel, raw.slice(1))
      continue
    }
    const [pathPart, anchor] = raw.split('#')
    if (!pathPart) continue
    const target = resolve(join(ROOT, dir), decodeURI(pathPart))
    if (!target.startsWith(ROOT)) continue // repo 밖(메모리 등)은 검사 대상 아님
    const targetRel = target.slice(ROOT.length + 1).replace(/\\/g, '/')
    if (!existsSync(target)) {
      fail(`${rel} ([${m[1]}])`, 'D7', `broken link: ${raw}`)
      continue
    }
    if (rel === 'CLAUDE.md' && isArchived(targetRel)) {
      fail(`${rel} ([${m[1]}])`, 'D2', `archived doc routed as active: ${raw}`)
    }
    if (anchor && targetRel.endsWith('.md')) checkAnchor(rel, targetRel, anchor)
  }
}

// ── W1 ──
if (registry.lastUpdated && /^\d{4}-\d{2}-\d{2}$/.test(registry.lastUpdated)) {
  const ageDays = Math.floor((Date.now() - new Date(registry.lastUpdated).getTime()) / 86400000)
  if (ageDays > 90) warn('registry.lastUpdated', 'W1', `registry is ${ageDays} days old — review`)
}

reportAndExit()

// ── helpers ──

function collectMd(dir, out, filterRel) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = full.slice(ROOT.length + 1).replace(/\\/g, '/')
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue
      collectMd(full, out, filterRel)
    } else if (entry.endsWith('.md') && filterRel(rel)) {
      out.push(rel)
    }
  }
}

function slugify(heading) {
  // GitHub 스타일 근사 — 한글 유지, 공백→하이픈, 구두점 제거
  return heading
    .toLowerCase()
    .trim()
    .replace(/[*_`~[\]()!.,:;'"?§·—††✅❌⚠️🚨🔍🧠]/g, '')
    .replace(/\s+/g, '-')
}

function checkAnchor(fromRel, targetRel, anchor) {
  if (!headingCache.has(targetRel)) {
    const body = readFileSync(join(ROOT, targetRel), 'utf8')
    const heads = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((h) => slugify(h[1]))
    headingCache.set(targetRel, new Set(heads))
  }
  const heads = headingCache.get(targetRel)
  const want = decodeURI(anchor).toLowerCase()
  // slug 정확 일치 or 근사(하이픈 무시) — 오탐 방지 위해 warn 만
  const wantLoose = want.replace(/-/g, '')
  const hit = heads.has(want) || [...heads].some((h) => h.replace(/-/g, '') === wantLoose || h.startsWith(want))
  if (!hit) warn(`${fromRel} → ${targetRel}`, 'W7', `anchor not found: #${anchor}`)
}

function validateNode(data, schema, path) {
  if (!schema || typeof schema !== 'object') return
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((t) => matchType(data, t))) {
      fail(path, 'D4', `schema type mismatch (expected ${types.join('|')})`)
      return
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(data)) {
    fail(path, 'D4', `value not in enum: ${JSON.stringify(data)} ∉ ${schema.enum.join('|')}`)
  }
  if (schema.pattern && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) {
    fail(path, 'D4', `pattern mismatch: ${JSON.stringify(data)} !~ /${schema.pattern}/`)
  }
  if (typeof schema.minLength === 'number' && typeof data === 'string' && data.length < schema.minLength) {
    fail(path, 'D4', `minLength ${schema.minLength} not satisfied`)
  }
  if (typeof schema.minItems === 'number' && Array.isArray(data) && data.length < schema.minItems) {
    fail(path, 'D4', `minItems ${schema.minItems} not satisfied`)
  }
  if (matchType(data, 'object') && data !== null) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) fail(path, 'D4', `missing required: ${key}`)
      }
    }
    if (typeof schema.minProperties === 'number' && Object.keys(data).length < schema.minProperties) {
      fail(path, 'D4', `minProperties ${schema.minProperties} not satisfied`)
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in data) validateNode(data[k], sub, `${path}.${k}`)
    }
    if (schema.patternProperties) {
      const patterns = Object.keys(schema.patternProperties).map((p) => ({ re: new RegExp(p), sub: schema.patternProperties[p] }))
      for (const k of Object.keys(data)) {
        if (k in (schema.properties ?? {})) continue
        const hits = patterns.filter((p) => p.re.test(k))
        if (hits.length === 0) {
          if (schema.additionalProperties === false) fail(`${path}.${k}`, 'D4', `unexpected key (no matching pattern)`)
          continue
        }
        for (const h of hits) validateNode(data[k], h.sub, `${path}.${k}`)
      }
    }
    if (schema.additionalProperties === false && !schema.patternProperties) {
      const allowed = new Set(Object.keys(schema.properties ?? {}))
      for (const k of Object.keys(data)) {
        if (!allowed.has(k)) fail(`${path}.${k}`, 'D4', `unexpected key`)
      }
    }
  }
  if (matchType(data, 'array') && schema.items) {
    data.forEach((item, i) => validateNode(item, schema.items, `${path}[${i}]`))
  }
}

function matchType(value, type) {
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number'
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'array') return Array.isArray(value)
  if (type === 'null') return value === null
  return false
}

function reportAndExit() {
  const { fail: f, warn: w } = issues
  console.log(`[docs-validate] check complete  fail=${f.length}  warn=${w.length}`)
  if (f.length > 0) {
    console.log('\n❌ FAIL:')
    for (const i of f) console.log(`  ${i.where}  [${i.rule}]  ${i.msg}`)
  }
  if (w.length > 0) {
    console.log('\n⚠️  WARN:')
    for (const i of w) console.log(`  ${i.where}  [${i.rule}]  ${i.msg}`)
  }
  if (f.length > 0) {
    console.log('\n📖 docs/rules/registry.json 참고')
    process.exit(1)
  }
  console.log('✅ docs validate passed.')
  process.exit(0)
}
