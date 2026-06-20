-- 대기충당확인 (Standby Coverage)
-- 답십리 사업소 일일 대기충당현황 사진 공유 + 확인 기록

create table if not exists public.standby_coverage (
  id uuid primary key default gen_random_uuid(),
  target_date date not null,
  image_url text not null,
  uploaded_by_sabun text not null,
  uploaded_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_standby_coverage_target_date
  on public.standby_coverage (target_date desc, created_at desc);

create table if not exists public.standby_coverage_reads (
  id uuid primary key default gen_random_uuid(),
  coverage_id uuid not null references public.standby_coverage(id) on delete cascade,
  user_sabun text not null,
  user_name text not null,
  read_at timestamptz not null default now(),
  unique (coverage_id, user_sabun)
);

create index if not exists idx_standby_coverage_reads_coverage
  on public.standby_coverage_reads (coverage_id, read_at desc);

-- Storage bucket — public read, server-side write only
insert into storage.buckets (id, name, public)
values ('standby-coverage', 'standby-coverage', true)
on conflict (id) do nothing;

-- 모두 읽기 가능 (RLS 비활성 — server-only writes via service role)
alter table public.standby_coverage enable row level security;
alter table public.standby_coverage_reads enable row level security;

drop policy if exists "standby_coverage_select_all" on public.standby_coverage;
create policy "standby_coverage_select_all" on public.standby_coverage
  for select using (true);

drop policy if exists "standby_coverage_reads_select_all" on public.standby_coverage_reads;
create policy "standby_coverage_reads_select_all" on public.standby_coverage_reads
  for select using (true);
