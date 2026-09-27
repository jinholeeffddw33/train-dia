#!/usr/bin/env node
// bump-version.mjs — pre-commit 에서 앱 버전(APP_VERSION) 끝자리를 자동으로 올린다.
//
// 왜: 버전을 손으로 올리지 않으면 표시 버전이 몇 달째 그대로다(v4.0.2).
//     배포마다 저절로 올라가야 폰 화면·설정의 버전으로 "최신인지"를 사람이 알 수 있다.
//
// 동작
//   · 이번 커밋에 src/ 또는 public/ 변경이 없으면 아무것도 안 한다(문서·스크립트 커밋)
//   · 올릴 번호 = max(스테이지된 버전, origin/main 버전) + 0.0.1
//   · 스테이지(index)의 constants.ts 에서 버전 줄만 바꿔 넣는다 —
//     작업 폴더에 커밋하지 않을 다른 수정이 있어도 함께 커밋되지 않게.
//     작업 폴더 파일도 같은 줄만 바꿔 둘을 맞춘다.
//   · 끄기: SKIP_VERSION_BUMP=1 git commit ...
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readVersion, nextVersion, formatVersion, writeVersion, touchesApp } from './lib/app-version.mjs';

const FILE = 'src/lib/constants.ts';
const git = (args, input) => execFileSync('git', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });

if (process.env.SKIP_VERSION_BUMP === '1') process.exit(0);

const root = git(['rev-parse', '--show-toplevel']).trim();
process.chdir(root);

const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').map((s) => s.trim()).filter(Boolean);
if (!touchesApp(staged)) process.exit(0);

let indexSrc;
try { indexSrc = git(['show', `:${FILE}`]); } catch { process.exit(0); }
const current = readVersion(indexSrc);
if (!current) { console.log(`[version] ${FILE} 에서 APP_VERSION 을 못 찾아 건너뜀`); process.exit(0); }

let remote = null;
try { remote = readVersion(git(['show', `origin/main:${FILE}`])); } catch { /* 원격 없음 — 로컬 기준 */ }

const next = nextVersion(current, remote);
const blob = git(['hash-object', '-w', '--stdin'], writeVersion(indexSrc, next)).trim();
const mode = git(['ls-files', '-s', FILE]).split(' ')[0] || '100644';
git(['update-index', '--cacheinfo', `${mode},${blob},${FILE}`]);

const wt = join(root, FILE);
if (existsSync(wt)) writeFileSync(wt, writeVersion(readFileSync(wt, 'utf8'), next));

console.log(`[version] ${formatVersion(current)} → ${formatVersion(next)}`);
