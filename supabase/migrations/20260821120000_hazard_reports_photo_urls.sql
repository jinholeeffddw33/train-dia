-- 위험개소·열차정보 사진 여러 장 첨부
--
-- 지금은 사진 주소를 담는 칸이 photo_url 하나뿐이라 한 장밖에 못 올린다. 위험개소는
-- 한 자리를 여러 각도로 찍어야 무엇이 문제인지 전달되고, 열차정보도 편성·번호판·
-- 고장 부위를 따로 찍는 일이 많아 한 장으로는 부족하다는 요청.
--
-- photo_url 은 그대로 두고 photo_urls(배열)를 더한다. 왜 갈아치우지 않는가:
--   - 이미 올라간 글과 목록 썸네일·레일봇 등 photo_url 을 읽는 곳이 여럿이다.
--   - photo_url = 대표 사진(첫 장), photo_urls = 전체. 두 값이 어긋나지 않도록
--     서버가 항상 함께 쓴다(첫 장을 photo_url 에도 넣는다).
-- 기존 글은 photo_urls 가 비어 있고, 읽는 쪽에서 photo_url 한 장으로 보정한다.
ALTER TABLE hazard_reports
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
