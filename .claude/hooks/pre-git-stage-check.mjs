#!/usr/bin/env node
/**
 * PreToolUse hook — git stage scope 보호 (GIT-SCOPE-001)
 *
 * 진호는 여러 대화창을 동시에 돌린다. 같은 working tree 에 다른 세션의
 * 진행 중 변경이 untracked/modified 로 섞여 있을 수 있다.
 *
 * `git add -A` / `git add .` / `git commit -a` 류는 그걸 전부 쓸어담아서
 * 다른 대화창 작업이 의도치 않게 내 커밋에 묻혀버린다 (실제 사고 2026-05-20).
 *
 * 이 훅은 그런 광역 stage 명령을 PreToolUse 단계에서 차단한다.
 * AI 가 룰을 까먹어도 system 이 강제로 막는다.
 *
 * ★ train-dia 이식본 (ZINOSB 시스템 그대로 복사 — 2026-06-23). 동작은 프로젝트 무관 generic.
 *
 * 차단 대상:
 *   git add -A
 *   git add --all
 *   git add .
 *   git add :/                  (repo root 전체)
 *   git commit -a
 *   git commit --all
 *
 * 통과 (정상 사용):
 *   git add <path1> <path2>     명시적 경로
 *   git add -p                  interactive patch
 *   git status / log / diff     read-only
 *   git stash / push / pull     stage 와 무관
 *
 * 우회: 진호가 명시적으로 승인한 경우만. 예외 처리는 이 훅을 끄지 말고
 *      예외 통과 토큰을 명령 끝에 붙이는 식으로 → "# GIT-SCOPE-OVERRIDE"
 */

import { readFileSync } from 'node:fs'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const toolName = input.tool_name || ''
if (toolName !== 'Bash' && toolName !== 'PowerShell') process.exit(0)

const cmd = (input.tool_input?.command || '').trim()
if (!cmd) process.exit(0)

// 명시적 우회 토큰
if (/#\s*GIT-SCOPE-OVERRIDE\b/.test(cmd)) process.exit(0)

// 명령 한 줄씩 검사 (세미콜론/&&/|| 로 chain 된 경우 모두)
const segments = cmd
  .split(/(?:&&|\|\||;|\n)/)
  .map(s => s.trim())
  .filter(Boolean)

const violations = []

for (const seg of segments) {
  // git add -A / --all
  if (/^git\s+(?:\S+\s+)*add\s+(?:[^#]*\s)?(?:-A\b|--all\b)/.test(seg)) {
    violations.push({ seg, why: 'git add -A / --all (다른 세션 잔재까지 쓸어담음)' })
    continue
  }
  // git add .
  if (/^git\s+(?:\S+\s+)*add\s+(?:[^#]*\s)?\.(?:\s|$)/.test(seg)) {
    violations.push({ seg, why: 'git add . (현재 디렉토리 전체 — 다른 세션 변경 포함 위험)' })
    continue
  }
  // git add :/  (repo root pathspec)
  if (/^git\s+(?:\S+\s+)*add\s+(?:[^#]*\s)?:\/(?:\s|$)/.test(seg)) {
    violations.push({ seg, why: 'git add :/ (repo root 전체)' })
    continue
  }
  // git commit -a / --all / -am 같은 합쳐진 short option 포함
  // -a 단독, --all, 또는 -a 가 첫 글자인 short option 클러스터 (-am, -avs, -a... 등)
  if (/^git\s+(?:\S+\s+)*commit\b/.test(seg) && !/\s--amend\b/.test(seg)) {
    if (/\s--all\b/.test(seg) || /\s-[a-zA-Z]*a[a-zA-Z]*\b/.test(seg)) {
      // -a 가 short option 클러스터 안에 있는지 (단, --all 은 위에서 이미 처리, --amend 는 제외됨)
      violations.push({ seg, why: 'git commit -a / -am / --all (working tree 전체 자동 stage)' })
      continue
    }
  }
}

if (violations.length === 0) process.exit(0)

const lines = [
  '[GIT-SCOPE-001] git stage 광역 명령 차단',
  '',
  '진호는 여러 대화창을 동시에 돌린다. 광역 stage 명령은 다른 세션의 미커밋 작업까지',
  '쓸어담아 의도치 않게 내 커밋에 묻힌다 (실제 사고 2026-05-20).',
  '',
  '차단된 명령:',
  ...violations.map(v => `  ✗ ${v.seg}\n    → ${v.why}`),
  '',
  '해결:',
  '  1. `git status` 로 내가 만든 변경과 다른 세션 잔재를 분리',
  '  2. 내가 Edit/Write 한 파일만 명시적으로: `git add <path1> <path2> ...`',
  '  3. push 도 마찬가지 — 내 커밋만 push',
  '',
  '룰: docs/rules/engineering.md §GIT-SCOPE-001',
  '우회: 진호가 명시적으로 승인한 경우, 명령 끝에 " # GIT-SCOPE-OVERRIDE" 추가',
]

// stderr 에 출력하고 exit 2 → PreToolUse block
console.error(lines.join('\n'))
process.exit(2)
