-- hazard-photos 통이 사진만(jpeg·png·webp·heic), 5MB 까지만 받게 막혀 있었다.
--
-- 그래서 안전 게시판·공지(점호)사항의 «파일 첨부» 로 PDF·한글 파일을 올리면 저장이 늘 실패했다
-- (2026-09-21 까지 실제로 붙은 첨부는 사진 2장뿐). API 는 첨부를 20MB 까지 받는다고 약속하고 있어
-- 통의 한도(5MB)와도 어긋났다. 운전정보 20호 원본 PDF 를 붙이다가 드러났다.
--
-- 문서 형식을 허용하고 한도를 20MB 로 맞춘다. 웹 페이지·스크립트(html·js·svg)는 계속 막는다 —
-- 공개 통이라 그런 파일이 올라가면 우리 주소로 남의 페이지를 띄울 수 있다.
-- application/octet-stream 은 휴대폰이 .hwp 같은 파일의 종류를 모를 때 붙이는 값이라 함께 연다
-- (그렇게 올라간 파일은 브라우저에서 열리지 않고 내려받기만 된다).
update storage.buckets
set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
    'application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp',
    'application/hwp+zip', 'application/vnd.hancom.hwpx',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/octet-stream'
  ]
where id = 'hazard-photos';
