-- board-photos 스토리지 버킷 생성 + 공개 읽기 정책

INSERT INTO storage.buckets (id, name, public)
VALUES ('board-photos', 'board-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 (URL로 직접 접근 가능)
DROP POLICY IF EXISTS board_photos_public_read ON storage.objects;
CREATE POLICY board_photos_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'board-photos');
