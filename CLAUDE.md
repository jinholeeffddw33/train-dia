# Train-DIA UI/UX 규칙 (v3.1 — ZINOSB registry 시스템 이식 2026-06-23)
> 기관사 근무표 앱 — **50-60대 사용자 대상**, 모바일 퍼스트, 다크 퍼스트
> 이 문서는 **UI/UX 디자인 규칙**을 담고, 이제 **룰 registry 의 bootstrap** 역할도 한다.

## 🚨 RULE PREFLIGHT — 모든 Edit/Write 전 (ZINOSB 이식)
1. **registry 읽기**: `docs/rules/registry.json` (도메인/파일패턴→mustRead/룰 매핑 SSOT).
2. 작업이 건드릴 파일 경로 → `domains.*.filePatterns` 매칭 → `mustRead` Read.
3. 코드 수정 후 검증: `npm run check:quality-gates` (hooks·hover·surface-3d·theme-override·card-rhythm 변경 라인).
4. **commit 게이트(QG-HOOK-001)**: `npm run check:hooks` 통과 필수 — 비활성 시 `npm run install:hooks` 먼저. `--no-verify` 금지.
5. **git stage(GIT-SCOPE-001)**: `git add -A`/`.`/`commit -a` 금지 — 내가 만진 파일만 명시 stage.
> 자동 가드/룰 본문: [docs/rules/ui/design-system.md](docs/rules/ui/design-system.md) · 이식 전체 명세·진행: [docs/ZINOSB_SYSTEM_PORT.md](docs/ZINOSB_SYSTEM_PORT.md). 아래 §1~ 의 UI 산문 규칙은 유지(가드로 승격된 건 design-system.md 가 SSOT).

### 참조 문서
| 문서 | 역할 |
|------|------|
| **이 파일 (CLAUDE.md)** | UI/UX 규칙 + registry bootstrap — 매 대화 자동 참조 |
| **[docs/rules/registry.json](docs/rules/registry.json)** | 룰 registry SSOT (도메인·룰ID·가드 매핑) |
| **[docs/rules/ui/design-system.md](docs/rules/ui/design-system.md)** | 가드 룰 본문(surface-3d/theme-override/card-rhythm/hover) |
| **[docs/ZINOSB_SYSTEM_PORT.md](docs/ZINOSB_SYSTEM_PORT.md)** | ZINOSB 시스템 이식 명세·진행 로그(다른 세션용 명령 포함) |
| **[docs/DESIGN_AUDIT.md](docs/DESIGN_AUDIT.md)** | 다크/라이트 감사, 대비, 크로스 브라우저 |
| **[docs/PARTNER_MATCHING.md](docs/PARTNER_MATCHING.md)** | 교대자 매칭 알고리즘 |
| **[docs/DOMAIN_RULES.md](docs/DOMAIN_RULES.md)** | 열차번호/행로/교대자/스케줄/데이터 규칙 |
| **[docs/PROCESS_RULES.md](docs/PROCESS_RULES.md)** | AI 행동/커밋/배포/버그수정 프로토콜 |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | 프로젝트 구조/API/보안/성능 |

---

## 1) P0 절대 규칙 (UI)

### 1.1 폰트 크기 3티어 (P0)
| 용도 | 크기 | 비고 |
|------|------|------|
| 본문 텍스트 | 14-16px | `--dia-text-sm` ~ `--dia-text-base` |
| 보조 텍스트 | 14px | `--dia-text-sm` 사용 (일반 보조는 14px 이상) |
| 메타/배지/타임스탬프 (예외) | 13px | `var(--dia-text-meta)` — 타임스탬프·배지·태그·칩·카운트·단위·인디케이터 한정 |
| 절대 최솟값 | **13px** | `var(--dia-text-meta)` 예외 자리에만 |
| 13px 미만 | **금지** | 어떤 경우에도 불허 |
| 14px 미만의 일반 본문/라벨/버튼 | **금지** | 본문·라벨·버튼·CTA·카드 제목/설명 모두 14px 이상 |

- 토큰 `--dia-text-xs`, `--dia-text-sm` 최솟값 = **14px**
- 토큰 `--dia-text-meta` = **13px** (예외 한정: 타임스탬프, 배지, 태그, 칩, 메타데이터, 카운트, 단위, 인디케이터)
- 핵심 숫자(교번/시간) 24-32px
- 50-60대 사용자 — **읽기 쉬움이 미학보다 우선**

### 1.2 모바일 무결성 (P0)
- 모바일 UI 깨짐(overflow/겹침/가로 스크롤) **0 허용**
- 작은 화면 + 폰트 확대(접근성)에서도 레이아웃 유지
- Safe-area 완전 대응 (iOS notch + 하단 홈바)

### 1.3 다크/라이트 동시 검증 (P0)
- UI 변경 시 **다크 + 라이트 모두 확인 필수**
- 한쪽에서만 안 보이는 UI = P0 버그

### 1.4 색상은 반드시 토큰으로 (P0)
- 모든 색상은 `src/styles/tokens.css`의 `--dia-*` 변수 사용
- 하드코딩 색상(`#fff`, `rgba(...)`) 사용 금지
- 예외: `@keyframes` 내부 애니메이션 전용 값

### 1.5 상태/로딩/에러 표시 (P0)
- 상태·로딩·에러를 UI에서 숨기거나 생략 금지
- 실패 시 사용자가 "무엇을 하면 되는지" 안내 필수
- `alert()` 사용 금지 → 인라인 UI/토스트/상태 컴포넌트

### 1.6 접근성 (P0) — WCAG 2.1
- **모든 인터랙티브 요소**에 `:focus-visible` 포커스 링 (`outline: none` 단독 금지)
- **모든 모달**에 `role="dialog"` + `aria-modal` + focus trap + ESC 닫기
- **모든 `<button>`에 `type` 명시** (`type="button"` 또는 `type="submit"`)
- 탭: `role="tablist"` + `role="tab"` + `aria-selected` + `tabIndex`

### 1.7 인라인 스타일 금지 (P0)
- `style={{ ... }}` 사용 금지
- **예외**: 동적 런타임 값(CSS 불가) 또는 브라우저 버그 회피 → `// STYLE-EXCEPTION: [사유]`

---

## 2) Night Shift 디자인 (다크 퍼스트)

### 2.1 브랜드 공식
- **다크 모드 = 야간 운전실**: 딥 네이비 + 차분한 블루 포인트
- **라이트 모드 = 주간 승무실**: 쿨 그레이 배경 + 높은 가독성
- `:root` = 다크 모드 기본, `:root.light` = 라이트 오버라이드
- 새 토큰 추가 시 **양쪽 모드 모두 정의 필수**

### 2.2 50-60대 최적화
- 본문 16px (일반 앱보다 큼), 핵심 숫자 24-32px
- 터치 타겟 48px 권장 (44px 최소)
- **글자 크기 설정**: small/normal/large (fontSize 스토어)

### 2.3 색상 팔레트
| 컬러 | Hex | 용도 |
|------|-----|------|
| 배경 | `#0F172A` | 다크 기본 배경 |
| 카드 | `#1E293B` | 카드/서피스 |
| 블루 | `#3B82F6` | 홈탭, 기본 CTA |
| 그린 | `#22C55E` | 캘린더탭, 성공 |
| 퍼플 | `#8B5CF6` | 라인5탭, 커뮤니티 |
| 앰버 | `#F59E0B` | 비교탭, 경고 |
| 스카이 | `#38BDF8` | 연락처탭, 정보 |
| 레드 | `#EF4444` | 위험/삭제 |

### 2.4 대비 기준
| 텍스트 역할 | 다크 모드 | 라이트 모드 | 최소 대비 |
|-------------|-----------|-------------|-----------|
| Primary | `#F1F5F9` on `#0F172A` | `#0F172A` on `#F0F4F8` | 4.5:1 |
| Secondary | `#94A3B8` on `#0F172A` | `#475569` on `#F0F4F8` | 4.5:1 |
| Tertiary | `#64748B` on `#1E293B` | `#94A3B8` on `#FFFFFF` | 3.5:1 |

### 2.5 보더 토큰
| 토큰 | 용도 |
|------|------|
| `--dia-border` | 기본 보더 |
| `--dia-border-strong` | 강조 보더 |
| `--dia-border-light` | 미세 구분선 |
| `--dia-border-dim` | 최미세 구분선 |

### 2.6 Press 애니메이션 3티어 (필수)
| 대상 | Scale | Transition | 유틸 클래스 |
|------|-------|------------|------------|
| 카드/대형 서피스 | `scale(0.98)` | `transform 0.15s ease` | `.diaPress` |
| 버튼/칩/탭 | `scale(0.95)` | `transform 0.12s ease` | `.diaPressBtn` |
| 소형 아이콘 | `scale(0.9)` | `transform 0.1s ease` | `.diaPressIcon` |

- 모든 `:active`에 반드시 `transition` 포함 (snap 금지)
- 비표준 scale 값 사용 금지 (0.85, 0.92, 0.96, 0.97 등)
- `opacity` 단독으로 press 표현 금지 — scale과 병행

---

## 3) 모바일 무결성

### 3.1 레이아웃
- 레이아웃 크기에 픽셀 고정 금지 (clamp/grid 기반)
- 아이콘·보더·터치타겟은 px 허용
- 텍스트·숫자는 **최악 케이스 기준 설계** (20자 한글, 이모지 포함)

### 3.2 화면 폭 기준 (P0)
| 폭 | 의미 | 검증 |
|----|------|------|
| **320px** | 절대 하한선 | 필수 |
| **360px** | Android 표준 | **주력 테스트** |
| **375px** | iPhone SE 3 / 8 | 필수 |
| **390px** | iPhone 14/15 | 필수 |
| **430px** | Pro Max / 대형 Android | 권장 |

### 3.3 터치 타겟 (P0)
- 모든 탭/선택 요소 **최소 44px × 44px** hit area
- 인접 버튼·칩 간격: **최소 8px**, 권장 12px
- 50-60대 사용자 — **48px 권장**

### 3.4 텍스트 크기 기준
| 구분 | 최소 | 권장 | 대비 |
|------|------|------|------|
| 본문 | 14px | 16-18px | 4.5:1+ |
| 보조 텍스트 | 13px | 14px | 4.5:1+ |
| CTA 버튼 | 16px | 16-18px | 4.5:1+ |
| 핵심 숫자 | 20px | 24-32px | 7:1 권장 |
| 절대 최소 | **12px** | - | 3.5:1+ |

### 3.5 Safe-area
- `env(safe-area-inset-*)` 4방향 전체 적용
- 하단 TabBar: `padding-bottom: env(safe-area-inset-bottom)` 필수

### 3.6 극단 케이스 (필수 시뮬레이션)
- 긴 기관사 이름 (20자 한글), 긴 열차번호 조합
- 3근무 야간 행로, 빈 값 (교대자 없음, 비번)
- 폰트 확대 설정 (large 모드)

---

## 4) 스타일링 규칙

### 4.1 구현 우선순위
1. CSS Modules (.module.css) — 기본 표준
2. Design Tokens (`--dia-*` CSS Variables)
3. globals.css 유틸 클래스 — `.srOnly`, `.diaTruncate`, `.diaBtnIcon`, `.diaPress`, `.diaPressBtn`, `.diaPressIcon`, `.safeBottom`

### 4.2 토큰 규칙 (매직 넘버 금지)
- 모든 색상/간격/라운드/그림자 = `--dia-*` 토큰
- CSS 변수는 silent fail — 토큰 존재 여부 `tokens.css` 확인 후 사용
- `--dia-spacing-*` 없으면 `--dia-space-*` 확인

### 4.3 색감 규칙
- 라이트 모드 카드 washed-out 금지 — 명도/채도 충분해야 함
- raw `rgba()` CSS Modules 내 사용 금지 → `--dia-*` 토큰만
- 예외: `@keyframes` 내부만 허용

### 4.4 CSS Module 클래스명
- `.body`, `.header` 같은 범용 이름 금지 → 접두사 사용 (예: `.homeBody`)

### 4.5 CSS 함정 방지
- flex 자식 `min-width: auto` → `min-width: 0` 필수
- flex 안 input/textarea → `min-width: 0` + `width: 100%` + `box-sizing: border-box`
- 카드 안 버튼 행 → `flex-wrap: wrap` + `white-space: nowrap`
- fixed/sticky spacer 높이 하드코딩 금지 → `ResizeObserver`

### 4.6 3D 버튼 규칙 (P0 — 모든 버튼 필수)
모든 버튼은 3D press 효과를 가져야 한다. globals.css에 기본 `button:active` 정의 있음.

#### CTA/액션 버튼 (startBtn, navBtnPrimary, biometricBtn 등)
```css
background:
  radial-gradient(circle at 30% 25%, rgba(255,255,255, var(--dia-3d-bloom)), transparent 55%),
  linear-gradient(145deg, var(--dia-3d-COLOR-start), var(--dia-3d-COLOR-end));
box-shadow: var(--dia-3d-inset), var(--dia-3d-depth), var(--dia-3d-COLOR-glow);
/* :active → box-shadow: var(--dia-3d-pressed); */
```
COLOR = `blue` | `green` | `amber` | `red` | `purple`

#### 아이콘/보조 버튼 (backBtn, navBtn 등)
```css
box-shadow: var(--dia-3d-inset), var(--dia-3d-depth);
border: none;
/* :active → box-shadow: var(--dia-3d-pressed); */
```

#### 텍스트 버튼 (deleteBtn, btnSecondary 등)
- globals 기본 press(`translateY(1px) scale(0.97)`)만 적용, 추가 shadow 불필요

#### 공통 hover (hover: hover 미디어 쿼리 안에서)
```css
filter: brightness(1.08);
transform: translateY(-1px);
```

### 4.7 애니메이션 규칙
- 허용: `box-shadow` 펄스, `opacity` 전환, `transform: scale()`
- 금지: `filter: drop-shadow` 애니메이션, `width/height` 애니메이션, 3초 미만 루프
- `prefers-reduced-motion: reduce` 대응 필수

### 4.8 크로스 브라우저
| 브라우저 | 우선순위 |
|----------|----------|
| Chrome (Android) | **주력** |
| Safari (iOS) | **P0 필수** |
| Samsung Internet | 권장 |
| Firefox | 권장 |

- iOS Safari: `-webkit-backdrop-filter` 접두사 필수

---

## 5) 에러/로딩/빈 상태 (P0)

| 상태 | 필수 표시 |
|------|----------|
| 로딩 중 | 스피너/스켈레톤 + "불러오는 중" |
| 빈 상태 | 아이콘 + 설명 + 다음 행동 안내 |
| 에러 | 에러 설명 + **재시도 버튼** |

- "오류가 발생했습니다" ❌ → "열차 정보를 불러올 수 없어요. 다시 시도해주세요" ✅
- `alert()` 금지, `console.log` 커밋 전 제거

---

## 6) UX 규칙 — 50-60대 기관사

### 6.1 3초 규칙
화면 진입 3초 안에: 1) 여기가 어딘지 이해 2) 다음 행동 파악

### 6.2 CTA 배치
- Primary CTA 한 화면에 **1개만**, 엄지 도달 범위 (하단 1/3)
- 높이 52-56px, 최소 폭 200px 또는 전체폭
- "확인" ❌ → "교번 저장하기" ✅ (동사 + 목적어)

### 6.3 모달
- 닫기: X 버튼 + ESC + 배경 클릭 (3가지 모두)
- focus trap + 이전 포커스 복원

### 6.4 문구 규칙
- 전문 IT 용어 금지 → 일상 한국어
- "렌더링 실패" ❌ → "화면을 불러올 수 없어요" ✅
- "세션 만료" ❌ → "다시 로그인해주세요" ✅

### 6.5 중복 금지 & 데이터 최소주의
- 같은 기능 2곳 이상 금지, Primary 1개 + 보조 최대 1개
- 사용자에게 불필요한 입력 강요 금지

---

## 7) UI Quality Gate

- 가로 스크롤 0 (320px 폭에서도)
- 긴 문자열/이름/이모지 포함 시 깨짐 0
- 폰트 확대 시 레이아웃 유지, Safe-area 완전 대응
- 360px에서 모든 UI 정상 확인
- 터치 타겟 44px 미달 0개, 인접 간격 8px 미만 0개
- **12px 미만 텍스트 0개**
- 다크/라이트 모두 가독성 확인

---

## 8) Self-QA (커밋 전)

- [ ] `style={{` 검색 → 있으면 CSS Module로 교체
- [ ] 새 `<button>`에 `type` 명시
- [ ] 새 인터랙티브 요소에 `:focus-visible` + `:active` press 확인
- [ ] 하드코딩 색상/수치 → `--dia-*` 토큰
- [ ] 12px 미만 텍스트 0개
- [ ] 다크/라이트 양쪽 확인
- [ ] 360px 모바일 깨짐 0개
- [ ] `console.log` 제거

---

## 9) 디자인 철학
> **"감성보다 가독성, 장식보다 명확성"**
> **"50-60대 기관사가 야간 근무 중에도 한눈에 읽을 수 있어야 한다"**

- 가독성이 미학보다 우선
- 핵심 정보(교번, 시간, 교대자)는 **즉시 인지 가능**
- "와" 소리보다 "아, 바로 보인다"가 목표

---

## 10) 개발 워크플로우

### 10.1 UI 작업 시 dev 서버 직접 실행 (P0 — 절대 우선)
**UI 코드를 수정하면 무조건 다음 순서:**

1. **수정 직후** — 별도 작업 없이 곧바로 dev 서버를 띄운다.
   - 이미 떠있으면 그대로 사용, 안 떠있으면 `npm run dev -- -p 3004` 를 background로 실행
   - background 실행: `Bash`의 `run_in_background: true` 사용 — 빌드/응답 차단 X
2. **사용자에게 링크 전송** — `"http://localhost:3004 에서 확인해주세요"` 메시지
3. **그다음 질문** — `"맘에 들어? 푸쉬해도 될까요?"` 정확히 이 톤으로
4. **사용자가 "OK" / "푸쉬" / "배포" / "커밋" 명시 후에만** 커밋+푸시 실행

### 10.2 절대 금지 (P0)
- ❌ UI 수정 후 **사용자 확인 없이 곧바로 `git push`** — 어떤 경우에도 금지
- ❌ "빌드만 통과하면 배포" — UI는 빌드 통과 ≠ 사용자 검수 완료
- ❌ "Vercel에서 확인하세요" — 배포 후 확인 X, **localhost로 사전 확인**
- ❌ "배포할까요?"만 묻고 답 안 기다리고 푸쉬 — 반드시 명시적 OK 후

### 10.3 dev 서버 띄우는 정확한 명령
```bash
npm run dev -- -p 3004
```
- `run_in_background: true` 로 실행 → 로그는 BashOutput로 확인 가능
- 이미 떠있는 경우 알림: `"이미 localhost:3004 에 떠있어요"`

### 10.4 UI가 아닌 작업 (문서/스크립트/데이터/API)
- 빌드 통과 시 기존대로 자동 커밋+푸시 가능
- localhost 확인 불필요
- 예: schedules.ts·constants.ts·SQL·API route·README

### 10.5 판단 기준 — UI인가 아닌가
**UI**: 사용자가 화면에서 보고 누르고 읽는 모든 것
- `.tsx` 컴포넌트 (시각적 출력 있음)
- `.module.css` / `globals.css` 스타일
- 레이아웃·텍스트·아이콘·색상 변경

**UI 아님**: 사용자 화면에 직접 영향 X
- API route / 서버 로직
- store / 비즈니스 로직 (UI 컴포넌트 동작에 영향 없을 때)
- 데이터 파일 (스케줄·인원·상수)
- 마이그레이션·스크립트
