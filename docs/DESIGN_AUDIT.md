# Train DIA 디자인 감사 규칙

> 다크/라이트 모드 동시 지원 + 크로스 브라우저 호환 기준
> 최종 수정: 2026-02-28

---

## 1. 다크/라이트 모드 규칙

### 1.1 [P0] 색상은 반드시 토큰으로
- 모든 색상은 `tokens.css`의 `--dia-*` 변수 사용
- 하드코딩 색상(`#fff`, `rgba(...)`) 사용 금지
- 예외: `@keyframes` 내부 glow 등 애니메이션 전용 값 (토큰 불가 시)

### 1.2 [P0] 양쪽 모드 동시 검증
- UI 변경 시 **다크 + 라이트 모두 확인 필수**
- 한쪽에서만 안 보이는 UI = P0 버그
- 특히 주의: 보조 텍스트(`--dia-text-secondary`)가 다크에서 너무 어두울 수 있음

### 1.3 대비 기준
| 텍스트 역할 | 다크 모드 | 라이트 모드 | 최소 대비 |
|-------------|-----------|-------------|-----------|
| Primary | `#F1F5F9` on `#0F172A` | `#0F172A` on `#F0F4F8` | 4.5:1 |
| Secondary | `#94A3B8` on `#0F172A` | `#475569` on `#F0F4F8` | 4.5:1 |
| Tertiary | `#64748B` on `#1E293B` | `#94A3B8` on `#FFFFFF` | 3.5:1 |

### 1.4 토큰 체계 (SSOT)
- `:root` = 다크 모드 (기본, 야간 근무 최적화)
- `:root.light` = 라이트 모드 오버라이드
- 새 토큰 추가 시 **양쪽 모두 정의 필수**

---

## 2. 보더/구분선 토큰

| 토큰 | 다크 | 라이트 | 용도 |
|------|------|--------|------|
| `--dia-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | 기본 보더 |
| `--dia-border-strong` | `rgba(255,255,255,0.15)` | `rgba(0,0,0,0.15)` | 강조 보더 |
| `--dia-border-light` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.04)` | 미세 구분선 |
| `--dia-border-dim` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.03)` | 최미세 구분선 |

---

## 3. 크로스 브라우저 호환

### 3.1 지원 브라우저
- Chrome (Android) — 주력
- Safari (iOS) — P0 필수
- Samsung Internet — 권장
- Firefox — 권장

### 3.2 [P0] iOS Safari 주의사항
- `env(safe-area-inset-*)` 4방향 적용
- `position: fixed` + `bottom: 0` → safe-area 패딩 필수
- `-webkit-backdrop-filter` 접두사 필수 (backdrop-filter 사용 시)
- `overflow: hidden` on body → iOS 바운스 이슈 주의

### 3.3 [P0] 터치 타겟
- 모든 탭/선택 가능 요소 **최소 44px × 44px**
- 인접 버튼 간격 **최소 8px**

---

## 4. 앰비언트 애니메이션 규칙

### 4.1 허용
- `box-shadow` 펄스 (글로우 애니메이션)
- `opacity` 전환
- `transform: scale()` 마이크로 인터랙션

### 4.2 금지
- `filter: drop-shadow` 애니메이션 (성능 이슈)
- `width`/`height` 애니메이션 (레이아웃 트리거)
- 3초 미만 루프 (산만함)

### 4.3 `prefers-reduced-motion` 대응
```css
@media (prefers-reduced-motion: reduce) {
  .animated { animation: none; }
}
```

---

## 5. 감사 체크리스트 (PR 전 필수)

- [ ] 모든 색상이 `--dia-*` 토큰 사용
- [ ] 다크 모드에서 텍스트 가독성 확인
- [ ] 라이트 모드에서 텍스트 가독성 확인
- [ ] 새 토큰 추가 시 양쪽 모드 정의
- [ ] 360px 모바일 뷰 깨짐 0
- [ ] 터치 타겟 44px 이상
- [ ] iOS Safari에서 레이아웃 확인

---

## 6. 버그 이력

| 날짜 | 증상 | 원인 | 수정 |
|------|------|------|------|
| 2026-02-28 | 다크모드에서 "근무일" 라벨 안 보임 | `--dia-text-secondary`가 monthItemTotal에서 대비 부족 | `--dia-text-primary` + `font-weight: bold`로 변경 |
| 2026-02-28 | `--dia-border-dim` 토큰 누락 | 라이트/다크 양쪽 미정의 | 양쪽 모드에 토큰 추가 |
