-- 2026년 자체 청렴도 자가진단 «청렴 문제풀기 경진대회» 제출 기록
--
-- 한 사람은 한 번만 응시한다. 그 «한 번» 은 화면이 아니라 DB 가 막는다 —
-- 클라이언트 검사만으로는 앱을 지웠다 깔거나 다른 기기로 들어오면 두 번 낸다.
-- sabun UNIQUE 가 그 두 번째 제출을 거절한다.
--
-- 점수와 정답은 응시자에게 보여주지 않는다(대회가 끝날 때까지). 그래서 이 표는
-- 브라우저 anon 키로는 아예 열리지 않게 두고, 서버 API(service role)로만 드나든다.
create table if not exists integrity_quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  sabun text not null unique,
  name text not null,
  score integer not null,
  total integer not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

alter table integrity_quiz_submissions enable row level security;
-- 정책을 하나도 두지 않는다 = anon/authenticated 는 읽기도 쓰기도 불가.
-- service role 은 RLS 를 우회하므로 서버 라우트만 접근한다.
