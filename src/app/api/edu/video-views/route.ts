import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';

/** 영상별 고유 조회자 수 집계 */
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ counts: {} });
  }

  try {
    const { data } = await serverSupabase
      .from('audit_log')
      .select('target_id, user_id')
      .eq('action', 'edu_video_view')
      .eq('target_type', 'video');

    const counts: Record<string, number> = {};
    if (data) {
      // target_id별 distinct user_id 집계
      const byVideo: Record<string, Set<string>> = {};
      for (const row of data as { target_id: string | null; user_id: string }[]) {
        if (!row.target_id) continue;
        if (!byVideo[row.target_id]) byVideo[row.target_id] = new Set();
        byVideo[row.target_id].add(row.user_id);
      }
      for (const [videoId, users] of Object.entries(byVideo)) {
        counts[videoId] = users.size;
      }
    }

    return NextResponse.json({ counts });
  } catch {
    return NextResponse.json({ counts: {} });
  }
}

/** 영상 재생 기록 (유저당 영상당 1회만 카운트) */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ ok: true });
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return NextResponse.json({ ok: true });
  }
  const user = authResult;

  let videoId: string | undefined;
  try {
    const body = await req.json();
    videoId = body.videoId;
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: '잘못된 요청입니다' }, { status: 400 });
  }

  if (!videoId) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'videoId가 필요합니다' }, { status: 400 });
  }

  // 이미 이 유저가 이 영상을 본 적 있는지 확인
  const { data: existing } = await serverSupabase
    .from('audit_log')
    .select('id')
    .eq('user_id', user.sabun)
    .eq('action', 'edu_video_view')
    .eq('target_type', 'video')
    .eq('target_id', videoId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 신규 조회 기록
  await serverSupabase.from('audit_log').insert({
    user_id: user.sabun,
    user_name: user.name,
    action: 'edu_video_view',
    target_type: 'video',
    target_id: videoId,
  });

  return NextResponse.json({ ok: true });
}
