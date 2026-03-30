import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser, isAdmin } from '@/lib/auth';
import webpush from 'web-push';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:train-dia@smt5.kr', VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ code: 'VAPID_NOT_SET', message: 'VAPID 키가 설정되지 않았습니다' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: '잘못된 요청입니다' }, { status: 400 });
  }

  const name = (body.name as string)?.trim();
  const sabun = (body.sabun as string)?.trim();
  const title = (body.title as string)?.trim();
  const message = (body.message as string)?.trim();

  if (!name || !sabun || !title || !message) {
    return NextResponse.json({ code: 'MISSING_FIELDS', message: '필수 항목이 없습니다' }, { status: 400 });
  }

  const verified = verifyUser(name, sabun);
  if (!verified || !isAdmin(sabun)) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '관리자만 푸시를 보낼 수 있습니다' }, { status: 403 });
  }

  // 모든 구독자 조회
  const { data: subs, error } = await serverSupabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth');

  if (error || !subs) {
    return NextResponse.json({ code: 'DB_ERROR', message: '구독자 조회 실패' }, { status: 500 });
  }

  const payload = JSON.stringify({ title, body: message, icon: '/favicon.svg' });

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload,
      );
      sent++;
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        expired.push(sub.endpoint);
      }
    }
  }

  // 만료된 구독 정리
  if (expired.length > 0) {
    await serverSupabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return NextResponse.json({ success: true, sent, failed, cleaned: expired.length });
}
