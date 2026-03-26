import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

// ── GET: 위험요소 목록 조회 ──
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const sabun = req.nextUrl.searchParams.get('sabun') ?? '';

  const { data, error } = await serverSupabase
    .from('hazard_reports')
    .select('id, photo_url, description, location, created_by, created_at, hazard_comments(count), hazard_likes(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { code: 'FETCH_FAILED', message: '목록 조회에 실패했습니다', detail: error.message },
      { status: 500 },
    );
  }

  // 좋아요 여부 조회
  let likedIds = new Set<string>();
  if (sabun) {
    const { data: likes } = await serverSupabase
      .from('hazard_likes')
      .select('report_id')
      .eq('user_sabun', sabun);
    if (likes) {
      likedIds = new Set(likes.map((l: { report_id: string }) => l.report_id));
    }
  }

  const reports = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    photoUrl: r.photo_url,
    description: r.description,
    location: r.location || '',
    createdBy: r.created_by,
    createdAt: r.created_at,
    commentCount: (r.hazard_comments as { count: number }[])?.[0]?.count ?? 0,
    likeCount: (r.hazard_likes as { count: number }[])?.[0]?.count ?? 0,
    likedByMe: likedIds.has(r.id as string),
  }));

  return NextResponse.json({ data: reports });
}

// ── POST: 위험요소 등록 (사진 + 설명) ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다', detail: 'SUPABASE_URL 또는 키가 설정되지 않았습니다' },
      { status: 500 },
    );
  }

  // service_role 키 사용 여부 확인 (anon 키면 Storage/RLS 문제 가능)
  const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!hasServiceKey) {
    console.warn('[hazard] SUPABASE_SERVICE_ROLE_KEY 미설정 — anon 키 폴백, RLS 제한 가능');
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_FORM', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const photo = formData.get('photo') as File | null;
  const description = (formData.get('description') as string | null)?.trim();
  const location = ((formData.get('location') as string | null) ?? '').trim();
  const name = (formData.get('name') as string | null)?.trim();
  const sabun = (formData.get('sabun') as string | null)?.trim();

  if (!photo || !description || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '사진, 설명, 이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  if (photo.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { code: 'FILE_TOO_LARGE', message: '사진은 5MB 이하로 올려주세요' },
      { status: 400 },
    );
  }

  const verified = verifyUser(name, sabun);
  if (!verified) {
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '이름과 사번이 일치하지 않습니다' },
      { status: 403 },
    );
  }

  // Storage 업로드
  const ext = photo.type.includes('png') ? 'png' : 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  const { error: uploadError } = await serverSupabase.storage
    .from('hazard-photos')
    .upload(fileName, buffer, { contentType: photo.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { code: 'UPLOAD_FAILED', message: '사진 업로드에 실패했습니다', detail: `${uploadError.message} (bucket: hazard-photos, key: ${hasServiceKey ? 'service_role' : 'anon'})` },
      { status: 500 },
    );
  }

  const { data: { publicUrl } } = serverSupabase.storage
    .from('hazard-photos')
    .getPublicUrl(fileName);

  // DB 삽입
  const { data, error: dbError } = await serverSupabase
    .from('hazard_reports')
    .insert({ photo_url: publicUrl, description, location, created_by: verified.n })
    .select('id')
    .single();

  if (dbError) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '등록에 실패했습니다', detail: `${dbError.message} (table: hazard_reports, key: ${hasServiceKey ? 'service_role' : 'anon'})` },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
