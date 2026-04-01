import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string)?.trim();
  const sabun = (formData.get('sabun') as string)?.trim();

  if (!file || !name || !sabun) {
    return NextResponse.json({ code: 'MISSING_FIELDS', message: '파일, 이름, 사번이 필요합니다' }, { status: 400 });
  }

  const verified = verifyUser(name, sabun);
  if (!verified) {
    return NextResponse.json({ code: 'AUTH_FAILED' }, { status: 403 });
  }

  // 파일명 생성
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `life/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await serverSupabase.storage
    .from('hazard-photos')
    .upload(fileName, buf, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: error.message }, { status: 500 });
  }

  const { data: urlData } = serverSupabase.storage
    .from('hazard-photos')
    .getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl });
}
