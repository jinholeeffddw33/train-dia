import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

const KEEP_DAYS = 3;

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
