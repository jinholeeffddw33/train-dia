-- 내 정보 — 기관사 본인이 자기 민원 등급·개인 통계를 한눈에 보는 화면의 자료.
--
-- 왜 필요한가 (진호 2026-10-09)
--   사업소가 19개월 민원(2025.03~)을 한 건씩 다시 분류해 기관사별 7단계(출입문 기준 · 전체 불만 기준)를
--   매겼다(바탕화면 «출입문 관련 자료\민원분석»). 이것을 본인이 앱에서 보고 스스로 단계를 올리고 싶게 한다.
--   교육 시험 점수는 지금까지 각자 폰(localStorage)에만 있어 관리자가 볼 수 없었다 → 서버에도 남긴다.
--
-- 개인정보: 본인과 관리자(소장·부소장·role=admin 계정)만 본다. 판정은 API 가 한다
--   (src/features/myinfo/lib/myInfoAccess.ts). 세 표 모두 정책 없이 RLS 를 켜 브라우저 anon 키로는 못 연다.

-- 기관사별 민원 집계·단계 — 엑셀을 올릴 때마다 통째로 바꾼다(scripts/import-complaints.ts)
create table if not exists complaint_people (
  sabun text primary key,
  name text not null,
  door_events int not null default 0,      -- 출입문 사건(같은 날·같은 열차 민원은 1건)
  door_complaints int not null default 0,  -- 출입문 민원 건수
  all_events int not null default 0,       -- 불만 사건(전체)
  all_complaints int not null default 0,   -- 불만 민원 건수(전체)
  praise int not null default 0,
  injury int not null default 0,           -- 부상 호소
  door_stage smallint not null check (door_stage between 1 and 7),
  all_stage smallint not null check (all_stage between 1 and 7),
  mgmt text not null default '',           -- 집중관리 · 관찰 · ''
  detail jsonb not null default '{}'::jsonb, -- 유형별 건수 · 주요 역 · 주요 시간대 · 출입문 외 불만 내역 · 우연일 확률
  first_date date,
  last_date date,
  period_from date not null,               -- 분석 기간
  period_to date not null,
  updated_at timestamptz not null default now()
);

-- 민원 한 건씩 — 본인(과 관리자)이 «왜 들어왔는지» 원문까지 본다
create table if not exists complaint_cases (
  id bigserial primary key,
  sabun text not null,
  name text not null,
  row_no int not null,                     -- 엑셀 「전체목록」 번호
  case_date date,
  kind text not null default '',           -- 다시 분류(주): 신체끼임 · 문닫힘 · 칭찬 …
  kinds text not null default '',          -- 다시 분류(전체)
  flags text not null default '',          -- 표시: 실패 · 반복 · 부상 · 약자 · 하차중 · 무방송 …
  report_type text not null default '',    -- 보고서 유형(원문)
  station text not null default '',
  time_band text not null default '',
  direction text not null default '',
  train_no text not null default '',
  formation text not null default '',
  content text not null default '',
  shared boolean not null default false,   -- 교대 기록상 두 사람이 함께 적힌 건
  constraint complaint_cases_unique unique (row_no, sabun)
);
create index if not exists complaint_cases_sabun_idx on complaint_cases (sabun, case_date desc);

-- 교육 시험 점수 — 기기(localStorage) 기록을 서버에도 남긴다. 같은 시험이 두 번 오면 하나로.
create table if not exists edu_quiz_results (
  id bigserial primary key,
  sabun text not null,
  name text not null,
  mode text not null,
  chapter_id text,
  score int not null,
  total int not null,
  percent int not null,
  solved_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint edu_quiz_results_unique unique (sabun, solved_at, mode)
);
create index if not exists edu_quiz_results_sabun_idx on edu_quiz_results (sabun, solved_at desc);

alter table complaint_people enable row level security;
alter table complaint_cases enable row level security;
alter table edu_quiz_results enable row level security;
-- 정책을 두지 않는다 = 서버 API(service role)만 읽고 쓴다.
