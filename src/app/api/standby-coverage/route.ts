import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

const KEEP_DAYS = 3;
const BUCKET = 'standby-coverage';

type Supa = NonNullable<typeof serverSupabase>;

/** public URL → 버킷 내부 경로 추출 (저장 파일 삭제용) */
function extractStoragePath(imageUrl: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = imageUrl.indexOf(marker);
  if (i < 0) return null;
  try {
    return decodeURIComponent(imageUrl.slice(i + marker.length));
  } catch {
    return imageUrl.slice(i + marker.length);
  }
}

/**
 * 보관일(KEEP_DAYS)이 지난 대기충당현황을 사진+DB까지 실제 삭제.
 * - cutoff(오늘-2일)보다 오래된 target_date 행 대상
 * - 확인기록(standby_coverage_reads)은 FK on delete cascade 로 함께 삭제
 * 조회 요청마다 호출(가볍고 멱등) + 매일 도는 스케줄에서도 호출.
 */
async function cleanupExpired(supabase: Supa, cutoffStr: string): Promise<number> {
  const { data: oldRows } = await supabase
    .from('standby_coverage')
    .select('id, image_url')
    .lt('target_date', cutoffStr);

  if (!oldRows || oldRows.length === 0) return 0;

  // 1) 저장된 사진 삭제
  const paths = (oldRows as { id: string; image_url: string }[])
    .map((r) => extractStoragePath(r.image_url))
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  // 2) DB 행 삭제 (확인기록은 cascade)
  await supabase.from('standby_coverage').delete().lt('target_date', cutoffStr);

  return oldRows.length;
}

interface ReadRow { user_sabun: string; user_name: string; read_at: string }
interface CoverageRow {
  id: string;
  target_date: string;
  image_url: string;
  uploaded_by_sabun: string;
  uploaded_by_name: string;
  created_at: string;
  standby_coverage_reads: ReadRow[];
}

// GET — 최근 3일치 대기충당현황 + 확인자 목록
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS + 1);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  // 보관일 지난 기록 자동 삭제 (사진+DB) — 실패해도 조회는 계속
  try {
    await cleanupExpired(serverSupabase, cutoffStr);
  } catch {
    /* 정리 실패는 조회를 막지 않음 */
  }

  const { data, error } = await serverSupabase
    .from('standby_coverage')
    .select('id, target_date, image_url, uploaded_by_sabun, uploaded_by_name, created_at, standby_coverage_reads(user_sabun, user_name, read_at)')
    .gte('target_date', cutoffStr)
    .order('target_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ code: 'FETCH_FAILED', message: '조회 실패', detail: error.message }, { status: 500 });
  }

  const items = (data as CoverageRow[] | null ?? []).map((row) => ({
    id: row.id,
    targetDate: row.target_date,
    imageUrl: row.image_url,
    uploadedBy: { sabun: row.uploaded_by_sabun, name: row.uploaded_by_name },
    createdAt: row.created_at,
    reads: (row.standby_coverage_reads ?? []).map((r: ReadRow) => ({
      sabun: r.user_sabun,
      name: r.user_name,
      readAt: r.read_at,
    })),
  }));

  return NextResponse.json({ data: items });
}

// POST — 새 대기충당현황 업로드 (multipart/form-data)
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const form = await req.formData();
  const targetDate = String(form.get('targetDate') || '').slice(0, 10);
  const sabun = String(form.get('sabun') || '').trim();
  const name = String(form.get('name') || '').trim();
  const photo = form.get('photo') as File | null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ code: 'INVALID_DATE', message: '날짜를 선택해주세요' }, { status: 400 });
  }
  if (!name || !sabun) {
    return NextResponse.json({ code: 'NO_USER', message: '사용자 정보가 없습니다' }, { status: 400 });
  }
  if (!photo || photo.size < 100) {
    return NextResponse.json({ code: 'NO_PHOTO', message: '사진을 선택해주세요' }, { status: 400 });
  }
  if (photo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ code: 'FILE_TOO_LARGE', message: '사진은 10MB 이하로 올려주세요' }, { status: 400 });
  }

  const ext = photo.type.includes('png') ? 'png' : 'jpg';
  const fileName = `${targetDate}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  const { error: uploadError } = await serverSupabase.storage
    .from('standby-coverage')
    .upload(fileName, buffer, { contentType: photo.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: '사진 업로드 실패', detail: uploadError.message }, { status: 500 });
  }

  const publicUrl = serverSupabase.storage.from('standby-coverage').getPublicUrl(fileName).data.publicUrl;

  const { data, error: dbError } = await serverSupabase
    .from('standby_coverage')
    .insert({
      target_date: targetDate,
      image_url: publicUrl,
      uploaded_by_sabun: sabun,
      uploaded_by_name: name,
    })
    .select('id')
    .single();

  if (dbError) {
    // Cleanup uploaded file on DB failure
    await serverSupabase.storage.from('standby-coverage').remove([fileName]);
    return NextResponse.json({ code: 'INSERT_FAILED', message: '저장 실패', detail: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
