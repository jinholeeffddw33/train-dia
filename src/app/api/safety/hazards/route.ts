import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

const VALID_CATEGORIES = ['hazard', 'action', 'inspect'] as const;
type Category = typeof VALID_CATEGORIES[number];

function parseCategory(val: string | null): Category {
  if (val && VALID_CATEGORIES.includes(val as Category)) return val as Category;
  return 'hazard';
}

// ── GET: 목록 조회 (category 필터) ──
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const sabun = req.nextUrl.searchParams.get('sabun') ?? '';
  const category = parseCategory(req.nextUrl.searchParams.get('category'));

  // hazard_reads 테이블 존재 여부에 따라 쿼리 분기
  let data: Record<string, unknown>[] | null = null;
  let error: { message: string } | null = null;

  const { data: d1, error: e1 } = await serverSupabase
    .from('hazard_reports')
    .select('id, photo_url, description, location, created_by, created_at, category, view_count, resolved, resolved_at, resolved_by, hazard_comments(count), hazard_likes(count), hazard_reads(count)')
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (e1 && e1.message.includes('hazard_reads')) {
    // hazard_reads 테이블 없으면 reads 없이 재시도
    const { data: d2, error: e2 } = await serverSupabase
      .from('hazard_reports')
      .select('id, photo_url, description, location, created_by, created_at, category, resolved, resolved_at, resolved_by, hazard_comments(count), hazard_likes(count)')
      .eq('category', category)
      .order('created_at', { ascending: false });
    data = d2;
    error = e2;
  } else {
    data = d1;
    error = e1;
  }

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

  return NextResponse.json({ data: mapReports(data ?? [], likedIds) });
}

function mapReports(data: Record<string, unknown>[], likedIds: Set<string>) {
  return data.map((r) => ({
    id: r.id,
    photoUrl: r.photo_url,
    description: r.description,
    location: r.location || '',
    createdBy: r.created_by,
    createdAt: r.created_at,
    category: r.category || 'hazard',
    viewCount: (r.view_count as number) ?? 0,
    commentCount: (r.hazard_comments as { count: number }[])?.[0]?.count ?? 0,
    likeCount: (r.hazard_likes as { count: number }[])?.[0]?.count ?? 0,
    likedByMe: likedIds.has(r.id as string),
    readCount: (r.hazard_reads as { count: number }[])?.[0]?.count ?? 0,
    resolved: !!r.resolved,
    resolvedAt: (r.resolved_at as string | null) ?? null,
    resolvedBy: (r.resolved_by as string | null) ?? null,
  }));
}

// ── POST: 등록 (사진 + 설명 + category) ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!hasServiceKey) {
    console.warn('[safety] SUPABASE_SERVICE_ROLE_KEY 미설정 — anon 키 폴백');
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
  const category = parseCategory(formData.get('category') as string | null);

  // inspect(알림마당)는 photo 없어도 OK
  const photoRequired = category !== 'inspect';
  if ((!photo && photoRequired) || !description || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: photoRequired ? '사진, 설명, 이름, 사번은 필수입니다' : '설명, 이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  if (photo && photo.size > 5 * 1024 * 1024) {
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

  // Storage 업로드 (photo가 있을 때만)
  let publicUrl = '';
  if (photo && photo.size > 100) { // 100 bytes 이하는 placeholder로 간주
    const ext = photo.type.includes('png') ? 'png' : 'jpg';
    const fileName = `${category}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const { error: uploadError } = await serverSupabase.storage
      .from('hazard-photos')
      .upload(fileName, buffer, { contentType: photo.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { code: 'UPLOAD_FAILED', message: '사진 업로드에 실패했습니다', detail: uploadError.message },
        { status: 500 },
      );
    }

    publicUrl = serverSupabase.storage
      .from('hazard-photos')
      .getPublicUrl(fileName).data.publicUrl;
  }

  // DB 삽입 (category 포함)
  const insertData: Record<string, string> = {
    photo_url: publicUrl,
    description,
    location,
    created_by: verified.n,
    category,
  };

  const { data, error: dbError } = await serverSupabase
    .from('hazard_reports')
    .insert(insertData)
    .select('id')
    .single();

  if (dbError) {
    // category 컬럼 없으면 category 빼고 재시도
    if (dbError.message?.includes('category')) {
      const { category: _, ...withoutCategory } = insertData;
      const { data: d2, error: e2 } = await serverSupabase
        .from('hazard_reports')
        .insert(withoutCategory)
        .select('id')
        .single();
      if (e2) {
        return NextResponse.json(
          { code: 'INSERT_FAILED', message: '등록에 실패했습니다', detail: e2.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ id: d2.id });
    }

    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '등록에 실패했습니다', detail: dbError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
