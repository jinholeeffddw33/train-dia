# train-dia ← ZINOSB 룰/문서/훅/가드 시스템 이식 명령서

> **목적**: zinosb-marketplace 에서 2026-06 구축한 "룰 registry + 자동 가드 + pre-commit 훅 + 디자인 시스템 문서" 인프라를 **train-dia 에 그대로 이식**한다. train-dia 의 *ad-hoc 룰 접근(CLAUDE.md 산문만)* 은 이 registry 기반 시스템으로 **supersede**(대체) 한다.
> **★ 무조건 복사 아님 — 적응 이식**: train-dia 는 토큰이 `--dia-*`(일부 `--z-*` 별칭 이식됨), 소스가 `src/`(monorepo 아님), 테마가 `:root.light` 클래스 + `html[data-theme]` 둘 다, **페이지 게터/BottomSheetShell 없음**. zinosb 는 `apps/web/app/`, `--z-*`, `[data-theme]`, `#main-content` 게터. → 경로/토큰/테마 스코프를 train-dia 에 맞게 바꿔야 한다.
> **두 repo 같은 PC**: 원본 = `C:\Users\smrt2\zinosb-marketplace`, 대상 = `C:\Users\smrt2\train-dia`.

작성: 2026-06-23 (ZINOSB 세션이 train-dia 용으로 발주). 진행 상태는 맨 아래 §진행 로그 갱신.

---

## 0) 복붙용 세션 명령 (다른 세션에 그대로 주면 됨)

```
train-dia 프로젝트(C:\Users\smrt2\train-dia)에 ZINOSB 의 룰/가드/훅/문서 시스템을 이식한다.
명세는 docs/ZINOSB_SYSTEM_PORT.md 에 전부 있다. 그걸 먼저 Read 하고 §진행 로그에서
다음 미완 항목을 골라 실행해라. 원본 시스템은 C:\Users\smrt2\zinosb-marketplace 에 있다.

핵심 원칙:
- 무조건 복사 금지 — train-dia 는 --dia-*/일부 --z-* 토큰, src/ 경로, :root.light + data-theme
  테마, 페이지게터/BottomSheetShell 없음. §3 차이표대로 경로·토큰·테마 스코프를 적응시켜라.
- 가드는 전부 "변경 라인만(--staged/--changed)" 모드라 레거시는 안 건드린다. 새 코드만 강제.
- train-dia 앱 코드/CSS 는 건드리지 말 것. 이식은 *인프라 파일 추가/문서*만 (가드가 깨도 앱 안 깨짐).
- git: 광역 stage 금지(이미 이식된 .claude/hooks/pre-git-stage-check.mjs 가 막음). 내가 만든 파일만 add.
- 각 항목 끝나면 §진행 로그에 [x] + 커밋 해시 기록. 검증(§7) 통과 후 커밋.
- 모르면 추측 말고 원본 파일을 Read 해서 패턴을 그대로 따와라.
```

---

## 1) 한눈 상태표

| 영역 | zinosb 원본 | train-dia 상태 | 이식 액션 |
|---|---|---|---|
| git-scope 훅 | `.claude/hooks/pre-git-stage-check.mjs` | ✅ **이식 완료(2026-06-23)** | 완료 |
| 이식 명령서(이 문서) | — | ✅ **작성 완료** | 완료 |
| 룰 registry | `docs/rules/registry.json`(+schema) | ❌ 없음 | **신규 적응 작성** |
| pre-commit 훅 | `.githooks/pre-commit` | ❌ 없음 | **신규(train-dia 스크립트로)** |
| 훅 설치/검사 | `scripts/{install-hooks,ensure-hooks}.mjs` | ❌ 없음 | **복사(거의 generic)** |
| package.json check:* | 다수 | `check:hover` 1개만 | **check:* + install:hooks + quality-gates 추가** |
| 디자인시스템 문서 | `docs/rules/ui/design-system.md` | ❌ (CLAUDE.md 산문만) | **적응 작성(해당 룰만)** |
| CLAUDE.md | registry bootstrap | UI/UX 산문 345줄 | **bootstrap 섹션 추가 + registry 링크** |
| hover 가드 | ai-rule-guard F8 | ✅ `scripts/check-no-raw-hover.cjs` 존재 | **유지**(동등) — registry 에 등록만 |
| surface-3d 가드 | `scripts/check-surface-3d.mjs` | ❌ | **이식(경로 src/, 토큰 --z-* 이미 있음)** |
| theme-override 가드 | `scripts/check-theme-override.mjs` | ❌ | **이식+적응(:root.light 스코프 추가)** |
| card-rhythm 가드 | `scripts/check-card-rhythm.mjs` | ❌ | **이식(경로 src/, 토큰 확인)** |
| bleed 가드 | `scripts/check-bleed.mjs` | ❌ | **보류** — train-dia 에 페이지게터(--z-page-pad/#main-content) 없음. 게터 도입 시 이식 |
| sheet-handle 가드 | `scripts/check-sheet-handle.mjs` | ❌ | **보류** — train-dia 에 BottomSheetShell 없음. 시트 SSOT 도입 시 이식 |
| double-padding 가드 | `scripts/check-double-padding.mjs` | ❌ | **보류/적응** — train-dia 레이아웃(AppShell)이 #main-content 게터와 다름. 구조 확인 후 |
| ai-rule-guard(다중 P0) | `scripts/ai-rule-guard.mjs` | ❌ | **이식+적응(F1 inline/F2 as any/F4 typo/F8 hover…, 경로 src/)** — 가장 큼, 마지막 |
| ADR | `docs/architecture/adr/` | ❌ | (선택) 큰 결정 생기면 |

---

## 2) train-dia 토큰/구조 사실 (이식 시 기준)

- **간격**: `--dia-space-0..16` (4px 그리드, zinosb `--z-space-*` 와 값 동일). `--z-space-3: var(--dia-space-3)` 같은 별칭 일부 존재.
- **버튼 4법 + 글래스**: `--z-seg-*` / `--z-card-fill` / `--z-3d-*` / `--z-accent`(네온 라임) / `--zg-*` **이미 이식됨**(tokens.css + premium-fake-glass.css, 153곳). → surface-3d 가드는 토큰이 이미 있어 거의 그대로 작동.
- **테마**: 라이트 = `:root.light` **클래스**(stores/theme.ts 토글) + `html[data-theme='light']` **둘 다** 매칭(premium-fake-glass 가 그렇게 작성됨). 다크 = 기본 + `html[data-theme='dark']`.
- **페이지 게터 없음**: zinosb 의 `#main-content { padding-inline: var(--z-page-pad) }` + `.z-bleed` 풀블리드 SSOT 가 train-dia 엔 없음 → **bleed 가드/UI-BLEED-001 보류**.
- **시트 SSOT 없음**: BottomSheetShell 없음 → **sheet-handle 가드/UI-SHEET-003 보류**.
- **소스 루트**: `src/` (app/, features/, components/, styles/, stores/, hooks/, lib/). CSS Modules.
- **package.json scripts(현재)**: dev/build/start/test/test:watch/typecheck/lint/check:hover.
- **타깃 사용자**: 50~60대 기관사 → 폰트 하한이 zinosb(13px)보다 **클 수 있음**(train-dia CLAUDE.md 확인: 14px 최소, 13px 메타 예외). typo 룰은 train-dia 값으로.

---

## 3) zinosb ↔ train-dia 적응 치환표 (가드/문서 이식 시 일괄 적용)

| zinosb | → train-dia |
|---|---|
| 경로 `apps/web/app/**` | `src/**` |
| `REPO_ROOT = path.resolve(__dirname,'../../..')` (monorepo) | `path.resolve(__dirname,'..')` (단일앱, scripts/ 가 루트 바로 아래) |
| `f.startsWith('apps/web/app/')` 필터 | `f.startsWith('src/')` |
| `WEB_APP = .../apps/web/app` | `SRC = .../src` |
| 테마 스코프 `[data-theme="light"]` 만 | `:root.light` **또는** `[data-theme="light"]` 둘 다 |
| `--z-page-pad` | (없음 — bleed 보류) |
| `--z-space-4` | `--dia-space-4`(또는 `--z-space-*` 별칭) |
| `--z-card-gap`/`--z-section-gap` | train-dia 에 없으면 `--dia-space-3`/`--dia-space-6` 또는 새 별칭 정의 |
| `check:* = node scripts/check-x.mjs` (cwd apps/web) | `node scripts/check-x.mjs` (cwd train-dia 루트) |
| `node ../../scripts/ensure-hooks.mjs` | `node scripts/ensure-hooks.mjs` |

---

## 4) 가드별 이식 상세

> 모든 가드는 zinosb 원본을 Read → §3 치환 적용 → train-dia `scripts/` 에 저장 → package.json 에 `check:x`/`:staged`/`:changed` 등록 → pre-commit + quality-gates 배선. **전부 "변경 라인만" 모드(레거시 보호)**.

1. **check-surface-3d** (`scripts/check-surface-3d.mjs`): 가장 쉬움. train-dia 에 `--z-card-fill/--z-seg-*` 이미 존재. 경로만 `src/` 로. UI-SURFACE-3D-001 룰. 평면 단색칩/테두리만 버튼 차단.
2. **check-theme-override** (`scripts/check-theme-override.mjs`): `themeScope()` 함수에 **`:root.light` 클래스** 매칭 추가(현재 `[data-theme=light]`만). train-dia 가 다크 베이스 + `:root.light` 오버라이드라 그대로 들어맞음. CSS-THEME-OVERRIDE-001.
3. **check-card-rhythm** (`scripts/check-card-rhythm.mjs`): 경로 `src/`. gap 권장 토큰을 train-dia `--dia-space-3`(카드)/`--dia-space-6`(섹션) 또는 `--z-card-gap` 별칭 정의 후로. UI-RHYTHM-001(WARN).
4. **check-no-raw-hover** (이미 있음, `scripts/check-no-raw-hover.cjs`): **유지**. registry 에 CSS-HOVER-001 로 등록만. pre-commit 에 `check:hover` 추가.
5. **ai-rule-guard** (`scripts/ai-rule-guard.mjs`): 마지막. F1 inline style/F2 as any/F4 typo(≥train-dia 하한)/F8 hover 등 다중 P0. 경로 `src/`, 토큰명 치환, train-dia 폰트 하한 반영. **가장 크므로 신중**.
6. **bleed / sheet-handle / double-padding**: §1 사유로 **보류**. train-dia 가 페이지게터·BottomSheetShell·#main-content 패턴을 도입하면 그때 이식.

---

## 5) registry.json (신규 적응 작성)

- 원본 `docs/rules/registry.json`(v2.8.0) 구조를 따르되 train-dia 용으로:
  - `domains`: train-dia 도메인(ui / mobile-integrity / design-system / quality / feature 별 — home/calendar/duty/line5/edu/life/safety 등) + `filePatterns` 를 `src/**` 로.
  - `ruleIds`: train-dia 에 실제 가드/문서가 있는 룰만 등록 — UI-SURFACE-3D-001 / CSS-THEME-OVERRIDE-001 / UI-RHYTHM-001 / CSS-HOVER-001 / UI-TYPO-* / TS-ANY-001 / CSS-INLINE-001 / GIT-SCOPE-001 / QG-HOOK-001 / MOTION-RESPECT-001 등. **bleed/sheet 룰은 보류라 미등록**.
  - `canonical` 경로 = `docs/rules/ui/design-system.md` 등 train-dia 실제 파일.
- `registry.schema.json` 은 원본 복사(generic JSON schema).
- 검증: train-dia 에도 `docs-validate.mjs`(zinosb `scripts/docs-validate.mjs`) 를 이식해야 `check:docs` 가 registry 무결성 검사. 또는 최소한 JSON parse + 링크 존재만 확인하는 경량 버전.

## 6) CLAUDE.md / pre-commit / package.json / 폐기

- **CLAUDE.md**: 현재 UI/UX 산문은 **유지하되**, 최상단에 "registry bootstrap" 섹션 추가 — "작업 전 docs/rules/registry.json Read → 도메인 매칭 → mustRead → Rule Read Receipt" + pre-commit 의무(QG-HOOK-001). zinosb CLAUDE.md §MANDATORY RULE PREFLIGHT 를 train-dia 에 맞게 축약 이식. **AGENTS.md 는 CLAUDE.md 와 중복 → CLAUDE.md 로 단일화하고 AGENTS.md 는 심볼릭/포인터만**.
- **.githooks/pre-commit**: zinosb 원본을 train-dia 스크립트로: `check:hover`(있음) + 이식한 `check:surface-3d:staged`/`check:theme-override:staged`/`check:card-rhythm:staged`(warn) + `typecheck`(선택). `core.hooksPath=.githooks` 필수.
- **scripts/ensure-hooks.mjs + install-hooks.mjs**: zinosb 원본 복사(generic). `check:hooks` = `node scripts/ensure-hooks.mjs`.
- **package.json**: `check:surface-3d(+:staged/:changed)`, `check:theme-override(...)`, `check:card-rhythm(...)`, `check:hooks`, `install:hooks`, `check:quality-gates`(= hooks && hover && surface-3d:changed && theme-override:changed && card-rhythm:changed && typecheck) 추가.
- **폐기(supersede) 대상 — 신중**: train-dia 의 *도메인 지식 문서*(DOMAIN_RULES.md/PARTNER_MATCHING.md/PROCESS_RULES.md/ARCHITECTURE.md/DESIGN_AUDIT.md)는 **삭제 금지**(귀중한 train 도메인 지식). "폐기"는 **ad-hoc 룰 강제 방식**(가드 없이 산문에만 의존)을 registry+가드 시스템으로 대체한다는 의미. 산문 룰 중 가드로 승격된 건 design-system.md 로 옮기고 원본엔 포인터만 남긴다. **어떤 파일이든 지우기 전 진호 확인**.

## 7) 검증 절차 (각 항목 커밋 전)

```
cd C:\Users\smrt2\train-dia
node scripts/check-<that-guard>.mjs            # 전체 스캔 — 오발동 0/합리적 분포 확인
node scripts/check-<that-guard>.mjs --changed  # 작업 트리 — 새로 깬 거 0 확인
npm run typecheck                              # tsc 0
npm run check:hooks                            # core.hooksPath=.githooks 활성
git add <만든 파일들만>                          # 광역 stage 금지(훅이 막음)
git commit -m "..."                            # pre-commit 통과해야 함
```
- ★ PowerShell 커밋 함정(zinosb 경험): here-string 본문이 가끔 git 에 pathspec 으로 오인 + git-scope 훅이 `| Select-Object -Last` 의 `-Last` 를 commit 세그먼트 안 `-a` 클러스터로 오탐(단일 `|` 미분리). → **`git commit -F .git/임시.txt` (파이프 없이)** 가 안전.

## 8) 진행 로그 (실행 세션이 갱신)

- [x] 2026-06-23 — `.claude/hooks/pre-git-stage-check.mjs` 이식(generic 복사). (ZINOSB 세션)
- [x] 2026-06-23 — 이 명령서 작성. (ZINOSB 세션)
- [x] 2026-06-23 — registry.json(v1.0.0 적응) + registry.schema.json(복사). (커밋 7e4b058)
- [x] 2026-06-23 — scripts/ensure-hooks.mjs + install-hooks.mjs(복사) + core.hooksPath=.githooks 설치.
- [x] 2026-06-23 — .githooks/pre-commit(적응: hover+surface-3d:staged+theme-override:staged+card-rhythm:staged). ★실제 commit 시 작동 확인.
- [x] 2026-06-23 — package.json check:* + install:hooks + check:quality-gates(:full) 배선.
- [x] 2026-06-23 — check-surface-3d.mjs(이식, 경로 src/). 레거시 5건 검출(변경 라인만이라 무해).
- [x] 2026-06-23 — check-theme-override.mjs(이식 + :root.light 클래스 스코프 적응). 위반 0.
- [x] 2026-06-23 — check-card-rhythm.mjs(이식, --dia-space-3/6 권장). WARN 8건.
- [x] 2026-06-23 — docs/rules/ui/design-system.md(4개 가드 룰 적응 작성).
- [x] 2026-06-23 — CLAUDE.md bootstrap(RULE PREFLIGHT + 참조표) 섹션 추가.
- [ ] AGENTS.md 단일화(CLAUDE.md 중복 제거 — 미처리, 후속)
- [ ] (보류) bleed / sheet-handle / double-padding — train-dia 게터·시트 SSOT 도입 후
- [ ] ai-rule-guard.mjs (최대 난제 — F1 inline/F2 as any/F4 typo/F8 hover 등, 후속)
- [x] 2026-08-09 — ★ `.claude/settings.json` 에 pre-git-stage-check 를 PreToolUse(Bash/PowerShell) 훅으로 등록. 커밋 698c157. 검증: `git add -A`/`git add .`/`git commit -am` → exit 2 차단, 명시 경로·`git status`·`# GIT-SCOPE-OVERRIDE` → exit 0 통과.
- [x] 2026-08-09 — `scripts/docs-validate.mjs`(경량 적응) + `check:docs` 배선 + quality-gates 편입. D8(.claude/rules)·D9(ledger)·W2(decision-queue.md)는 train-dia 에 해당 구조가 없어 제외, 대신 **D3(domains.*.mustRead 실재)** 신설. 첫 실행에서 실제 불일치 4건 검출 → 수정: registry.schema.json 의 `verificationCommands.required` 를 zinosb 기준(`rules`/`conflicts`)에서 train-dia 기준(`preCommit`/`docs`)으로 적응(미이식 가드는 optional 로 강등), `domains.domain-data.verification` 빈 배열 → `["typecheck"]`, GIT-SCOPE-001 autoCheck 문구를 "등록 필요"→"등록 완료"로 갱신. registry 1.0.0→1.1.0.

---

## 9) 상단 헤더 통일 (ZINOSB AppPageHeader scroll-hide 엔진 이식, 2026-06-23)

> 진호 발주: "zinosb 처럼 상단 헤더 통일도 그대로 — 노치, 바텀(TabBar) 스크롤 숨김 동일하게."
> train-dia 는 **탭 기반**(home/calendar/duty/exchange/line/more), 헤더가 탭마다 제각각(공유 컴포넌트 없음), **window 스크롤**, 토큰 `--dia-*`, 테마 `:root.light`, backdrop 전역 무력화(frost=반투명 fill).

### 완료 (안전·tsc0, 커밋 예정)
- `--sat` + `--dia-header-h:56px` 토큰(tokens.css). 노치 SSOT.
- `useHeaderScroll` 훅 이식(src/hooks, window 스크롤, `target` 옵션 추가).
- AppShell: `useHeaderScroll` 마운트 → shell 에 `data-chrome-hidden`/`data-chrome-frosted` 전파.
- **TabBar 바텀 스크롤-숨김 완료**: `hidden` prop → `.tabBarHidden{translate3d(0,100%,0)}` (아래로 스크롤 시 바 하강). transform-only(컴포지터). ★ZINOSB "바텀 숨김" 동일.
- 공유 `.z-app-header`(sticky+hide) + `.z-app-header-frost`(노치 패딩 + frosted 배경 레이어) globals.css. AppShell data-attr 로 발동.

### 미완 (★train-dia dev 시각 검증 필요 — 블라인드 금지)
- **6개 탭 헤더에 `.z-app-header` 적용**: home(.headerSection, 자체 gradient bg+노치 → bare 가능) / line(.header) / calendar(.nav) / more·exchange(.pageTitle h2) / duty(헤더 없음).
- ★함정: 타이틀 헤더들은 **padded `.container` 안 transparent** → sticky 만 걸면 스크롤 시 콘텐츠가 헤더 뒤로 비침. **frost 배경 full-width(컨테이너 좌우 패딩 음수 margin 상쇄) + 컨테이너 safe-area-top 제거(이중 패딩 방지)** 가 탭마다 필요. 각 탭 구조가 달라 **dev 에서 눈으로 보며 조정**해야 안 깨짐.
- 권장: 가장 깔끔한 타이틀 탭 1개(more) 파일럿 → dev 검증 → 동일 패턴 나머지 확대. home 은 tall 배너라 sticky-hide 체감 별도 확인.

- [x] 2026-06-23 — 헤더 토큰/훅/AppShell/TabBar-hide/.z-app-header 시스템 (ZINOSB 세션). 커밋 <hash>
- [ ] 6개 탭 헤더 .z-app-header 적용 — train-dia dev 시각 검증하며 (후속)

### 진행 (2026-06-23, ZINOSB 세션 — train-dia dev :3002 검증)
- [x] **home 헤더** — `.headerSection` sticky + `z-app-header`(transform-hide). ★dev 라이브 검증: 스크롤다운 시 헤더 translateY(-117px) 상승 + TabBar translateY(하강) 동시 = 작동 확인. 자체 gradient bg+노치라 frost 불요.
- [x] **TabBar 바텀 숨김** — dev 라이브 검증(translateY 하강).
- [x] **more(설정) 헤더** — `.pageTitle` full-width frost sticky(margin-inline 음수 상쇄 + padding-inline 재정렬 + --sat). `.z-app-header-frost` 에서 padding-top 제거(헤더별 노치 자체처리). tsc0/게이트0. ★브라우저 탭 about:blank 플레이크로 시각 최종확인은 진호 폰 권장.
- [x] **line(.header)·exchange(.pageTitle)·calendar(.nav)** — more 와 동일 full-width-frost sticky 패턴 적용 완료. 각 탭 타이틀 폰트(위계)는 보존, 헤더 거동·패딩·여백만 통일. calendar 는 컨테이너 `padding-top: calc(space-4 + safe-area-top)` → `.nav` 헤더 `--sat` 로 이전(이중 노치 방지). calendar nav 는 44px 컨트롤 포함이라 vertical padding=space-2(나머지 space-3). tsc0/changed게이트0(hover/surface-3d/theme-override/card-rhythm). ★dev :3002 라이브 측정 검증: **근무(calendar)** sticky/top0/z30/full-width(-16px), 스크롤다운 transform translateY(-69.6px) 숨음 + frost opacity 0→1, chrome-hidden/frosted=true ✅ / **5호선(line)** translateY(-55.7px) 숨음 + frost 0→1 ✅ / **교체(exchange)** sticky/frost/full-width 배선 정상, 콘텐츠 짧아 스크롤-숨김 미발동(line 과 동일 엔진). ★스크린샷은 검정-페인트 플레이크(DOM computed-style 측정은 정상) → 폰 최종확인 권장.
- [ ] duty — 헤더 요소 없음(배너만). 필요 시 타이틀 헤더 추가(후속).

### §10 바텀시트/모달 전역 통일 (2026-06-23, ZINOSB 세션 — train-dia dev :3002 검증)
> 진호 제보: 바텀모달이 *비쳐* 보임(뒤 캘린더 노출). ZINOSB 처럼 불투명+상단핸들+업/다운 통일 요청.

**진범**: `--dia-surface = var(--zg-card-fill)` = 솔리드 베이스 없는 반투명 글래스 그라디언트 스택.
ZINOSB 에선 솔리드 페이지 bg 위 카드로 글래스처럼 보이지만, 모달/시트는 다른 콘텐츠 위에 떠서
backdrop-filter 전역 무력화(UI-GLASS-TIER-001)와 겹쳐 blur 없이 *반투명만* 남아 비침.

**수정**:
- [x] **토큰** `--dia-sheet-fill: var(--zg-card-fill), var(--dia-bg-elevated)` (글래스 위 솔리드 = 불투명+글래스룩) + `--dia-overlay-bg`(dim) 추가, 다크/라이트 양면. 떠있는 표면 전용.
- [x] **공용 Modal**(Modal.tsx/.module.css) — ZINOSB BottomSheetShell 거동 이식: 상단핸들(28px 히트+::before 36×4) + dim *형제* 레이어(부모 opacity 페이드 시 시트까지 투명해지는 버그 회피) + 진입 slideUp 240ms / 닫힘 translateY(110%)+dim 동기 페이드(330ms 후 unmount). 표면 `--dia-sheet-fill` 불투명. ESC/스크롤락/포커스 유지.
- [x] **드래그-닫기**(`src/hooks/useSheetDragDismiss.ts`, ZINOSB SSOT 이식) — 핸들 잡고 아래로 끌면 시트가 따라 내려오고(translateY=dy), 임계 80px 초과 시 닫힘·미만 시 스냅백. 드래그 중 dim 실시간 동기(끄는 만큼 뒤 밝아짐). 핸들=full-width 28px 히트영역+::before 36×4 바, `touch-action:none`. Modal + SwapBottomSheet 양쪽 배선. 터치+마우스(데스크톱 디버그) 지원. (포털/햅틱은 미이식 — 범위 밖) ★dev 마우스 드래그 실측: 130px=닫힘✅ / 40px=스냅백✅ / 드래그중 dim 동기(0.85)✅.
- [x] **SwapBottomSheet**(교번변경) — 동일 패턴 인라인 적용(closing state + dim 형제 + 불투명 + 핸들 토큰 통일).
- [x] **센터 공지모달 5종**(CycleChange/RefreshGuide/Relogin/InternWelcome+KimMinkyung재사용/InternIntro) + **MissionCard** + **Toast.info** — `.content`/박스 bg `var(--dia-surface)` → `var(--dia-sheet-fill)` 불투명 스왑(비침 버그만, 센터는 핸들 없이 popIn 유지).
- 자동 수혜: SubwaySearchOverlay(공용 Modal 경유).
- 손 안 댐: WhatsNewModal(이미 솔리드 hex)/DiaChartModal(#fff)/AttachmentLightbox(검정)/풀스크린오버레이4(--dia-bg 솔리드).
- tsc0 · changed게이트0(hover/surface-3d/theme-override/card-rhythm).
- ★dev :3002 라이브 실측(교번비교→기관사선택 시트): sheet bg `rgb(19,27,46)` **솔리드 불투명** ✅ + 글래스 그라디언트 레이어 유지 + dim `rgba(0,0,0,0.6)` + 핸들바 36×4px ✅. 닫힘: `closing` 발동 → transform translateY(+205px) 하강 + dim opacity 1→0.73 동기 → 330ms 후 unmount ✅. 스크린샷도 불투명 확인.
