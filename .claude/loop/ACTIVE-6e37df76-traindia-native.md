# ACTIVE — train-dia 스토어 출시 + ZINOSB 자산 이식 (세션 6e37df76, 2026-08-18)

STATUS: IN PROGRESS

## 목표 (진호 발주)
1. train-dia 를 Play스토어/앱스토어에 올린다 (ZINOSB 경험 재사용).
2. ZINOSB 의 UI/UX/인터랙션/백로직 자산을 DIA 로 이식해 **모바일 최적화 레전드**로.
3. 폰 QA 는 마지막 (진호가 직접). 루프 모드 = 질문 없이 끝까지.

## 확정 사실 (실측 — 추측 아님)
- 앱: Capacitor 8 remote URL(`kr.dia5.app` → https://dia5.kr). API 40개 + standalone 이라 정적 export 불가.
- **폰 WebView 에 없는 것**(Z플립3/Android 15 CDP 실측 2026-08-18):
  `Notification` / `PushManager` / `PublicKeyCredential` / `navigator.share` = 전부 false.
  있는 것: serviceWorker(+controller), vibrate, geolocation, clipboard.
  safe-area top 32px / bottom 48px, 360x880 @dpr3, `display-mode` standalone=false·browser=false.
- 안드 액티비티가 **정지 상태면 네이티브 플러그인 호출이 무응답**(Promise 영구 pending → 이후 호출까지 큐 막힘).
  → useSegmentAlarm 이 visibility 가드로 미룸.
- Z플립3 는 USB(R3CR90MTPYT)와 무선(192.168.200.169)이 **같은 폰**. 실기기는 2대(Z플립3 + S25).
- S25 는 저장공간 734MB(100% 사용) 라 설치 거부됨 → 진호가 정리해야 함.
- webview-probe 는 포트 9333 사용 (9222 는 진호 PC 디버그 크롬이 점유 → 폰 대신 PC 를 측정한 사고).

## 완료 (커밋)
- `55aceb1` feat(native): 안드로이드 앱 + 알람 OS 예약 (103 files)
  - capacitor.config.ts, android/, assets/, native/www/(index+offline)
  - NativeBridge(스플래시 hide·하드웨어 뒤로가기·상태바·키보드), platform.ts
  - lib/alarmPlan.ts(순수 규칙) + 테스트 19건, lib/native/localAlarms.ts(OS 예약)
  - haptic 네이티브화, useNotification 어댑터
  - scripts: build-apk.mjs / gen-native-assets.mjs / webview-probe.mjs
- `1e92985` refactor(auth): 생체인증(WebAuthn) 완전 제거 (진호 결정)
  - 남긴 것: jwt TOKEN_MAX_AGE_DEFAULT(이름만 변경 — 세션 기본 만료라 지우면 정책 변경),
    visitStats 'login_webauthn'(과거 audit_log 집계 — 빼면 지난 통계 소급 감소)
  - DB webauthn_credentials/challenges 테이블은 **미삭제**(되돌릴 수 없어 진호 확인 대기)

## 미완 / 다음 행동
- [ ] DIA P0 위반 실측 → 수정 (button type 누락이 최다 후보, inline style 59)
- [ ] ai-rule-guard DIA 적응 이식 (ZINOSB scripts/ai-rule-guard.mjs 32.7KB 참조)
      중복 제외: hover/zlayer/safearea/text-size/surface-3d/theme-override/card-rhythm 는 DIA 에 이미 있음
- [ ] 네이티브에서 거짓말하는 UI 정직화: 설정의 "홈 화면 추가" 타일(앱 안에서 무의미), 알림 섹션
- [ ] navigator.share → @capacitor/share 어댑터
- [ ] duty 탭 헤더(.z-app-header 미적용 — ZINOSB_SYSTEM_PORT §9 미완)
- [ ] 폰 실증: 알람이 실제로 울리는지 (진호가 Z플립3 펴야 함) — 진호 QA 몫
- [ ] FCM 원격 푸시 — Firebase 프로젝트 필요(진호 계정)
- [ ] push 는 진호 승인 후 (UI 변경 포함)

## 함정 메모
- PowerShell heredoc 불가 → 커밋 메시지는 파일 + `git commit -F C:\tmp\<file>.txt`, **파이프 금지**
  (git-scope 훅이 `| Select-Object -Last` 의 `-Last` 속 'a' 를 `commit -a` 로 오탐)
- local.properties 를 PowerShell `-Encoding utf8` 로 쓰면 **BOM** 이 붙어 Gradle 이 sdk.dir 을 못 읽음
  → build-apk.mjs 가 BOM 없이 다시 쓴다
- Windows Node 20+ 는 `.bat` 직접 spawn 불가(EINVAL) → shell 경유
