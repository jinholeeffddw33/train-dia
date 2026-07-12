-- 이번주 식당 메뉴 — Storage 버킷(전 직원 공유, 서버 서비스롤로 쓰기)
-- 별도 테이블 없이 restaurant-menu 버킷의 menu/ 폴더 최신 파일이 '이번주 메뉴'.
-- (런타임 API가 없으면 자동 생성하므로 idempotent)

insert into storage.buckets (id, name, public)
values ('restaurant-menu', 'restaurant-menu', true)
on conflict (id) do nothing;
