# train-dia 저장(퍼시스턴스) 룰 (2026-08-09)

> 회귀 테스트: `src/stores/__tests__/persistence-contract.test.ts` (`npm test`)

---

## STORE-PERSIST-001 — 저장 키와 버전은 계약이다

train-dia 는 기관사 175명의 **교번·메모·바로가기·퀴즈 진도·설정**을 `localStorage` 에 들고 있다. 대부분 **서버 백업이 없다**. 그래서 아래 둘은 곧바로 **전 사용자 데이터 유실**이다. 화면은 멀쩡히 뜨고 에러도 안 나서 배포 후에야 안다.

### 1. persist 키 이름을 바꾸면 안 된다

`name: 'diaMemos'` 를 `'dia-memos'` 로 "정리"하는 순간 기존 저장분을 못 찾는다. 사용자에겐 **"메모가 다 없어졌다"** 로 보인다.

키 이름이 제각각인 건 안다(`dp`, `diaMemos`, `officeDash`, `traindia-auth`…). **그래도 그대로 둔다.** 정리의 이득보다 유실의 손해가 크다. 굳이 바꾸려면 "옛 키를 읽어 새 키로 옮기는" 마이그레이션을 **먼저** 넣는다.

### 2. version 을 올리면 migrate 를 함께 넣는다

zustand `persist` 는 버전이 다르고 `migrate` 가 없으면 저장된 상태를 **버린다**(기본 동작). 진도·설정이 초기화된다.

| store | version | migrate |
|---|---|---|
| compare / driver / office | 3 / 3 / 4 | ✅ |
| **bonsai / shortcuts** | 2 / 1 | ❌ **부채** — 다음 bump 때는 반드시 넣을 것 |
| 나머지 9개 | 없음 | — |

### 계약 고정

`persistence-contract.test.ts` 가 **키 이름 14개와 version 값을 전부 고정**한다. 바꾸면 테스트가 깨진다.

> ⚠️ 이 테스트가 깨졌다면 먼저 물어라: **"기존 사용자의 저장분은 어떻게 되나?"**
> 의도한 변경이면 테스트의 `CONTRACT` 표를 고치되, 그 커밋에 마이그레이션이 함께 있어야 한다.

검증된 동작 (의도적 위반 주입):
- `memo.ts` 키를 `diaMemos` → `dia-memos` 로 바꿈 → **FAIL** (해당 store 와 기대 키를 지목)
- `quiz.ts` 에 `version: 5` 만 추가 → **FAIL 2건** (version 변경 + migrate 없음)

### 3. 스토리지가 없어도 앱이 죽지 않는다

사파리 프라이빗 모드·용량 초과에서 `localStorage` 접근이 **예외를 던진다**. zustand persist 는 경고만 남기고 메모리 상태로 계속 동작해야 한다 — store import 자체가 실패하면 앱이 통째로 안 뜬다. 테스트가 이 경로를 검증한다.
