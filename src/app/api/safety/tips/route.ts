import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

interface TipRow {
  id: string;
  title: string;
  description: string | null;
  content_type: 'video' | 'image';
  media_url: string;
  thumbnail_url: string | null;
  created_by_sabun: string;
  created_by_name: string;
  created_at: string;
}

// GET — 안전상식 목록 (최신순)
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const { data, error } = await serverSupabase
    .from('safety_tips')
    .select('id, title, description, content_type, media_url, thumbnail_url, created_by_sabun, created_by_name, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ code: 'FETCH_FAILED', message: '조회 실패', detail: error.message }, { status: 500 });
  }

  const items = (data as TipRow[] | null ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    contentType: r.content_type,
    mediaUrl: r.media_url,
    thumbnailUrl: r.thumbnail_url ?? '',
    createdBy: { sabun: r.created_by_sabun, name: r.created_by_name },
    createdAt: r.created_at,
  }));

  return NextResponse.json({ data: items });
}

// POST — 신규 안전상식 등록 (multipart/form-data)
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const form = await req.formData();
  const title = String(form.get('title') || '').trim().slice(0, 200);
  const description = String(form.get('description') || '').trim().slice(0, 2000);
  const contentType = String(form.get('contentType') || '').trim();
  const sabun = String(form.get('sabun') || '').trim();
  const name = String(form.get('name') || '').trim();

  if (!title) {
    return NextResponse.json({ code: 'NO_TITLE', message: '제목을 입력해주세요' }, { status: 400 });
  }
  if (!name || !sabun) {
    return NextResponse.json({ code: 'NO_USER', message: '사용자 정보가 없습니다' }, { status: 400 });
  }
  if (contentType !== 'video' && contentType !== 'image') {
    return NextResponse.json({ code: 'INVALID_TYPE', message: '동영상 또는 사진 형식을 선택해주세요' }, { status: 400 });
  }

  let mediaUrl = '';

  if (contentType === 'video') {
    const videoUrl = String(form.get('videoUrl') || '').trim();
    if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
      return NextResponse.json({ code: 'INVALID_URL', message: '동영상 URL을 입력해주세요' }, { status: 400 });
    }
    mediaUrl = videoUrl.slice(0, 500);
  } else {
    const photo = form.get('photo') as File | null;
    if (!photo || photo.size < 100) {
      return NextResponse.json({ code: 'NO_PHOTO', message: '사진을 선택해주세요' }, { status: 400 });
    }
    if (photo.size > 10 * 1024 * 1024) {
      return NextResponse.json({ code: 'FILE_TOO_LARGE', message: '사진은 10MB 이하로 올려주세요' }, { status: 400 });
    }
    const ext = photo.type.includes('png') ? 'png' : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const { error: uploadError } = await serverSupabase.storage
      .from('safety-tips')
      .upload(fileName, buffer, { contentType: photo.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ code: 'UPLOAD_FAILED', message: '사진 업로드 실패', detail: uploadError.message }, { status: 500 });
    }
    mediaUrl = serverSupabase.storage.from('safety-tips').getPublicUrl(fileName).data.publicUrl;
  }

  const { data, error: dbError } = await serverSupabase
    .from('safety_tips')
    .insert({
      title,
      description: description || null,
      content_type: contentType,
      media_url: mediaUrl,
      created_by_sabun: sabun,
      created_by_name: name,
    })
    .select('id')
    .single();

  if (dbError) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: '저장 실패', detail: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
