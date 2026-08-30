-- ─────────────────────────────────────────────────────────
-- 인사 변경에 «업무» 를 더한다 (2026-08-30, 진호 요청)
--
-- 왜
--   «내근» 하나로 뭉뚱그리면 그 사람이 무슨 일을 하는지 앱이 모른다.
--   실제로는 지도부장·서무·영양사처럼 하는 일이 정해져 있다.
--   그래서 선택지에서 «내근» 을 빼고, 업무를 골라 넣는 것으로 바꿨다.
--   업무가 정해지면 근무형태는 자동으로 내근(office)이다.
-- ─────────────────────────────────────────────────────────

ALTER TABLE roster_changes
  ADD COLUMN IF NOT EXISTS duty TEXT
  CHECK (duty IN (
    'jido_bujang',      -- 지도부장
    'jiwon_gisa',       -- 지원기관사
    'unyong_bujang',    -- 운용계획부장
    'giji_gwanje',      -- 기지관제
    'safety_manager',   -- 안전관리자
    'seomu',            -- 서무
    'jido_gisa',        -- 지도기관사
    'yeongyangsa'       -- 영양사
  ));

-- 업무는 내근일 때만 의미가 있다 — 기관사·퇴사에 업무가 붙으면 화면이 헷갈린다
ALTER TABLE roster_changes
  DROP CONSTRAINT IF EXISTS duty_only_for_office;
ALTER TABLE roster_changes
  ADD CONSTRAINT duty_only_for_office
  CHECK (duty IS NULL OR work_type = 'office');
