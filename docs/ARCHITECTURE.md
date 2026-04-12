# Train-DIA 아키텍처 규칙
> 프로젝트 구조·API·보안·성능
> UI/UX 규칙은 [CLAUDE.md](../CLAUDE.md) 참조

---

### 1.6 보안 (P0)
- **보안 키(API 키, Supabase 키, 시크릿) 코드/로그 노출 절대 금지**
- 클라이언트 번들에 시크릿 포함 금지
- `console.log`로 키 값 출력 금지
- 민감정보(password, token, phone) 로그 마스킹

---

## 2) 프로젝트 구조

```
src/
├── app/           — page.tsx, layout.tsx, globals.css, api/
├── components/    — layout/(AppShell, TabBar, WorldHub), common/(Modal, Toast, AuthGate)
├── features/      — home, calendar, duty, compare, contacts, more,
│                    line5, alerts, commute, subway, edu, safety
├── hooks/         — useHistoryBack, useInstallPrompt, useServiceWorker,
│                    useNotification, useSwappedDia
├── stores/        — 14개 Zustand 스토어 (theme, fontSize, driver, alert,
│                    commute, compare, exchange, hazard, train, swap,
│                    memo, quiz, shortcuts, healingCard)
├── data/          — cycle, schedules, holidays, line5, contacts,
│                    station-abbr, tips (수정 금지!)
├── lib/           — schedule, types, constants, auth, supabase
└── styles/        — tokens.css (Night Shift 디자인 토큰 SSOT)
```

### Feature 모듈 패턴
- `features/{domain}/(components|hooks|styles|index.ts)` 기본 구조
- 각 feature는 자체 CSS Module 소유 (컴포넌트 격리)
- 공용 컴포넌트(Modal, Toast, TabBar) 중복 구현 금지

---

## 8) API/백엔드 규칙

### 8.1 API 라우트
- `/api/realtime/trains` — 5호선 열차 위치 (서울시 오픈API)
- `/api/realtime/arrivals` — 역별 도착 정보
- `/api/odsay/search-station` — ODsay 역 ID
- `/api/odsay/route-search` — 지하철 경로 검색
- `/api/alerts/*` — 장애 알림 CRUD
- `/api/safety/hazards/*` — 안전 보고 CRUD + 댓글/좋아요

### 8.2 에러 응답 표준
```json
{ "code": "TRAIN_NOT_FOUND", "message": "열차 정보를 찾을 수 없습니다.", "detail": {} }
```

### 8.3 API 핸들러 패턴
- 인증 필요 시 `requireActiveUser()` 또는 동등 검증
- 입력 검증: Zod `.safeParse()` 사용 (수동 if/else 금지)
- 에러: 표준 에러 응답 포맷으로 반환

---

### 14.2 코드/구조
- `style={{` 0개 (STYLE-EXCEPTION 제외)
- 토큰 미사용 매직 넘버 금지
- 공용 컴포넌트(Modal, Toast, TabBar) 중복 구현 금지
- `console.log` 커밋 전 제거

### 14.3 테스트/빌드
- `npm run build` 통과
- `npm run typecheck` 통과
- `npm run test` 통과
- import 미해결 상태 커밋 금지

### 14.4 보안
- 시크릿 노출 0
- API 키 하드코딩 0

---

## 19) 성능/메모리 규칙
- 이미지 미리보기 blob URL 사용 시 `URL.revokeObjectURL`로 누수 방지
- localStorage 저장은 debounce 표준으로 유지
- 성능 최적화는 "측정 후 적용" (React Profiler로 병목 확인)
- memo는 남발 금지 (병목 구간에만)

---

## 22) SW 버전 관리
- `public/sw.js`: 네트워크 우선 + 캐시 폴백 전략
- PWA 지원: `useServiceWorker` + `useInstallPrompt`
- 현재 기준일: `DB_STD = new Date(2026, 1, 1)` (2026-02-01)
