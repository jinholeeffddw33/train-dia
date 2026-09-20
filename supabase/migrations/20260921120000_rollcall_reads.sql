-- 공지(점호)사항 읽음 기록 — «그날 근무자가 출근하면서 읽었는가» 를 관리자가 보려고 남긴다.
--
-- 날짜별로 한 사람 한 줄. 게시판은 하루 안에도 여러 번 고쳐지지만, 읽음은 «그날 읽었나» 로만 센다
-- (고칠 때마다 다시 읽으라고 하면 점호 전 확인이라는 뜻이 흐려진다).
create table if not exists rollcall_reads (
  id uuid primary key default gen_random_uuid(),
  read_date date not null,
  sabun text not null,
  name text not null,
  read_at timestamptz not null default now(),
  unique (read_date, sabun)
);

create index if not exists rollcall_reads_date_idx on rollcall_reads (read_date);

alter table rollcall_reads enable row level security;
-- 정책 없음 = 브라우저에서 직접 못 읽는다. 누가 읽었는지는 서버(관리자 전용 API)로만 나간다.
