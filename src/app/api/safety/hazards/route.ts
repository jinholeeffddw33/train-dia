import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

const VALID_CATEGORIES = ['hazard', 'action', 'inspect'] as const;
type Category = typeof VALID_CATEGORIES[number];

/** 한 번에 올릴 수 있는 사진 수. 화면(HazardForm)과 같은 값을 쓴다 */
const MAX_PHOTOS = 10;

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
    .select('id, photo_url, photo_urls, attachment_url, attachment_name, description, location, tags, created_by, created_at, category, view_count, resolved, resolved_at, resolved_by, hazard_comments(count), hazard_likes(count), hazard_reads(count)')
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (e1 && e1.message.includes('hazard_reads')) {
    // hazard_reads 테이블 없으면 reads 없이 재시도
    const { data: d2, error: e2 } = await serverSupabase
      .from('hazard_reports')
      .select('id, photo_url, photo_urls, attachment_url, attachment_name, description, location, tags, created_by, created_at, category, resolved, resolved_at, resolved_by, hazard_comments(count), hazard_likes(count)')
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
    /* 사진 여러 장. 이 칸이 생기기 전에 올라간 글은 비어 있어서 대표 사진 한 장으로 채운다 —
       읽는 쪽이 "옛 글이냐 새 글이냐"를 따지지 않게 여기서 한 모양으로 맞춰 준다. */
    photoUrls: ((r.photo_urls as string[] | null) ?? []).length > 0
      ? (r.photo_urls as string[])
      : (r.photo_url ? [r.photo_url as string] : []),
    attachmentUrl: (r.attachment_url as string | null) ?? '',
    attachmentName: (r.attachment_name as string | null) ?? '',
    description: r.description,
    location: r.location || '',
    tags: (r.tags as string[] | null) ?? [],
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

  /* 사진은 여러 장 받는다(최대 10). 폼이 'photo' 를 여러 번 담아 보내므로 getAll.
     100 bytes 이하는 예전부터 placeholder 로 보던 값이라 여기서 함께 걸러낸다. */
  const photos = formData.getAll('photo')
    .filter((v): v is File => v instanceof File && v.size > 100);
  const attachment = formData.get('attachment') as File | null;
  const description = (formData.get('description') as string | null)?.trim();
  const location = ((formData.get('location') as string | null) ?? '').trim();
  const name = (formData.get('name') as string | null)?.trim();
  const sabun = (formData.get('sabun') as string | null)?.trim();
  const category = parseCategory(formData.get('category') as string | null);

  // 모든 카테고리에서 사진은 선택사항
  if (!description || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '설명, 이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json(
      { code: 'TOO_MANY_PHOTOS', message: `사진은 한 번에 ${MAX_PHOTOS}장까지 올릴 수 있어요` },
      { status: 400 },
    );
  }

  if (photos.some((p) => p.size > 5 * 1024 * 1024)) {
    return NextResponse.json(
      { code: 'FILE_TOO_LARGE', message: '사진은 한 장에 5MB 이하로 올려주세요' },
      { status: 400 },
    );
  }

  if (attachment && attachment.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { code: 'ATTACHMENT_TOO_LARGE', message: '파일은 20MB 이하로 올려주세요' },
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

  /* Storage 업로드 — 고른 순서대로 한 장씩. 중간에 하나라도 실패하면 멈추고 알린다.
     (일부만 올라간 채 글이 등록되면 어느 사진이 빠졌는지 올린 사람이 알 수 없다) */
  const photoUrls: string[] = [];
  for (const photo of photos) {
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

    photoUrls.push(
      serverSupabase.storage.from('hazard-photos').getPublicUrl(fileName).data.publicUrl,
    );
  }
  // 대표 사진 = 첫 장. photo_url 을 읽는 곳(목록 썸네일 등)이 아직 여럿이라 함께 채운다.
  const publicUrl = photoUrls[0] ?? '';

  // 첨부 파일 업로드 (있을 때만, 압축/변환 없이 원본 그대로)
  let attachmentUrl = '';
  let attachmentName = '';
  if (attachment && attachment.size > 0) {
    const safeExt = (attachment.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const filePath = `attachments/${category}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const buffer = Buffer.from(await attachment.arrayBuffer());

    const { error: upErr } = await serverSupabase.storage
      .from('hazard-photos')
      .upload(filePath, buffer, {
        contentType: attachment.type || 'application/octet-stream',
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json(
        { code: 'ATTACHMENT_UPLOAD_FAILED', message: '파일 업로드에 실패했습니다', detail: upErr.message },
        { status: 500 },
      );
    }

    attachmentUrl = serverSupabase.storage
      .from('hazard-photos')
      .getPublicUrl(filePath).data.publicUrl;
    attachmentName = attachment.name.slice(0, 200);
  }

  // 운전정보(inspect + [시설물]/[열차]/[신호] 태그) 자동 번호 부여
  // - 사용자가 별도로 location을 지정하지 않은 경우에만 자동 부여
  // - 기존 최고 호수 + 1 로 부여 (예: 10호 다음은 11호)
  let finalLocation = location;
  if (category === 'inspect' && !location) {
    const drivingTagMatch = /^\[(시설물|열차|신호)\]/.test(description);
    if (drivingTagMatch) {
      const { data: existing } = await serverSupabase
        .from('hazard_reports')
        .select('location, description')
        .eq('category', 'inspect')
        .not('location', 'is', null)
        .neq('location', '');
      let maxNo = 0;
      for (const row of (existing ?? [])) {
        const r = row as { location: string; description: string };
        if (!/^\[(시설물|열차|신호)\]/.test(r.description || '')) continue;
        const m = /(\d+)/.exec(r.location || '');
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNo) maxNo = n;
        }
      }
      finalLocation = `${maxNo + 1}호`;
    }
  }

  // DB 삽입 (category 포함)
  const insertData: Record<string, string | string[]> = {
    photo_url: publicUrl,
    photo_urls: photoUrls,
    attachment_url: attachmentUrl,
    attachment_name: attachmentName,
    description,
    location: finalLocation,
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
