-- ─────────────────────────────────────────────────────────
-- 인사 변경 — «자리» 중심에서 «사람» 중심으로 바꾼다
--
-- 왜 바꾸나 (2026-08-30, 진호 요청)
--   처음엔 "그 자리에 누가 앉는다"만 표현하면 됐다. 이제는 한 사람의 상태를
--   통째로 바꿔야 한다 — 근무형태(기관사/내근/인턴/휴직/병가/공로연수/퇴사),
--   직급, 그리고 그에 따라 교번 자리가 채워지거나 결원이 되는 것까지.
--   자리를 키로 잡으면 «직급만 바꾸는» 변경(자리가 없다)을 담을 수 없다.
--
--   한 줄 = "이 사람이 이 날부터 이렇게 된다".
--
-- 기존 데이터
--   시험용 3줄(전부 status='deleted')뿐이라 그냥 버리고 다시 만든다.
-- ─────────────────────────────────────────────────────────

DROP TABLE IF EXISTS roster_changes;

CREATE TABLE roster_changes (
  id              BIGSERIAL PRIMARY KEY,
  -- 시행일 — 이 날(KST)부터 적용. 그 전에는 지금 상태가 그대로 보인다
  effective_from  DATE NOT NULL,

  -- ── 누가 ──
  subject_sabun   TEXT NOT NULL CHECK (length(subject_sabun) BETWEEN 6 AND 10),
  subject_name    TEXT NOT NULL CHECK (length(subject_name) BETWEEN 1 AND 20),

  -- ── 무엇이 되나 ──
  --   driver  기관사        office  내근        intern  인턴
  --   leave   휴직          sick    병가        service 공로연수      resign  퇴사
  work_type       TEXT NOT NULL CHECK (work_type IN
                    ('driver','office','intern','leave','sick','service','resign')),
  -- 내근 직급 — 기관사·인턴은 직급을 쓰지 않으므로 NULL
  rank            TEXT CHECK (rank IN ('chief','vice','manager','deputy','gwajang','daeri')),

  -- ── 교번 자리는 어떻게 되나 ──
  -- 관련된 자리 = cycle.ts P 의 I. 직급만 바꾸는 변경이면 NULL
  slot_index      TEXT CHECK (slot_index IS NULL OR length(slot_index) BETWEEN 1 AND 4),
  -- 시행 전 그 자리에 있던 이름 — 자리를 잘못 짚었는지 눈으로 검증(서버가 채운다)
  slot_before     TEXT,
  -- 기관사에서 빠질 때 그 자리가 될 결원 — 예) '결원12' / '9G010912'
  vacancy_name    TEXT CHECK (vacancy_name IS NULL OR length(vacancy_name) BETWEEN 1 AND 20),
  vacancy_sabun   TEXT CHECK (vacancy_sabun IS NULL OR length(vacancy_sabun) BETWEEN 6 AND 10),

  note            TEXT CHECK (note IS NULL OR length(note) <= 200),
  created_by      TEXT,
  created_by_name TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 기관사가 되려면 어느 자리인지 반드시 있어야 한다
  CONSTRAINT driver_needs_slot
    CHECK (work_type <> 'driver' OR slot_index IS NOT NULL),
  -- 자리를 비우는 변경이면 그 자리가 무엇이 되는지 반드시 있어야 한다
  CONSTRAINT vacancy_pairs
    CHECK ((vacancy_name IS NULL) = (vacancy_sabun IS NULL))
);

-- 한 사람이 같은 날 두 번 바뀌면 어느 쪽이 이기는지 알 수 없다 → 아예 막는다
CREATE UNIQUE INDEX idx_roster_changes_person_date
  ON roster_changes(subject_sabun, effective_from)
  WHERE status = 'active';

-- 같은 날 한 자리를 두 사람이 차지할 수 없다
CREATE UNIQUE INDEX idx_roster_changes_slot_date
  ON roster_changes(slot_index, effective_from)
  WHERE status = 'active' AND slot_index IS NOT NULL;

CREATE INDEX idx_roster_changes_active
  ON roster_changes(effective_from)
  WHERE status = 'active';
