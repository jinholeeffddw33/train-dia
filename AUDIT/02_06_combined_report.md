# Stage 2-6: 통합 개선 보고서

## Stage 2: UX 감사 (기관사 관점)

### 발견 및 개선 사항

| # | 항목 | 심각도 | 개선 내용 | 상태 |
|---|------|--------|-----------|------|
| 1 | 홈 기관사 이름 커서 스타일 | P2 | `style="cursor:pointer"` → `.home-name-link` CSS 클래스 | ✅ |
| 2 | 비번 표시 색상 인라인 | P2 | `style="color:var(--green)"` → `.sc-val-rest` 클래스 | ✅ |
| 3 | 스케줄 상세 교번색 인라인 | P1 | `style="color:${gColor(tp)}"` → `.sd-dia.day/.night/.rest/.standby` | ✅ |
| 4 | 비교 페이지 인라인 다수 | P1 | 카드 border, 이름 색상, 교번 색상, 비번 텍스트 모두 CSS 클래스화 | ✅ |
| 5 | SOP 섹션 라벨 패딩 인라인 | P2 | `style="padding:..."` → `.sop-section-label` 클래스 | ✅ |
| 6 | 퀴즈 완료/면책 인라인 | P2 | 3개 인라인 스타일 → `.quiz-done-sub`, `.quiz-reset-btn`, `.quiz-disclaimer` | ✅ |

**총 인라인 스타일 제거: 18개 → 0개** (STYLE-EXCEPTION 해당 없는 순수 프레젠테이션)

---

## Stage 3: 모바일/브라우저 호환성

### 발견 및 개선 사항

| # | 항목 | 심각도 | 개선 내용 | 상태 |
|---|------|--------|-----------|------|
| 1 | **viewport 확대 차단** | **P0** | `user-scalable=no, maximum-scale=1.0` → `user-scalable=yes` | ✅ |
| 2 | 캘린더 셀 hover 피드백 없음 | P2 | `.cal-c:not(.other):not(.today):hover` 배경색 추가 | ✅ |
| 3 | 주간 스트립 스크롤 스냅 | P2 | `scroll-snap-type: x mandatory` + `scroll-snap-align: center` | ✅ |

**P0 수정**: viewport `user-scalable=no`는 WCAG 2.1 접근성 가이드라인 위반이었음. 확대 허용으로 변경.

---

## Stage 4: UI 폴리시 + 애니메이션

### 추가된 애니메이션

| # | 대상 | 효과 | 비고 |
|---|------|------|------|
| 1 | 페이지 전환 | fadeIn Y오프셋 6px → 8px 증가 | 더 자연스러운 진입감 |
| 2 | 운전행로 바 | `rvBarFlow` — 빛 흐름 애니메이션 (2s 무한) | 상행 ←, 하행 → 방향 표시 |
| 3 | 노선 트랙 하이라이트 | `.tk-row.highlight` 트랙에 파란 글로우 | 현재 열차 위치 강조 |
| 4 | 시간 히어로 영역 | `cardFadeIn` 지연 진입 (.1s, .2s) | 정보 계층 순서대로 |
| 5 | 알림 팝업 | `alertSlideDown` 0.5s 스프링 바운스 | 주의 끌기 |
| 6 | 상태카드 | `:active` scale(0.97) + 그림자 축소 | 터치 피드백 |

### 스타일 개선

| # | 대상 | 변경 |
|---|------|------|
| 1 | SOP 카드 | `border-left: 3px solid var(--orange)` 추가 — 시각적 구분 |
| 2 | `.ha-more` | `:active` 피드백 추가 (opacity .7) |
| 3 | 다크모드 알림카드 | 심각도별 border-left 색상 (high=빨강, medium=주황, low=회색) |

---

## Stage 5: 기능 추가

### 2026년 공휴일 데이터 보완

**data.js HOL["2026"]에 누락된 대체공휴일 2건 추가:**
- `2026/03/02` — 삼일절 대체휴일 (3/1 일요일 → 3/2 월요일)
- `2026/05/25` — 석가탄신일 대체휴일 (5/24 일요일 → 5/25 월요일)

**기존**: 15개 → **수정 후**: 17개 공휴일

---

## Stage 6: 코드/성능/안정성

### 코드 품질

| 항목 | Before | After | 비고 |
|------|--------|-------|------|
| 인라인 스타일 (app.js) | 18개 | 0개 | 모두 CSS 클래스로 이동 |
| CSS 클래스 미정의 | - | 0개 | 모든 참조 클래스 style.css에 추가 |
| SW 캐시 버전 | dia-v43 | dia-v44 | 전체 변경 반영 |

### 성능

- 인라인 스타일 제거로 브라우저 스타일 재계산 최적화
- CSS 애니메이션은 모두 `transform`/`opacity` 기반 → GPU 가속
- `rvBarFlow` 애니메이션: `pointer-events: none`으로 터치 간섭 방지

### JS 구문 검증
```
app.js  — node -c ✅
data.js — node -c ✅
sw.js   — node -c ✅
```

---

## 변경 파일 요약

| 파일 | 변경 | 줄 수 |
|------|------|-------|
| app.js | 인라인 스타일 18개 → CSS 클래스 교체 | +20 / -20 |
| data.js | 2026 대체공휴일 2건 추가 | +1 / -1 |
| index.html | viewport 확대 허용 | +1 / -1 |
| style.css | CSS 클래스 22개 추가 + 애니메이션 6개 | +85 / -5 |
| sw.js | 캐시 v43 → v44 | +1 / -1 |
