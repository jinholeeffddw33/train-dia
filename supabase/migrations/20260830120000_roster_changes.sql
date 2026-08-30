-- ─────────────────────────────────────────────────────────
-- 명부 변경 예약 (관리자 모드) — src/data/rosterChanges.ts 의 DB판
--
-- 왜 DB로 옮기나
--   지금까지 인원이 바뀔 때마다 rosterChanges.ts 를 고치고 배포해야 했다.
--   이 표에 넣으면 배포 없이 시행일에 자동으로 반영된다.
--
-- 정적 ROSTER_CHANGES 와의 관계
--   앱은 [정적 + DB] 를 합쳐서 쓴다. 같은 자리(person_index)에 같은 시행일이
--   겹치면 DB 가 이긴다 — 배포 없이 고칠 수 있어야 하므로 나중 것이 우선.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roster_changes (
  id              BIGSERIAL PRIMARY KEY,
  -- 시행일 — 이 날(KST)부터 적용. 그 전에는 cycle.ts 원래 값이 보인다
  effective_from  DATE NOT NULL,
  -- 들어갈 자리 = cycle.ts P 의 I (순번). '1'~'171' 및 'W1'~'W5'
  person_index    TEXT NOT NULL CHECK (length(person_index) BETWEEN 1 AND 4),
  -- 들어갈 사람
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 20),
  sabun           TEXT NOT NULL CHECK (length(sabun) BETWEEN 6 AND 10),
  -- 시행 전 그 자리에 있던 이름 — 자리를 잘못 지정했는지 눈으로 검증
  replaces        TEXT NOT NULL CHECK (length(replaces) BETWEEN 1 AND 20),
  -- 시행일에 이 목록에서 빠진다 (인턴/내근 → 기관사 전환)
  leaves          TEXT CHECK (leaves IN ('intern','extra')),
  note            TEXT CHECK (note IS NULL OR length(note) <= 200),
  -- 누가 넣었는지 (사고 추적용)
  created_by      TEXT,
  created_by_name TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 같은 자리에 같은 시행일이 두 줄 있으면 어느 쪽이 이기는지 알 수 없다 → 아예 막는다
CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_changes_slot_date
  ON roster_changes(person_index, effective_from)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_roster_changes_active
  ON roster_changes(effective_from)
  WHERE status = 'active';
