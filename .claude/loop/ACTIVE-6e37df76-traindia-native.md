# ACTIVE — train-dia 스토어 출시 + ZINOSB 자산 이식 (세션 6e37df76, 2026-08-18)

STATUS: 1라운드 완료 — push 대기(진호 승인 필요) · 폰 QA 대기

## 목표 (진호 발주)
1. train-dia 를 Play스토어/앱스토어에 올린다 (ZINOSB 경험 재사용).
2. ZINOSB 의 UI/UX/인터랙션/백로직 자산을 DIA 로 이식해 모바일 최적화를 끌어올린다.
3. 폰 QA 는 진호가 마지막에. 루프 모드 = 질문 없이 진행.

## 확정 사실 (CDP 실측 — 추측 아님)
- 앱: Capacitor 8 remote URL(`kr.dia5.app` → https://dia5.kr). API 40개 + standalone 이라 정적 export 불가.
- **폰 WebView 에 없는 것**(Z플립3/Android 15, 2026-08-18):
  `Notification` · `PushManager` · `PublicKeyCredential` · `navigator.share` = 전부 false.
  **`display-mode: standalone` 도 false** ← 설치 배너가 앱 안에서 뜨던 원인.
  있는 것: serviceWorker(+controller) · vibrate · geolocation · clipboard.
  safe-area top 32 / bottom 48, 360x880 @dpr3.
- **알람은 잠금/화면꺼짐/Doze 에서도 정상 발화한다** (2026-08-18 재실측으로 확정):
  `dumpsys alarm` 에 `type=RTC_WAKEUP tag=*walarm*:kr.dia5.app/...TimedNotificationPublisher`
  → OS 가 기기를 깨워서 울린다. logcat 발화 기록 + getPending 잔존까지 3중 확인.
  ⚠️ 처음에 "접힌 폰이라 예약이 안 된다"고 적었던 것은 **오진**이었다.
  포그라운드(topResumedActivity)여도 CDP 로 주입한 schedule 의 Promise 는 응답하지 않았고,
  그런데도 알림은 제 시각에 떴다 → 무응답은 **CDP 주입 시의 현상**이지 앱 코드 문제가 아니다.
  useSegmentAlarm 의 visibility 가드는 "복귀 시 날짜 변경 반영" 목적으로만 남긴다.
- Z플립3 USB(R3CR90MTPYT)와 무선(192.168.200.169)은 **같은 폰**. 실기기는 2대(Z플립3 + S25).
- S25 저장공간 734MB(100%) — 설치 거부됨. 진호가 정리해야 함.
- webview-probe 는 포트 **9333**(9222 는 진호 PC 디버그 크롬 점유 → 폰 대신 PC 를 측정한 사고).

## 커밋 (전부 로컬 — push 안 함)
- `55aceb1` feat(native): 안드로이드 앱 + 알람 OS 예약 (103 files)
- `1e92985` refactor(auth): 생체인증 완전 제거 (진호 결정)
- `569f993` fix(overlay): 스크롤 잠금 SSOT — 중첩 모달이 화면 얼리던 구조 제거 (20곳 전환)
- `4d6c30f` fix(alarm): 죽어 있던 근무 알람 복원 + press 촉감 통일 (66건)
- `2696c54` test(alarm): 근무표 전체 실데이터 역감사 (6건)

## 이번 라운드 핵심 발견
1. **근무 알람이 켤 방법 없이 죽어 있었다** — `4a3ea52` 홈 재구성에서 RouteTimeline 의 알람 UI 만 빠짐.
   엔진·store·CSS 는 살아 있어 selected 가 영원히 빈 배열. → 설정에 AlarmSettings 로 복원.
2. **모달 20곳이 각자 body 스크롤을 잠그고 있었다** — 중첩 시 배경 누수 → 영구 잠김 사고 구조.
   → lib/overlay/scrollLockManager SSOT + 회귀 테스트(옛 방식이 얼리는 것까지 재현).
3. **앱 안에서 "홈 화면 추가" 가 보였다** — display-mode:standalone=false 라 isInstalled 오판.
   → useInstallPrompt 한 곳 수정으로 소비처 전부 해결.
4. press scale 이 0.99~0.92 로 흩어져 누를 때마다 깊이가 달랐다 → 표준 3티어 통일(게임 제외).

## 내가 틀렸다가 잡은 것 (같은 실수 반복 방지)
- button type 누락 341건 → **실제 1건**(주석). 한 줄 정규식이 멀티라인 태그를 놓친 오탐.
- 첫 WebView 프로브가 **PC 크롬**에 붙어 WebAuthn/푸시가 true 로 나왔다 → 포트 변경 + 호스트 검증 가드.
- 가드 F5 가 정상 입력 11곳 오탐(border-color 로 포커스 표시하는 건 권장 방식) → 판정 보강.
- 역감사에서 "익일 출발이면 알람 날짜도 바뀔 것"으로 기대 → 틀림(익일 00:20 의 30분 전은 당일 23:50).

## 남은 일
- [ ] **push** — UI 변경 포함이라 진호 승인 대기. dia5.kr 은 실사용자(기관사) 프로덕션.
      push 해야 폰 앱(remote URL)에 새 UI 가 반영된다.
- [ ] 폰 QA(진호): 알람 실제 발화 · 설정 화면 · 중첩 모달 닫기 · press 촉감
      ※ Z플립3 를 펴야 네이티브 알람 예약이 응답한다
- [ ] inline style 36건(P0) — 대부분 동적값이라 STYLE-EXCEPTION 주석이 정답. 가드가 신규는 이미 막음
- [ ] useModalA11y 를 나머지 모달 18곳에 적용(현재는 공용 Modal 만)
- [ ] DB `webauthn_credentials` / `webauthn_challenges` 테이블 삭제 여부 — 진호 확인
- [ ] FCM 원격 푸시 — Firebase 프로젝트 필요(진호 계정)
- [ ] iOS 프로젝트 + TestFlight

## 함정 메모
- PowerShell heredoc 불가 → 커밋 메시지는 `git commit -F C:\tmp\<file>.txt`, **파이프 금지**
  (git-scope 훅이 `| Select-Object -Last` 의 `-Last` 속 'a' 를 `commit -a` 로 오탐 → add 까지 안 돌아감)
- PowerShell 인라인 JS 는 `${}` · 백슬래시 이스케이프가 깨진다 → 스크립트 파일로 쓸 것
- local.properties 를 PS `-Encoding utf8` 로 쓰면 BOM → Gradle 이 sdk.dir 을 못 읽음(build-apk.mjs 가 방어)
- Windows Node 20+ 는 `.bat` 직접 spawn 불가(EINVAL) → shell 경유
