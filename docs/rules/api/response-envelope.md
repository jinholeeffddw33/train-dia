# train-dia API 룰 (ZINOSB 적응 이식 2026-08-09)

> SSOT 코드: [`src/lib/api/response.ts`](../../../src/lib/api/response.ts)
> 가드: `npm run check:envelope` · 현황 `check:envelope:report` · 부채 갚은 뒤 `check:envelope:update`

---

## API-ENVELOPE-001 — 응답은 봉투 SSOT 경유

API 라우트에서 raw `NextResponse.json(...)` 직접 호출 금지. `src/lib/api/response.ts` 의 헬퍼를 쓴다.

| 헬퍼 | 용도 | 응답 모양 |
|---|---|---|
| `errorResponse(code, message, status?, extra?)` | 모든 에러 | `{ code, message, ...extra }` |
| `okJson(data?, init?)` | 성공 | `data` 그대로 · 없으면 `{ ok: true }` |
| `internalError(err, where, userMessage?)` | 서버 예외 | `{ code:'INTERNAL', message }` + 서버 로그에만 상세 |
| `parseBody(req, schema)` / `parseQuery(url, schema)` | zod 검증 | 실패 시 `400 { code:'BAD_REQUEST', message }` |

### 새 모양을 발명하지 않았다

실측(2026-08-09, API 39개 / raw 340건): **에러는 이미 `{ code:'UPPER_SNAKE', message:'한국어' }` 로 123건이 통일**돼 있었다. 성공만 `{success:true}` 16건 / `{ok:true}` 11건 / 생 데이터로 갈렸다.

그래서 `errorResponse` 는 기존 123건과 **바이트 단위로 같은 모양**을 낸다. 기존 라우트를 헬퍼로 바꿔도 응답 JSON 이 1글자도 안 바뀐다 = 프론트 소비처가 안 깨진다.

**성공 응답의 모양은 바꾸지 않는다.** 봉투를 씌우는 순간 그 API 를 읽는 화면이 조용히 빈다. `okJson` 은 얇은 통과 래퍼이고, 통일의 가치는 "새 모양"이 아니라 **에러 코드·로깅·검증의 단일 경로**에 있다.

### baseline 래칫 (일괄 변환 금지)

기존 raw 323건은 [`docs/ops/api-envelope-baseline.json`](../../ops/api-envelope-baseline.json) 에 등록돼 있다.

- **신규 유입만 FAIL** — 파일별 잔량이 늘거나, baseline 에 없는 새 라우트가 raw 를 쓰면 차단
- **stale 도 FAIL** — 부채를 갚았는데 baseline 을 안 낮추면 "등록만 해두면 영원히 통과"하는 구멍이 생긴다. `npm run check:envelope:update` 로 낮출 것
- **전환은 한 커밋 = 한 API + 그 소비처 전부.** API 만 바꾸고 소비처를 놓치면 그 화면이 조용히 빈다
- **소비처가 1곳뿐인 API 부터** 시작해 패턴을 굳힌다

### 전환 시 함께 고치는 것

1호 전환(`/api/edu/level-records`)에서 실제 결함 3건이 함께 잡혔다 — 전환할 때 같이 볼 것:

1. **DB 에러 원문 유출** — `NextResponse.json({ code:'DB_ERROR', message: error.message })` 는 Supabase 에러에 담긴 테이블/컬럼명·제약조건을 클라이언트로 흘린다. → `internalError()` 로 마스킹, 상세는 서버 로그로만.
2. **`await req.json()` 무방비** — try/catch 가 없으면 잘못된 JSON 에 500 스택이 그대로 노출된다. → `parseBody()`.
3. **수동 필드 검증** — `if (!a || !b || c == null)` 는 타입도 안 보고 메시지도 뭉뚱그린다. → zod 스키마.

---

## API-ZOD-001 — 요청 검증은 zod 스키마로

`req.json()` 결과를 손으로 검사하지 않는다. `parseBody(req, Schema)` / `parseQuery(url, Schema)` 를 쓴다.

- 실패 메시지는 **어떤 필드인지**를 사람 말로 알려준다 (`"levelName을(를) 확인해주세요"`).
- 필드 목록 전체나 zod 원문 이슈를 그대로 흘리지 않는다 — 첫 문제만 사람 말로.
- 이 룰은 `check:envelope` 와 같은 baseline 을 공유한다(전환된 라우트에서만 강제).
