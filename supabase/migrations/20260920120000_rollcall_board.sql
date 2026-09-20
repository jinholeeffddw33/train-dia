-- 공지(점호)사항 게시판 — 출근 점호 때 기관사들에게 전달할 사항을 항목으로 적는 곳.
--
-- 날마다 쌓지 않고 «하나의 게시판을 계속 고쳐 쓰는» 구조다(진호 2026-09-20).
-- 그래서 줄은 언제나 하나(id = 1)뿐이고, 다음 근무자가 이전 기록의 필요한 항목만 고친다.
--
-- items 한 항목: { "id": "…", "text": "제목(길이 제한 없음)", "detail": "부가 설명(선택)" }
-- 순서가 곧 번호라서 별도 순번 칸을 두지 않는다 — 위아래로 옮기면 배열 순서가 바뀐다.
create table if not exists rollcall_board (
  id smallint primary key default 1,
  items jsonb not null default '[]'::jsonb,
  attachment_url text,
  attachment_name text,
  updated_by text,
  updated_by_sabun text,
  updated_at timestamptz not null default now(),
  constraint rollcall_board_single_row check (id = 1)
);

insert into rollcall_board (id) values (1) on conflict (id) do nothing;

alter table rollcall_board enable row level security;
-- 정책을 두지 않는다 = 브라우저 anon 키로는 못 연다. 서버 API(service role)만 읽고 쓴다.
