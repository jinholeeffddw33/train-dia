-- 위험개소/사고/운전/열차 정보 등록 시 사진 외 일반 파일 첨부 지원
-- 사진은 photo_url에 유지, 파일은 attachment_url + 원본 파일명 보존
ALTER TABLE hazard_reports
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;
