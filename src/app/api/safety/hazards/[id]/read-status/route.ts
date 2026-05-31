import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { isExcludedFromReadTracking } from '@/lib/safetyReaders';

interface StaffEntry {
  sabun: string;
  name: string;
}

/**
 * GET /api/safety/hazards/[id]/read-status
 * 특정 게시물에 대해 "전 직원(인턴·제외명단 제외)" 기준으로
 * 읽은 사람 / 안 읽은 사람을 분리해서 반환
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }

  const { id: reportId } = await params;

  // 1. 활성 전 직원 — 인턴·제외명단 빼고
  const { data: profiles, error: pErr } = await serverSupabase
    .from('driver_profiles')
    .select('sabun, name, is_active')
    .order('name', { ascending: true });

  if (pErr) {
    return NextResponse.json(
      { code: 'FETCH_FAILED', message: '직원 명단 조회 실패', detail: pErr.message },
      { status: 500 },
    );
  }

  const targetStaff: StaffEntry[] = (profiles ?? [])
    .filter((p) => p.is_active !== false && !isExcludedFromReadTracking(p.sabun))
    .map((p) => ({ sabun: p.sabun as string, name: (p.name as string) ?? '' }));

  // 2. 이 게시물을 읽은 사람들 (hazard_reads)
  const { data: reads, error: rErr } = await serverSupabase
    .from('hazard_reads')
    .select('user_sabun, user_name, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  if (rErr) {
    return NextResponse.json(
      { code: 'FETCH_FAILED', message: '읽음 기록 조회 실패', detail: rErr.message },
      { status: 500 },
    );
  }

  const readMap = new Map<string, string>(); // sabun → readAt
  for (const r of reads ?? []) {
    const sabun = (r.user_sabun as string | null) ?? '';
    if (sabun && !readMap.has(sabun)) {
      readMap.set(sabun, (r.created_at as string) ?? '');
    }
  }

  // 3. 분리
  const readers: { sabun: string; name: string; readAt: string }[] = [];
  const nonReaders: { sabun: string; name: string }[] = [];
  for (const s of targetStaff) {
    const readAt = readMap.get(s.sabun);
    if (readAt) readers.push({ ...s, readAt });
    else nonReaders.push(s);
  }
  // 읽은 사람은 최근 순
  readers.sort((a, b) => b.readAt.localeCompare(a.readAt));

  return NextResponse.json({
    readers,
    nonReaders,
    totalExpected: targetStaff.length,
    readCount: readers.length,
  });
}
