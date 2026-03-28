# Train-DIA 개발 규칙 (AI 필수 참조)
> 기관사 근무표 앱 — 50-60대 사용자 대상, 모바일 퍼스트, 다크 퍼스트
> 이 문서는 프로젝트의 기준선이며, 모든 AI 대화에서 자동으로 읽힌다.

---

## 0) 프로젝트 개요
- **기술**: Next.js 15 + React 19 + TypeScript + Zustand + CSS Modules
- **대상 사용자**: 50-60대 기관사 (답십리승무사업소, 서울 지하철 5호선)
- **배포**: Vercel (GitHub push 시 자동 배포)
- **GitHub**: jinholeeffddw33/train-dia
- **v1 보존**: `legacy/v1/` (Vanilla JS PWA, 복원 가능)
- **데이터**: 171일 주기 순환 근무표, 6개 스케줄 테이블

---

## 1) P0 절대 규칙

### 1.1 최소 폰트 13px
- **13px 미만 텍스트 절대 금지** (12px도 안 됨)
- 토큰 `--dia-text-xs` 최솟값 = 13px
- 하드코딩 시에도 13px이 하한선

### 1.2 데이터 파일 수정 금지
- `src/data/*` 파일은 **절대 수정하지 않음** (사용자 지시가 있어도)
- cycle.ts, schedules.ts, holidays.ts, line5.ts, contacts.ts, tips.ts
- 문제는 알고리즘으로 해결

### 1.3 모바일 무결성
- 360px에서 깨짐/겹침/가로스크롤 = P0 버그
- 터치 타겟 최소 44px x 44px
- 인접 버튼 간격 최소 8px

### 1.4 다크/라이트 동시 검증
- UI 변경 시 **다크 + 라이트 모두 확인 필수**
- 한쪽에서만 안 보이는 UI = P0 버그

### 1.5 색상은 반드시 토큰으로
- 모든 색상은 `src/styles/tokens.css`의 `--dia-*` 변수 사용
- 하드코딩 색상(`#fff`, `rgba(...)`) 사용 금지
- 예외: `@keyframes` 내부 애니메이션 전용 값

### 1.6 보안
- `.env.local` 키(API 키, Supabase 키) 코드/로그 노출 금지
- `console.log`로 키 값 출력 금지

---

## 2) 프로젝트 구조

```
src/
├── app/           — page.tsx, layout.tsx, globals.css, api/
├── components/    — layout/(AppShell, TabBar), common/(Modal, Toast)
├── features/      — home, calendar, compare, contacts, more, line5, alerts, commute, subway
├── hooks/         — useInstallPrompt, useServiceWorker
├── stores/        — driver, theme, alert, commute, memo, quiz, train, compare (Zustand)
├── data/          — cycle, schedules, holidays, line5, contacts, tips (수정 금지!)
├── lib/           — schedule, types, constants
└── styles/        — tokens.css (Night Shift 디자인)
```

---

## 3) 디자인: Night Shift (다크 퍼스트)
- `:root` = 다크 모드 (기본, 야간 근무 최적화)
- `:root.light` = 라이트 모드 오버라이드
- 배경 `#0F172A`, 카드 `#1E293B`, 블루 `#3B82F6`, 그린 `#22C55E`
- **50-60대 최적화**: 본문 16px, 핵심 숫자 24-32px, 터치 타겟 48px

### 대비 기준
| 텍스트 역할 | 다크 모드 | 라이트 모드 | 최소 대비 |
|-------------|-----------|-------------|-----------|
| Primary | `#F1F5F9` on `#0F172A` | `#0F172A` on `#F0F4F8` | 4.5:1 |
| Secondary | `#94A3B8` on `#0F172A` | `#475569` on `#F0F4F8` | 4.5:1 |
| Tertiary | `#64748B` on `#1E293B` | `#94A3B8` on `#FFFFFF` | 3.5:1 |

### 보더 토큰
| 토큰 | 용도 |
|------|------|
| `--dia-border` | 기본 보더 |
| `--dia-border-strong` | 강조 보더 |
| `--dia-border-light` | 미세 구분선 |
| `--dia-border-dim` | 최미세 구분선 |

---

## 4) API 라우트
- `/api/realtime/trains` — 5호선 열차 위치 (서울시 오픈API)
- `/api/realtime/arrivals` — 역별 도착 정보
- `/api/odsay/search-station` — ODsay 역 ID
- `/api/odsay/route-search` — 지하철 경로 검색

---

## 5) 교대자 규칙 (절대 변경 금지)

### 핵심 규칙
1. **1xxx 또는 2xxx 열차로 시작하는 구간** → 해당 쪽 교대자 없음
2. **1xxx 또는 2xxx 열차로 끝나는 구간** → 해당 쪽 교대자 없음
3. **교대는 항상 1:1** (한 명)
4. **교대 조건**: 같은 열차번호 + 같은 시간대
5. **UI 용어**: "인수/인계" 사용 금지 → **"교대"**로만 표기

### UI 배치 규칙
```
┌────────────────────────────────────┐
│  20:05    5691 / 5672       21:17  │
└────────────────────────────────────┘
교대 홍길동                   교대 이정우
 (왼쪽=받을 때)                (오른쪽=줄 때)
```
- **왼쪽**: 내가 열차를 **받을 때** — 지금 그 열차에 타고 있는 기관사
- **오른쪽**: 내가 열차를 **줄 때** — 나한테서 교대받는 기관사

### 교대 표시
| 상태 | 표시 |
|------|------|
| 교대 상대 있음 | `교대 ← 이름` 또는 `교대 → 이름` |
| 기지 입출고 (1xxx/2xxx) | 표시 안 함 |
| 매칭 실패 (5xxx인데 상대 없음) | `교대` (이름 없이) |

---

## 6) 열차번호 체계

### 방향
- **짝수 끝** = 상선(상행, 방화 방면)
- **홀수 끝** = 하선(하행, 마천/하남검단산 방면)

### 마천 vs 하남검단산 구분
- **5500대, 5600대, 5700대, 5800대** = 마천 방향
- **5000대, 5100대, 5200대, 5300대, 5400대** = 하남검단산 방향

### 특수 열차
- **5900대** = 회송열차 (승객 미취급)
- **1000대** = 기지(고덕기지) 입출고
- **2000대** = 하남검단산 쪽으로 입출고

---

## 7) 행로(m 필드) 읽는 법
- **경유하는 주요 역의 첫 글자**를 순서대로 나열
- 근무별 구분은 쉼표(,)로 나눔
- 예시: "답하방답,답마둔상기" = 1근무(답→하남→방화→답십리), 2근무(답→마천→둔촌동→상일동→기지)

### 역 약어
답=답십리, 방=방화, 화=화곡(방화 아님!), 마=마천, 상=상일동, 기=고덕기지, 하=하남검단산, 강=강동, 영=영등포구청, 둔=둔촌동, 미=미사

### 행로 읽기 규칙
- **같은 열차번호가 두 줄** → 연결 운행 (하나의 구간)
- **열차번호 없는 파란선** → 편승 (운전 아님, 행로 약어에 미포함)
- **선이 끊어져 있으면** → 별개 근무 (내려서 대기 후 새 근무 시작)
- **출발역이 항상 답십리가 아닐 수 있음** — 이전 근무 종착역에서 시작
- **평평/평휴/휴평/휴휴**는 같은 다이아라도 행로가 다를 수 있음

### 기지 경유 규칙
- 기지 입고 (하남→기지): "상기"
- 기지 입고 (마천→기지): "마둔상기"
- 기지 출고 (기지→마천): "기상강마"

### 행로 종착 규칙
- 각 근무는 "마"나 "하"로 끝나지 않는다
- 항상 "답", "기", "방", "영" 등으로 끝남

---

## 8) 데이터 구조
- 6개 스케줄 테이블: `S.p_ord` / `p_hol` / `p_ordord` / `p_ordhol` / `p_holord` / `p_holhol`
- 각 스케줄: `{s: 출근, e: 퇴근, m: 운전행로, g: [{d: 출발, a: 도착, n: [열차번호]}]}`
- w 필드: 운전행로 텍스트 (일부 스케줄)
- 기준일: `DB_STD = new Date(2026, 1, 1)` (2026-02-01)
- 171일 주기 순환

---

## 9) Excel 임포트 시스템

### 스크립트: `scripts/import-excel.js`
```bash
# 검증만
node scripts/import-excel.js validate "경로\월별근무순서별_YYYYMM_....xlsx"
# 적용 (cycle.ts.new 생성)
node scripts/import-excel.js apply "경로\월별근무순서별_YYYYMM_....xlsx"
```

### 행로표 교체 후 필수
```bash
node scripts/validate-schedules.js
```
m/w 필드 누락 검증 — 반드시 실행

### 특수값 매핑
| Excel 값 | 정규화 | 의미 |
|-----------|--------|------|
| `운휴NN` | `NN` | 운전 휴일 |
| `대휴NN` | `NN` | 대기 휴일 |
| `분할NN-2` | `NN` | 분할 근무 |
| `지정[주]` | null (스킵) | 지정 주간 근무, CYCLE 밖 |
| `0` | null (스킵) | 미배치 |

---

## 10) 스타일링 규칙
- **CSS Modules 기본** (인라인 스타일 금지)
- 모든 색상/간격은 `--dia-*` 토큰 사용
- 새 토큰 추가 시 다크/라이트 **양쪽 정의 필수**
- iOS Safari: `-webkit-backdrop-filter` 접두사 필수
- `env(safe-area-inset-*)` 4방향 적용

### 애니메이션 규칙
- 허용: `box-shadow` 펄스, `opacity` 전환, `transform: scale()`
- 금지: `filter: drop-shadow` 애니메이션, `width/height` 애니메이션, 3초 미만 루프
- `prefers-reduced-motion: reduce` 대응 필수

---

## 11) 협업 규칙
- **말투**: 자연스러운 한국어, 반말
- 확신 없으면 추측하지 말고 질문
- 구조적 변경(상태/API/DB)은 확인 후 진행
- push 전 `npm run build` 통과 확인

---

## 12) 참조 문서
| 문서 | 내용 |
|------|------|
| [docs/DESIGN_AUDIT.md](docs/DESIGN_AUDIT.md) | 다크/라이트 감사 규칙, 대비 기준, 크로스 브라우저 |
| [docs/PARTNER_MATCHING.md](docs/PARTNER_MATCHING.md) | 교대자 매칭 알고리즘 상세 |
