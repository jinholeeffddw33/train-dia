import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: '잘못된 요청입니다' }, { status: 400 });
  }

  const name = (body.name as string)?.trim();
  const sabun = (body.sabun as string)?.trim();
  const subscription = body.subscription as { endpoint: string; keys: { p256dh: string; auth: string } } | undefined;

  if (!name || !sabun || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ code: 'MISSING_FIELDS', message: '필수 항목이 없습니다' }, { status: 400 });
  }

  const verified = verifyUser(name, sabun);
  if (!verified) {
    return NextResponse.json({ code: 'AUTH_FAILED', message: '이름과 사번이 일치하지 않습니다' }, { status: 403 });
  }

  const { error } = await serverSupabase
    .from('push_subscriptions')
    .upsert({
      sabun,
      name,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
    }, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '구독 저장에 실패했습니다', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: '잘못된 요청입니다' }, { status: 400 });
  }

  const endpoint = (body.endpoint as string)?.trim();
  if (!endpoint) {
    return NextResponse.json({ code: 'MISSING_FIELDS', message: 'endpoint가 필요합니다' }, { status: 400 });
  }

  await serverSupabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return NextResponse.json({ success: true });
}
