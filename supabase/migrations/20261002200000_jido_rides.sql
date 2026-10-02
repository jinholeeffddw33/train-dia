-- 지도승무 실적 — 지도요원(소장·부소장·부장)이 기관사 운전실에 동승해 지도한 기록.
--
-- 왜 필요한가 (진호 2026-10-02)
--   모든 기관사는 분기에 1회 이상, 중점관리대상자는 월 1회 이상 지도승무를 받아야 한다
--   (승무원지도운용내규 제69조). 지금은 엑셀로 모아 분기 말에야 누가 빠졌는지 안다.
--   지도부장이 «내 담당 기관사가 이번 분기에 탔는가»를 그때그때 보게 한다.
--   담당이 아닌 기관사를 지도해도 그 기관사의 횟수로 센다.
--
-- 들어오는 길은 둘: 화면에서 그날그날 한 건씩, 또는 사업소 실적 엑셀을 통째로 올리기.
-- 같은 기록이 두 번 들어오지 않도록 (날짜·기관사·지도요원·열차번호) 를 하나로 묶는다.
create table if not exists jido_rides (
  id bigserial primary key,
  ride_date date not null,
  driver_sabun text not null,
  driver_name text not null,
  guide_sabun text,
  guide_name text not null,
  train_no text not null default '',
  formation text not null default '',
  from_station text not null default '',
  to_station text not null default '',
  source text not null default 'manual' check (source in ('manual', 'upload')),
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  constraint jido_rides_unique unique (ride_date, driver_sabun, guide_name, train_no)
);
create index if not exists jido_rides_date_idx on jido_rides (ride_date);
create index if not exists jido_rides_driver_idx on jido_rides (driver_sabun);

-- 기관사별 담당부장·중점관리 지정 — 엑셀을 올리면 덮어쓴다(담당부장 배정은 사업소가 정한다)
create table if not exists jido_roster (
  driver_sabun text primary key,
  driver_name text not null,
  manager_name text,
  focus_reason text,
  focus_from date,
  focus_to date,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

alter table jido_rides enable row level security;
alter table jido_roster enable row level security;
-- 정책을 두지 않는다 = 브라우저 anon 키로는 못 연다. 서버 API(service role)만 읽고 쓴다.
-- 열람 권한(소장·부소장·부장)은 API 가 확인한다.
