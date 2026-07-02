# Train-DIA 대규모 개편 감사 — 종합 보고서 (2026-07-02)

> 10차원 병렬 감사: ①토큰/다크라이트 ②여백/타이포 ③키보드/폼 ④PWA/크로스플랫폼 ⑤애니메이션 ⑥일관성/UX ⑦성능/번들 ⑧접근성/글자확대 ⑨오프라인 ⑩세계급 PWA 벤치마크.
> read-only 감사 — 코드 수정 0건. 상세 근거는 각 항목의 파일:라인 참조.
> 여러 감사가 독립적으로 같은 결론에 도달한 항목은 (교차) 표시 — 신뢰도 최상.

---

## 총평

**골격은 상위권, 개별 구현이 골격을 배신하는 앱.**
토큰 시스템·다크퍼스트·safe-area·100vh 폴백·Modal SSOT·전역 reduce-motion·line5의 갱신 UX·설치 안내는 이미 업계 표준을 상회한다. 그런데:

1. **오프라인이 핵심 유스케이스인데(터널 속 기관사) 오프라인에서 근무표가 잠긴다** — 앱 최대 결함
2. **정성껏 만든 시스템들이 자기 발에 걸려 죽어있다** — press 3티어(전역 셀렉터에 패배), SW 업데이트 게이트(skipWaiting에 무력화), 글자크기 설정(px 201곳이 우회), 공용 Toast(1곳만 사용)
3. **가장 중요한 정보가 가장 작다** — 달력 출근시각 10px, 노선도 역명 실효 4.4px, 교환 신청 버튼 32px

---

## 🔴 P0 — 즉시 수술 (사고·깨짐·기능 무력화)

### P0-1. 오프라인 세션 상실 — "터널 안 기관사가 근무표에서 잠긴다" (⑨)
`src/stores/auth.ts:238-250,292-295` + `AuthGate.tsx:47-83`
- 비행기 모드 콜드 스타트 → checkSession()의 `/api/auth/me` fetch throw → `catch { user: null }` → 365일 유효 쿠키가 있어도 로그인 화면. 로그인 3경로 전부 네트워크 필수라 탈출 불가.
- 근무표 데이터는 정적 번들이라 게이트만 통과하면 오프라인 완전 동작 — 게이트가 유일한 장벽.
- **수정**: user를 persist에 포함 + 네트워크 실패(throw)와 401(무효)을 구분 — 네트워크 실패면 기존 user 유지(그레이스), 온라인 복귀 시 재검증.

### P0-2. SW 파이프라인 3중 결함 (④⑨ 교차 + 직접 검증 확정)
`public/sw.js:3-25,42-65` + `useServiceWorker.ts` + `AppShell.tsx:25`
- **(a) sw.js:14 무조건 `skipWaiting()` + clients.claim + controllerchange→즉시 reload** = 배포 순간 사용 중 화면 강제 리로드(폼 입력 증발). 훅의 6h stale 게이트·업데이트 토스트는 waiting이 생길 틈이 없어 죽은 코드 (직접 검증 완료).
- **(b) 프리캐시 없음 + 버전 bump 시 옛 캐시 전량 삭제** → 새 SW 직후 오프라인 진입 = HTML만 있고 청크 없음 = 무한 스피너.
- **(c) SW 등록이 로그인 후+근무월드 진입 시에만**(AppShell) → 미진입 사용자는 오프라인 능력 0.
- **수정**: install-시 skipWaiting 제거(게이트 부활) + 루트 layout 등록 + Serwist(@serwist/next) 이관으로 빌드 프리캐시(⑩ 권고와 합치. push 핸들러 공존 가능).

### P0-3. 전역 button:active가 press 3티어 시스템 전체를 무력화 (⑤)
`globals.css:91-93` — `button:active { translateY(1px) scale(0.97) }` 특이도(0,2,1)가 모든 모듈 `.xxx:active`(0,2,0)을 이김. 3티어 유틸(.diaPressBtn 등)조차 버튼에서 패배. 값 0.97 자체도 금지값.
- **수정**: `:where(button):active`로 특이도 0 강등. **이거 먼저 해야 비표준 scale ~40곳 정리가 의미 있음.**

### P0-4. 앱 전체가 단일 클라이언트 번들 (⑦)
`src/app/page.tsx:16-24` — Calendar/Duty/Line5/Edu/Safety/Life/Standby/More 전부 정적 import. edu 소스 485KB 등이 첫 화면에 통째로. 저사양 폰 파싱 직격.
- **수정**: world 단위 `next/dynamic` (life 내부 게임 11종의 기존 lazy 패턴을 world 레벨로). + EduHome.tsx의 train-background.json **165KB 정적 import**(⑤⑦ 교차)를 fetch로.

### P0-5. iOS 입력 자동 줌 — 한 줄 수정 (③)
`--dia-text-sm` 인풋(390px폰 ~14px) 12개 클래스 + RegulationViewer 15px 하드코딩 → iOS 포커스마다 강제 줌. 댓글·안전공지·문서검색 = 매일 경로.
- **수정**: `globals.css`에 `input, textarea, select { font-size: max(16px, 1em); }` 한 줄 (font-small 모드 15px 문제까지 커버).

### P0-6. 팬텀 토큰 — 지금 눈에 보이는 결함 (①)
- `Duty.module.css` + `lib/schedule.ts:178` — `--dia-orange` 미정의 → **"대기" 배지가 투명 렌더 중**
- `Compare.module.css:38` — `--dia-text-on-color` 미정의 → 라이트 배지 글자 2.5:1
- `More.module.css:850` — `--dia-space-7` 미정의 → 피드백 textarea 하단 패딩 소실

### P0-7. 라이트 모드 텍스트 대비 붕괴 (①⑧ 교차)
`tokens.css` — tertiary #94A3B8 = **2.3:1 ×339곳** / amber 텍스트 **1.9:1 ×84곳**(비번 교번·기지출근 시각!) / sky 1.9:1 / raw green 2.1:1 ×55곳.
- **수정**: 토큰 2-3줄 (tertiary→#64748B급, `--dia-amber-text` 신설=green-text 패턴, sky→#0284C7). 수백 곳 일괄 해결.

### P0-8. 핵심 업무 정보가 앱 최소 글자 (②⑧ 교차)
- `Calendar.module.css:139` 출근시각 **10px** + `:203` 기지출근 "기" 마커 **9px** — 매일 보는 안전 정보, "크게" 설정해도 안 커짐. 기지출근 착각 = 실무 사고.
- `RouteMap.tsx:264-348` — SVG fontSize 7~12 × 실효 스케일 0.625 = 역명 **실제 4.4~7.5px** 판독 불가.
- 13px 미만 총 16건 + SVG 6개소 (상세: 감사② 원문).

### P0-9. 터치 타겟 오조작 위험 10건 (②)
`WorldHub.module.css:898` 허브 대기충당 진입 버튼 **28px** / `Compare:115` 삭제 X **20×20** / `More:184` 토글 히트영역 / Hazard 반응버튼 28px+gap6 이중위반 등.

### P0-10. 네이티브 alert()/confirm() 11곳 (⑥)
MoreTab(로그아웃·PIN), ShortcutsOverlay ×4, HazardDetail ×3(삭제), TodayFortune, ZenBonsai — OS 다이얼로그(작은 글씨·테마 무시). → 공용 Modal 확인시트 + showToast.

### P0-11. 모달 접근성 — 포커스 트랩 전멸 + role 없는 모달 4곳 (⑧)
VideoRegisterModal만 만점. **SSOT `common/Modal.tsx`에 트랩+포커스 복원 이식 → 사용처 절반 일괄 해결.** role="dialog" 자체가 없는 곳: EduHome:217, ExchangeRequest:632, ShortcutsOverlay:89, more 전체화면 오버레이 5종.

### P0-12. 검색 인풋 5곳 포커스 링 사망 (⑧)
Subway:37, RegulationViewer:86, edu:2814, Life:774, Hazard:1018 — base `outline:none`이 전역 링 무효화, 대체 없음.

### P0-13. 조용한 실패 2건 (③⑥⑨ 교차)
- `HazardDetail.tsx:172-177,886-891` — 댓글 Enter 경로 submitting 미체크 → **중복 전송**.
- `StandbyCoverageView.tsx:49-50` — fetch 실패를 "기록이 없어요" 빈 상태로 위장 (업무 문서).

---

## 🟠 P1 — 체감 큰 개선 (묶음별)

### A. 오프라인 완전체 (⑨⑩)
- `navigator.onLine`/online·offline 사용 **전체 0건** → useOnlineStatus 훅 + 전역 배너 "오프라인 — HH:MM 기준 정보를 보여드려요"
- online 이벤트 → line5/arrivals/alerts 즉시 재시도 (터널→지상 복귀 시 30초 에러 잔존 해소)
- Line5Tab의 "마지막 데이터+N분 전 갱신" 패턴을 alerts/standby/safety로 전파

### B. PWA 몸단장 (④)
- SW 업데이트 배너 safe-area-top 누락 → iOS 노치에 [업데이트] 버튼 깔림 (AppShell.module.css:25)
- iOS 스플래시 0장 → 다크 앱인데 매 실행 흰 플래시 / favicon.ico 404
- 푸시 아이콘: sw.js `/favicon.svg`(Android 미렌더) + useNotification `/icon-192.png` 404 → 실물 PNG로
- iPad UA 판정 실패 → 설치 경로 전멸 (maxTouchPoints 보강)
- root `color-scheme` 미선언 → 삼성인터넷 강제 다크 무방비
- iOS 미설치 시 푸시 메뉴 통째 증발(MoreTab:369) → "홈 화면에 추가하면 알림 받아요" 유도로
- SW 캐시 무제한 성장(audio/pdfjs 누적) → LRU 상한

### C. 홈·허브 (⑤⑥⑦ 교차)
- WorldHub 상시 애니 11개(left 애니 shimmer 포함 — transform 치환) + 재방문마다 0.9s entry + 인위적 120ms 지연 → 다이어트
- HubHero에 교대자 1줄 추가 (핵심 3정보 중 교대자만 2뎁스 — RouteTimeline 파트너 로직 재사용)
- `getDaysUntilRest()` 구현돼 있으나 미사용 → "다음 휴무 D-day" 표시
- useClock 1초 tick → HubHero+TodayCard 매초 재렌더 (분 단위로, 1/60)
- 진입 모달 5종 스택(page.tsx:88-92) → 세션당 1개 + 만료 청소
- HubTodaySummary 라벨/값 px 하드코딩 — 첫 화면인데 글자 확대 안 먹음

### D. 글자확대·타이포 (②⑧ 교차)
- raw px font-size **201곳(전체 16%)** — "크게" 설정 시 5/6만 커지는 앱 → px→토큰 코드모드 (게시글 본문·퀴즈 선택지·캘린더 날짜 포함)
- 규정 뷰어 자체 글자 컨트롤이 전역 설정 미연동 → 열 때마다 리셋
- 글자 옵션 '특대' 단계 추가 (⑩ 시니어 리서치 — 가장 값싼 개선)

### E. 터치·press·키보드 (②③⑤)
- Exchange 액션군 전부 32px+gap6 (교환 신청/수락/거절 = 핵심 업무) → 44px
- Exchange/More CTA가 opacity 단독 press (가장 중요한 버튼이 가장 빈약한 피드백) → 표준 티어
- 백버튼 36 vs 40 혼재 → 공통 44px 컴포넌트
- 사번 `type="number"` → text+inputMode numeric (MultiLobby 모범 패턴)
- viewport `interactiveWidget` 미설정 → 채팅/댓글 sticky 입력바 키보드 뒤 깔림 (+ 키보드 시 TabBar 숨김 세트)
- SwapBottomSheet 하단 앵커+즉시 focus → iOS 키보드가 시트/CTA 가림
- 지하철 검색 Enter 무반응 + 전 프로젝트 enterKeyHint 0곳
- 이름 truncate 2곳: dutyNameCell(홈 가로 넘침 실위험), Exchange postRequester/Target

### F. 일관성 수렴 (⑥⑧)
- 모달 5종 → 공용 Modal.tsx 수렴 (특히 X만 있는 more fullOverlay, 배경탭 없는 standby)
- 로딩 4종·빈 상태 제각각 → safety 패턴(이모지+문구+힌트)을 공용 EmptyState/LoadingDots로
- showToast 1곳만 사용 → safety 등록·standby·즐겨찾기·설정 변경에 성공 피드백
- "설정" 탭에 도구 8종 숨음 → "더보기" 개명 + 비상 연락처 3뎁스 탈출(원탭)
- "로딩 중..." 7곳 → "불러오고 있어요" / 해요체 톤 통일 / ESC 누락 모달 일괄
- 주간/야간 교번 파랑vs보라 색상뿐 → 달 아이콘 등 비색상 마커
- 팬텀 토큰 fallback 연명 8곳(accent-*) + RouteMap SVG 하드코딩 색(라이트에서 다크색 잔존) → var() 치환

### G. 성능 (⑦)
- Line5Tab 1초 카운터 → 탭 전체 매초 재렌더 (leaf 분리 + RouteMap/TrainList memo)
- StationArrivals 폴링 visibility 가드 없음 (화면 꺼도 fetch)
- 셔틀 1.4MB·미션카드 8.7MB `<img>` 원본 → next/image
- ZenBonsai framer-motion reduce-motion 미대응 → MotionConfig 한 줄

---

## 🟡 P2 — 다듬기 (대표)

- 비표준 press scale ~40곳 일괄 치환(P0-3 선행 후) / progress bar width 애니 9곳 → scaleX / 토스트 exit 애니 / 탭 콘텐츠 120-150ms 페이드
- reduce-motion 킬스위치가 스피너까지 정지 → 예외 / 3초 미만 장식 펄스 다수
- manifest id/scope/portrait/다크 고정 / 85vh→dvh / date input color-scheme / PIN autocomplete 정책
- 하드코딩 색상 1,976곳/50파일(edu 562 최악) → 로컬 토큰 블록 단계 수렴 / 죽은 토큰 24종
- 죽은 코드: subway-search 빈 폴더, QuickActions, LottieIcon+lottie json 3개, Life commentInput, hero-banner.png 1.4MB, xlsx/docx→devDeps
- TabBar tablist 키보드 계약 → nav+aria-current / disabled opacity 0.5 하한
- <form> 0개 / 에러 시 포커스 이동·aria-live / autoFocus 플랫폼 불일치
- 홀수픽셀 스페이싱 19곳 / 여백 리듬(edu 카드 패딩 4종, commute·subway만 20px, quizCard 불일치)

---

## 🚀 신기능 도입 TOP7 (⑩ — 2026 지원 확인 완료)

| # | 기능 | 지원 | 난이도 | 효과 |
|---|------|------|--------|------|
| 1 | **Screen Wake Lock** — 행로 화면 "계속 켜기" 토글 | iOS 18.4+/And | S | 승무 중 폰 안 만져도 행로 유지 |
| 2 | **오프라인 신뢰 배너** — "HH:MM 기준 정보" | 전부 | S | 터널에서 오프라인이 기능이 됨 |
| 3 | **App Badging** — 미확인 알림 수 (푸시 페이로드로 갱신) | iOS 16.4+/And | S | 홈화면에서 확인거리 인지 |
| 4 | **설치 유도 재설계** — 성공순간 타이밍 + "설정이 안 지워져요" 리프레이밍(설치 웹앱은 7일 ITP 면제) + storage.persist() | 전부 | S | 설치율↑ = iOS 삭제 리스크 소멸 |
| 5 | **View Transitions** 탭 전환 | iOS 18+/And | S | 네이티브급 전환감, 미지원 무해 |
| 6 | **manifest 보강** — shortcuts("오늘 근무")·screenshots·Web Share(근무 카톡 공유) | shortcuts And만 | S | 원탭 진입 + 교대자 공유 |
| 7 | **Serwist 프리캐시 이관** (P0-2와 한 몸) | 전부 | M | 배포 직후에도 오프라인 완전성 |

탈락(확인됨): Notification Triggers(개발 중단), PWA Widgets(Win11 Edge 전용), Periodic BG Sync(보류), Declarative Web Push(관망).

---

## 실행 로드맵 (라운드 제안)

| R | 테마 | 내용 | 규모 |
|---|------|------|------|
| **R1** | 🛟 생존 — 오프라인·SW | P0-1 세션 그레이스, P0-2 SW 재설계(Serwist+루트 등록+skipWaiting 제거), 오프라인 배너+online 재시도 | 1-2일 |
| **R2** | 👁 가독 — 50-60대 직격 | P0-6 팬텀 토큰, P0-7 라이트 대비 토큰, P0-8 10px/SVG 글자, '특대' 옵션, px→토큰 코드모드 | 1-2일 |
| **R3** | 👆 손끝 — 터치·키보드·press | P0-3 :where 강등, P0-5 입력 16px, P0-9 터치 타겟, Exchange 44px+press, 사번 type, interactiveWidget | 1일 |
| **R4** | 🧩 일관성 — 모달·상태·문구 | P0-10 alert/confirm, P0-11 Modal 트랩 이식+5종 수렴, P0-13 조용한 실패, EmptyState/토스트 전파, 문구 통일 | 1-2일 |
| **R5** | ⚡ 성능 | P0-4 world 스플리팅+lottie 탈출, 재렌더 격리(Line5/useClock), 이미지 최적화 | 1일 |
| **R6** | 🚀 세계급 PWA | Wake Lock, Badging, 스플래시, manifest 보강, View Transitions, 설치 유도 재설계 | 1-2일 |
| 가드 | 재발 방지 | font-size raw px + min-height<44 가드 스크립트 신설 (기존 check-card-rhythm 확장) | 0.5일 |

각 라운드는 독립 커밋 가능. UI 라운드(R2-R4,R6)는 룰대로 localhost 확인 → 진호 OK 후 푸시.
