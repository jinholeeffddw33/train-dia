import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { hashSabun } from '@/lib/board/alias';

const VALID_TYPES = ['post', 'comment'] as const;
const VALID_REASONS = ['욕설·혐오', '스팸·광고', '개인정보 노출', '음란성', '기타'] as const;

export async function POST(req: NextRequest) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  type Body = { target_type?: string; target_id?: number; reason?: string };
  let payload: Body;
  try { payload = (await req.json()) as Body; } catch { return NextResponse.json({ code: 'BAD_JSON' }, { status: 400 }); }

  if (!payload.target_type || !(VALID_TYPES as readonly string[]).includes(payload.target_type)) {
    return NextResponse.json({ code: 'BAD_TYPE' }, { status: 400 });
  }
  if (!payload.target_id || typeof payload.target_id !== 'number') {
    return NextResponse.json({ code: 'BAD_ID' }, { status: 400 });
  }
  if (!payload.reason || !(VALID_REASONS as readonly string[]).includes(payload.reason)) {
    return NextResponse.json({ code: 'BAD_REASON' }, { status: 400 });
  }

  const myHash = hashSabun(auth.sabun);
  const { error } = await serverSupabase.from('board_reports').insert({
    target_type: payload.target_type,
    target_id: payload.target_id,
    reporter_hash: myHash,
    reason: payload.reason,
  });
  // unique 중복 = 이미 신고했음 → 성공 처리
  if (error && !String(error.message ?? '').includes('duplicate')) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
