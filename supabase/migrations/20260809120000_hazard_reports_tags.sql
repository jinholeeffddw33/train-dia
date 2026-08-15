-- 사고사례(운전정보) 유형 태그
--
-- 지금 분류는 description 첫 줄의 [열차]/[신호]/[시설물] 3종뿐이라, 17건 중 6건이
-- 전부 [열차] 로 묶여 있다. 13호(영등포구청 PSD 미개방)와 14호(건대입구 PSD 미개방)는
-- 같은 유형이고 14호 문서가 13호를 직접 참조하는데도 함께 볼 방법이 없다.
--
-- tags 로 "출입문", "승강장안전문", "지적확인환호" 같은 실제 사고 유형을 붙여
-- 묶어보기·필터·레일봇 검색에 쓴다. 기존 category/description 은 그대로 둔다.
ALTER TABLE hazard_reports
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 태그 교집합 조회(tags && '{출입문}')를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_hazard_reports_tags ON hazard_reports USING GIN (tags);
