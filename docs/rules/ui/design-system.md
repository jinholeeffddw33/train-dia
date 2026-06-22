# train-dia 디자인 시스템 룰 (ZINOSB 이식 2026-06-23)

> SSOT 토큰: `src/styles/tokens.css`(--dia-*) + `src/styles/premium-fake-glass.css`(이식된 --z-*/--zg- 버튼4법·글래스). 테마: 다크 기본 + 라이트 `:root.light` 클래스(+ `html[data-theme]`).
> 자동 가드: `npm run check:quality-gates`. 이식 전체 명세: [`docs/ZINOSB_SYSTEM_PORT.md`](../../ZINOSB_SYSTEM_PORT.md).
> 모든 가드는 **변경 라인만(--staged/--changed)** 검사 → 레거시 안 건드림, 새 코드만 강제.

---

## UI-SURFACE-3D-001 — 입체 표면 (버튼 4법)

칩/버튼/카드/세그먼트는 **입체 표면**이어야 한다. 영구 금지:
- **AP2**: 평면 단색 채움(`background: #color` 단색에 box-shadow/gradient/backdrop 없음)
- **AP1**: 테두리만 색칠한 hollow outline(border 색만 + 속 빔)

정답 = Dimensional Surface 토큰(`--z-card-fill`/`--z-seg-*`/`--z-3d-*`) 또는 `.z-glass-surface`/`.z-segment`(premium-fake-glass.css). **다크 = 리퀴드 글래스(raised), 라이트 = 클린 뉴모피즘** — 한 기법을 양 테마에 그대로 쓰지 말 것.

- 예외: 클래스 직전 줄 `/* SURFACE-EXCEPTION: 사유 */`, 읽기전용 배지/점/바/구분선/토글 손잡이, 기존 평면 칩 점진 마이그.
- 가드: `scripts/check-surface-3d.mjs` (`check:surface-3d`) · severity **fail** (변경 라인만).
- 현재 레거시 5건(calendar .swapSaveBtn, edu .optionMark 등) — 변경 시 수렴.

## CSS-THEME-OVERRIDE-001 — 테마 오버라이드 이미지

`background-color` 는 `background-image`(gradient/url)를 **못 지운다** → 베이스 다크 gradient 가 라이트에서 시커멓게 잔존.
- 베이스가 `background:`(shorthand)/`background-image:` 로 gradient/url 을 깔았으면, 반대 테마(`:root.light` / `[data-theme=light]`) 오버라이드도 **반드시** `background:`(shorthand) 로 이미지째 교체하거나 **테마 토큰**(테마가 값 가름)으로 오버라이드 자체 제거.
- 예외: 레거시(변경 전 보호), 규칙 직전 줄 `/* THEME-EXCEPTION: 사유 */`.
- 가드: `scripts/check-theme-override.mjs` (`check:theme-override`) · severity **fail** (변경 라인만). ★ train-dia `:root.light` 클래스 스코프까지 감지하게 적응됨.

## UI-RHYTHM-001 — 카드/섹션 리듬 토큰 (WARN)

카드 리스트/그리드 컨테이너(`.*list`/`.*grid`/`.*feed`/`.*cards`/`.*items`/`.*stack`)의 `gap` 은 토큰 사용:
- 카드 사이 = `var(--dia-space-3)`(12) · 섹션 사이 = `var(--dia-space-6)`(24) · 그 외 `--dia-space-*`
- 안 잡음: 1~3px 타이트 사진/스펙 그리드(붙은 타일), 컨테이너 이름 아닌 셀렉터.
- 예외: 규칙 직전 줄 `/* RHYTHM-EXCEPTION: 사유 */`.
- 가드: `scripts/check-card-rhythm.mjs` (`check:card-rhythm`) · severity **warn** (변경 라인만). 향후 fail 승격 후보.

## CSS-HOVER-001 — raw :hover 금지

터치 우선 앱 — raw `:hover` 금지(터치 기기 sticky hover 방지). `@media (hover: hover)` 로 감싸거나 제거.
- 자동 변환: `node scripts/wrap-hover-media.cjs <file>`.
- 가드: `scripts/check-no-raw-hover.cjs` (`check:hover`) · severity **fail** (전체 src, 현재 클린).

---

## 보류 룰 (train-dia 미도입 — ZINOSB_SYSTEM_PORT.md 참조)
- **UI-BLEED-001**(풀블리드): train-dia 에 페이지 게터(#main-content / --z-page-pad) 없음 → 게터 SSOT 도입 시 이식.
- **UI-SHEET-003**(BottomSheetShell): train-dia 에 시트 단일 컴포넌트 없음 → 도입 시 이식.
- **CSS-DOUBLE-PADDING-001**: train-dia 레이아웃(AppShell)이 #main-content 게터와 달라 적응 필요.
- 폰트 하한: 50~60대 사용자라 ZINOSB(13px)보다 큼 — CLAUDE.md 의 14px 최소/13px 메타 예외 기준 따름.
