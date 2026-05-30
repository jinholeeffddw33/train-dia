-- 위험개소 조치완료 표시용 컬럼 추가
alter table hazard_reports
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text;

create index if not exists idx_hazard_reports_resolved on hazard_reports (resolved) where resolved = true;
