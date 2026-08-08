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

## UI-TEXT-SIZE-001 — 텍스트 하한 + 글자 설정 우회 방지

50-60대 사용자 가독 하한 가드 (2026-07-02 대개편 감사에서 신설 — 달력 출근시각 10px 사고 재발 방지):
- **[FAIL]** `font-size` 13px 미만 raw px — 어떤 경우에도 불허 (CLAUDE.md §1.1)
- **[WARN]** `font-size` 13px 이상 raw px — raw px 는 글자 크기 설정(`font-small/large/xlarge`)을 우회하므로 `var(--dia-text-*)` 토큰 사용
- **[WARN]** 버튼성 셀렉터(btn/button/chip/tab/fab)의 `min-height|height` 40px 미만 — 터치 타겟 44px 권장

- 예외: 직전 줄 `/* TEXT-EXCEPTION: 사유 */`(장식·dev 전용만), `components/dev/` 자동 제외.
- 가드: `scripts/check-text-size.mjs` (`check:text-size`) · FAIL은 severity **fail** (변경 라인만).

## CSS-HOVER-001 — raw :hover 금지

터치 우선 앱 — raw `:hover` 금지(터치 기기 sticky hover 방지). `@media (hover: hover)` 로 감싸거나 제거.
- 자동 변환: `node scripts/wrap-hover-media.cjs <file>`.
- 가드: `scripts/check-no-raw-hover.cjs` (`check:hover`) · severity **fail** (전체 src, 현재 클린).

## UI-SHEET-HEIGHT-001 — 시트/모달 높이는 노치를 가리지 않는다

바텀시트·풀스크린 모달의 `max-height` 는 **토큰 두 개**만 쓴다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--dia-sheet-h-full` | `calc(100dvh - var(--sat) - 44px)` | 끝까지 올린 시트 |
| `--dia-sheet-h-compact` | `min(72dvh, full)` | 짧은 시트(기본) |

**왜** — 실측(2026-08-09): 시트/모달 `max-height` 가 80~98vh 로 흩어져 있었고 **전부 safe-area 를 고려하지 않았다**.

| | 상단 여백 | 다이내믹 아일랜드(59px) |
|---|---|---|
| 이전 `96vh` (852px 화면) | **32px** | ❌ **가림** |
| `98vh` (MissionCard) | 17px | ❌ 더 심함 |
| `--dia-sheet-h-full` + `--sat:59px` | **103px** | ✅ |

- **호출부에서 `calc(100dvh - env(...))` 를 손으로 적지 말 것** — Android 는 `env()` 가 0 을 거짓 보고하는 기기가 있어 `--sat` 을 타야 한다(CSS-SAFEAREA-001).
- 90vh 미만은 이미 노치 아래에서 멈추므로 **건드리지 않았다**(일괄 치환 금지). 이관 대상은 ≥90vh **19건 / 13파일**.
- 이미지·내부 스크롤 영역의 `max-height` 는 시트가 아니므로 대상이 아니다.

## UI-MOTION-001 — transition 의 duration/easing 은 토큰 경유

**duration 5단계** (실사용 지배값 그대로 — 값 보존)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--dia-dur-instant` | 0.1s | 소형 아이콘 press (§2.6) |
| `--dia-dur-fast` | 0.12s | 버튼/칩/탭 press — 최다 사용 |
| `--dia-dur-base` | 0.15s | 카드/대형 서피스 press |
| `--dia-dur-slow` | 0.2s | 패널 전환·확장 |
| `--dia-dur-slower` | 0.3s | 시트/오버레이 진입 |

**easing** — `--dia-ease`(표준) / `-out`(진입) / `-in`(퇴장) / `-press`(press 감쇠) / `-spring`(팝). raw `cubic-bezier(...)` 금지.

**왜** — 실측(2026-08-09): transition duration 이 **22종 334개 값**으로 흩어져 있었다. 기존 `--dia-transition-*` 3종(150/250/350ms)은 **사용 0회** — 정의만 있고 실사용 지배값(0.12s 97건 · 0.15s 53건)과 아예 안 맞아서 아무도 안 썼다. 그래서 이번엔 **토큰을 실사용값에 맞췄다**(반대가 아니라). 같은 성격의 인터랙션인데 0.12/0.14/0.15/0.18 이 섞이면 "이 앱은 왜 반응이 들쭉날쭉하지"가 된다.

- `animation` 의 duration 은 **대상 아님** — 루프/장식이라 인터랙션 스케일과 성격이 다르다.
- `prefers-reduced-motion` 오버라이드(0.01ms)는 제외.
- 이관 결과 334건 → 잔여 **27건**(92% 감소), 나머지는 baseline 등록.
- 예외: 직전 줄 `/* MOTION-EXCEPTION: 사유 */`.
- 가드: `scripts/check-motion.mjs` (`check:motion`) · severity **fail** · baseline 래칫(stale 도 FAIL).

## UI-TOAST-001 / UI-HAPTIC-001 — 알림과 햅틱은 SSOT 하나로

**토스트** — 상태는 [`src/stores/toast.ts`](../../../src/stores/toast.ts) 가 갖고, `components/common/Toast.tsx` 는 **그리기만** 한다. 호출은 `showToast(text, type)` 하나 (`info` | `success` | `error` | `warning`).

**왜 store 인가** — 이전 구현은 모듈 레벨 가변 싱글턴(`let addToastFn = null`)이었다. 컨테이너가 마운트될 때 자기 `setState` 를 꽂고 언마운트 때 `null` 로 되돌린다. 그래서 **컨테이너가 뜨기 전이나 재마운트 사이에 부른 토스트는 조용히 사라졌다** — 초기 로드 중 에러 알림이 증발하는 경로였다. store 는 컴포넌트 생명주기 밖이라 그 창이 없다.

**햅틱** — [`src/lib/haptic.ts`](../../../src/lib/haptic.ts) 만 쓴다. `navigator.vibrate` 직접 호출 금지.

- `hapticLight`(탭·토글) / `hapticMedium`(주요 CTA) / `hapticSuccess` / `hapticWarning` / `hapticError`
- **feature detect 우선** — `canVibrate()` 로 먼저 묻고 미지원이면 아예 안 부른다. try/catch 로 예외를 삼키는 방식이 아니다("실패했지만 호출은 했다" ≠ "지원 안 하면 안 부른다").
- train-dia 는 PWA 라 **iOS Safari 는 미지원**. 없어도 동작에 지장 0 이어야 한다.
- `prefers-reduced-motion: reduce` 면 진동도 하지 않는다(train-dia 는 모션 감소를 **존중**하는 게 정책).

**★ 중복 발화 금지** — `success`/`error`/`warning` 토스트는 store 가 **햅틱을 자동 발화**한다. 호출부에서 토스트와 함께 햅틱을 또 부르지 말 것. 개별 버튼 703곳 배선 대신 이 한 곳으로 커버한다(실측 커버리지 3.5% → 알림 경로 100%).

- 회귀 테스트: `src/stores/__tests__/toast-store.test.ts` (9건 — 렌더러 없이도 동작 / 중복 억제 / 개수 제한 / 수명 / 미지원 환경 no-op)

## UI-BLEED-001 / UI-BLEED-002 — 페이지 게터와 풀블리드

화면 좌우 여백은 **`var(--dia-page-pad)` 하나**로만 정한다(= 16px, 기존 실사용값 그대로).

- **UI-BLEED-001 (탈출)** — 게터를 넘어 화면 끝까지 빼는 음수 가로 마진은 `calc(-1 * var(--dia-page-pad))`. raw px·`--dia-space-*` 직접 사용 금지(게터 값이 바뀌면 같이 안 움직인다).
- **UI-BLEED-002 (복귀)** — 블리드한 규칙의 **가로 복귀 패딩**은 `var(--dia-page-pad)` 또는 `0` 둘 중 하나. `calc(게터 + 무언가)` 금지 — 더 들여쓰려면 **자식 요소**에 준다.

**왜 룰이 둘인가 (ZINOSB 실사고)** — 게터 16 vs 복귀 28이 **3개월 생존**했다. 같은 화면의 다른 요소와 12px 어긋났는데도 **탈출(margin)만 검사하던 가드는 "위반 0건"을 냈다**. margin이 정답이면 복귀가 28px여도 통과였기 때문이다. 그래서 복귀까지 보는 002가 따로 필요하다.

**유틸을 쓰면 손으로 안 적어도 된다** (globals.css)
| 클래스 | 용도 |
|---|---|
| `.diaBleed` | 순수 풀블리드 — 내용까지 끝까지 (이미지/구분선) |
| `.diaBleedInset` | 블리드 + 안쪽 게터 복원 (스크롤-숨김 헤더 frost 배경) |
| `.diaScrollRow` | 가로 스크롤 리스트 — 끝까지 확장 + 첫/마지막 여백 유지 |

> ★ 가드 판정 주의 — "음수 가로 마진"이라고 다 블리드가 아니다. `-1px`(srOnly), `-8px`(아이콘 정렬), `-150px`(`left:50%` 센터링)은 게터와 무관한 광학 보정이다. 초안 가드가 이걸 전부 잡아 거짓 FAIL 8건을 냈다. 판정은 **좌우 대칭 + 게터 크기 이상**일 때만.

- 예외: 직전 줄 `/* BLEED-EXCEPTION: 사유 */`.
- 가드: `scripts/check-bleed.mjs` (`check:bleed`) · severity **fail** · 전량 스캔.

## UI-ZLAYER-001 — 레이어급 z-index 는 토큰 경유

`z-index` 가 **10 이상**이면 raw 숫자 금지 → `var(--dia-layer-*)`. 로컬 스택(**-1~9**)은 컴포넌트 내부 겹침이라 대상이 아니다.

**사다리** (`src/styles/tokens.css`)
```
base 0 < sticky 10 / sticky-above 11 < dropdown 20 < fixed 30
      < overlay 50 / overlay-above 60 < modal 100 / modal-above 150 < toast 200
      < fullscreen 1000 / fullscreen-above 1100
      < viewer 1150 / viewer-panel 1200 / viewer-sheet 1300 / viewer-sheet-above 1305 / viewer-top 1310
      < critical 9999
```

**왜** — 숫자가 흩어져 있으면 "이게 저것보다 위인가"를 코드만 보고 판단할 수 없다. 새 오버레이마다 "일단 큰 숫자"를 찍게 되고 그렇게 1000→1100→1305→1310 같은 사다리 아닌 사다리가 자란다. 실측(2026-08-09): raw 24종 135건, 레이어급 16종 45건, `--dia-layer-*` 토큰은 정의만 있고 **사용 0회**.

> ★ 이관은 **값 보존 치환**이다 — 토큰이 현재 값을 그대로 갖는다. 번호를 재배치하면 라이브에서 모달이 토스트 뒤로 숨는 사고가 난다. 사다리를 예쁘게 정리하는 건 **이름이 붙은 뒤**의 다음 문제다.

- 예외: 직전 줄 `/* ZLAYER-EXCEPTION: 사유 */`.
- 가드: `scripts/check-zlayer.mjs` (`check:zlayer`) · severity **fail** · 전량 스캔.

## UI-TOKEN-REF-001 — 팬텀 var() 금지

`var(--x)` 를 쓰기 전에 토큰이 실재하는지 확인한다. CSS 커스텀 프로퍼티는 **silent fail** — 미정의 토큰을 폴백 없이 참조하면 그 선언 전체가 계산 시점에 무효가 되어 **조용히 사라진다**. 에러도 경고도 빌드 실패도 없다.

**실제 사고 (2026-08-09)** — apex 게임 `.canvasRetryBtn`(캔버스 오류 시 재시도 버튼)이 ZINOSB 잔재 `var(--z-3d-lime-hi/lo/shadow)` 를 폴백 없이 참조했다. train-dia 에 그 토큰이 이식되지 않아 `background` 와 `box-shadow` 가 통째로 죽었고, 어두운 배경(`#0a0d1e`) 위에 어두운 글자(`#101408`)만 남아 **버튼이 보이지 않았다**.

- **[FAIL]** 폴백 없는 미정의 참조 `var(--x)` — 선언이 죽는다.
- **[WARN]** 폴백 있는 미정의 참조 `var(--x, 폴백)` — 동작은 하지만 주입처가 없으면 "색을 갈아끼우려던 설계가 배선되지 않은 것"이라 항상 폴백값만 보인다. (예: `--dia-sky-dim` 누락으로 영상가이드 sky 그룹만 회색이었음)
- 정의로 인정: CSS 어디서든 `--x:`(한 줄 규칙 포함) · `@property` · JS `setProperty` · JSX `style={{ '--x': v }}` 및 계산된 키 `[ '--x' as string ]`.
- 예외: 직전 줄 `/* TOKEN-REF-EXCEPTION: 사유 */`.
- 가드: `scripts/check-token-refs.mjs` (`check:token-refs`) · severity **fail** · 전량 스캔. 현황 리포트 `check:token-refs:report`.

> ★ 가드 작성 시 함정 — 정의 탐지를 **줄머리로 한정하면 안 된다**. `.cls { --x: v; }` 같은 한 줄 규칙이 흔해서 거짓 FAIL 이 쏟아진다(초안에서 실제 발생). 계산된 JSX 키(`['--x' as string]:`)도 마찬가지.

## CSS-SAFEAREA-001 — safe-area 는 토큰 경유 (노치/다이내믹 아일랜드)

raw `env(safe-area-inset-*)` 신규 사용 **금지** → `var(--sat)` / `var(--sab)` / `var(--sal)` / `var(--sar)`.

**왜** — `layout.tsx` 가 `viewportFit:'cover'` + `appleWebApp.statusBarStyle:'black-translucent'` 이라 콘텐츠가 이미 상태바 뒤까지 올라가 있다. iOS PWA standalone 에는 `env(safe-area-inset-top)` 이 **0 을 반환하는 WebKit 버그**가 있어, raw `env()` 를 쓰면 fallback `0px` 이 그대로 먹혀 헤더가 노치·다이내믹 아일랜드 밑으로 들어간다. 보정식(`html.pwa-ios { --sat: max(env(...), 20px) }`)은 `globals.css` 한 곳에만 있으므로 화면이 raw `env()` 를 쓰면 그 보정을 통째로 우회한다.

- 정의부(`--sat: env(...)`)만 raw `env()` 를 쓴다 — 거기가 정답 자리. SSOT: `src/styles/tokens.css` + `src/app/globals.css` 플랫폼 오버라이드.
- 플랫폼 클래스(`html.pwa-ios` / `html.pwa-android`)는 `layout.tsx` 인라인 스크립트가 hydration 전에 붙이며, **standalone 일 때만** 붙는다(일반 Safari 브라우징은 `env()` 가 정상 0 이라 바닥값을 걸면 없던 여백이 생김).
- 전역 `--sab` 에 최소 높이를 깔지 않는다 — 하단 inset 이 정상 0 인 기기에서 빈 띠가 생긴다(ZINOSB 도 같은 이유로 전역을 안 건드림).
- 예외: 직전 줄 `/* SAFEAREA-EXCEPTION: 사유 */`.
- 가드: `scripts/check-safearea.mjs` (`check:safearea`) · severity **fail** · **전량 스캔**(이관 완료로 위반 0 이라 baseline 불필요).

## CSS-VIEWPORT-UNIT-001 — bare 100vh 금지

`100vh` 는 iOS 주소창 높이를 포함해 화면이 잘린다. 반드시 바로 다음 줄에 같은 속성의 `100dvh` 폴백 짝을 둔다(구형 브라우저용 점진적 향상 — `100vh` 를 *지우는* 게 아니라 `100dvh` 를 *덧붙인다*).

```css
min-height: 100vh;   /* 구형 폴백 */
min-height: 100dvh;  /* 실제 적용 */
```
- 예외: 직전 줄 `/* VIEWPORT-EXCEPTION: 사유 */`.
- 가드: `scripts/check-safearea.mjs` (`check:safearea`) · severity **fail**.

---

## 보류 룰 (train-dia 미도입 — ZINOSB_SYSTEM_PORT.md 참조)
- **UI-BLEED-001**(풀블리드): train-dia 에 페이지 게터(#main-content / --z-page-pad) 없음 → 게터 SSOT 도입 시 이식.
- **UI-SHEET-003**(BottomSheetShell): train-dia 에 시트 단일 컴포넌트 없음 → 도입 시 이식.
- **CSS-DOUBLE-PADDING-001**: train-dia 레이아웃(AppShell)이 #main-content 게터와 달라 적응 필요.
- 폰트 하한: 50~60대 사용자라 ZINOSB(13px)보다 큼 — CLAUDE.md 의 14px 최소/13px 메타 예외 기준 따름.
