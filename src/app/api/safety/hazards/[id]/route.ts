import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser, isAdmin } from '@/lib/auth';

const MAX_ATTACHMENT = 20 * 1024 * 1024;

/** 공개 URL → 통 안 경로. 우리 통 파일이 아니면 null */
function storagePathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const p = url.split('/hazard-photos/')[1];
  return p ? decodeURIComponent(p) : null;
}

// ── PATCH: 위험요소 수정 (description, location, 첨부 파일 바꾸기·빼기) ──
// 새 첨부 파일이 있으면 multipart, 아니면 JSON 으로 온다.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const { id: reportId } = await params;

  let body: Record<string, unknown>;
  let newAttachment: File | null = null;
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const fd = await req.formData();
      // multipart 는 줄바꿈을 \r\n 으로 바꿔 보낸다 — JSON 으로 저장한 글과 같게 \n 으로 되돌린다
      const text = (k: string) => {
        const v = fd.get(k);
        return typeof v === 'string' ? v.replace(/\r\n/g, '\n') : v;
      };
      body = {
        description: text('description'),
        location: text('location'),
        name: fd.get('name'),
        sabun: fd.get('sabun'),
        removeFile: fd.get('removeFile') === 'true',
      };
      const f = fd.get('attachment');
      if (f instanceof File && f.size > 0) newAttachment = f;
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const description = (body.description as string | undefined)?.trim();
  const location = (body.location as string | undefined)?.trim() ?? '';
  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();
  const removeFile = body.removeFile === true;
  const removeAttachment = body.removeAttachment === true;

  if (newAttachment && newAttachment.size > MAX_ATTACHMENT) {
    return NextResponse.json(
      { code: 'ATTACHMENT_TOO_LARGE', message: '첨부 파일은 20MB 까지 올릴 수 있습니다' },
      { status: 400 },
    );
  }

  if (!description || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '설명, 이름, 사번은 필수입니다' },
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

  // 본인 글인지 확인
  const { data: report, error: fetchErr } = await serverSupabase
    .from('hazard_reports')
    .select('created_by, category, attachment_url')
    .eq('id', reportId)
    .single();

  if (fetchErr || !report) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  if (report.created_by !== verified.n) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '본인 글만 수정할 수 있습니다' },
      { status: 403 },
    );
  }

  const updateData: Record<string, string | null> = { description, location };

  // 첨부 파일 바꾸기 — 새 파일을 먼저 올리고, 글을 고친 뒤에 옛 파일을 지운다(실패해도 옛 첨부가 살아 있게)
  const oldAttachmentPath = storagePathOf(report.attachment_url as string | null);
  let attachmentChanged = false;
  if (newAttachment) {
    const safeExt = (newAttachment.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const category = String(report.category || 'etc').replace(/[^a-z]/g, '') || 'etc';
    const filePath = `attachments/${category}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const { error: upErr } = await serverSupabase.storage
      .from('hazard-photos')
      .upload(filePath, Buffer.from(await newAttachment.arrayBuffer()), {
        contentType: newAttachment.type || 'application/octet-stream',
        upsert: false,
      });
    if (upErr) {
      return NextResponse.json(
        { code: 'ATTACHMENT_UPLOAD_FAILED', message: '파일 업로드에 실패했습니다', detail: upErr.message },
        { status: 500 },
      );
    }
    updateData.attachment_url = serverSupabase.storage.from('hazard-photos').getPublicUrl(filePath).data.publicUrl;
    updateData.attachment_name = newAttachment.name.slice(0, 200);
    attachmentChanged = true;
  } else if (removeAttachment) {
    updateData.attachment_url = null;
    updateData.attachment_name = null;
    attachmentChanged = true;
  }

  // 첨부파일 삭제 요청
  if (removeFile) {
    // 기존 파일 URL 조회 후 스토리지 삭제
    const { data: fileReport } = await serverSupabase
      .from('hazard_reports')
      .select('photo_url')
      .eq('id', reportId)
      .single();
    if (fileReport?.photo_url && !fileReport.photo_url.includes('placeholder')) {
      const urlPath = fileReport.photo_url.split('/hazard-photos/')[1];
      if (urlPath) {
        await serverSupabase.storage.from('hazard-photos').remove([decodeURIComponent(urlPath)]);
      }
    }
    updateData.photo_url = '';
  }

  const { error: updateErr } = await serverSupabase
    .from('hazard_reports')
    .update(updateData)
    .eq('id', reportId);

  if (updateErr) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: '수정에 실패했습니다', detail: updateErr.message },
      { status: 500 },
    );
  }

  if (attachmentChanged && oldAttachmentPath) {
    await serverSupabase.storage.from('hazard-photos').remove([oldAttachmentPath]);
  }

  return NextResponse.json({
    success: true,
    ...(attachmentChanged
      ? { attachmentUrl: updateData.attachment_url ?? '', attachmentName: updateData.attachment_name ?? '' }
      : {}),
  });
}

// ── DELETE: 위험요소 삭제 (글 + 댓글 + 좋아요 + Storage 사진) ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const { id: reportId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();

  if (!name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '이름, 사번은 필수입니다' },
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

  // 본인 글인지 확인 + photo_url 가져오기
  const { data: report, error: fetchErr } = await serverSupabase
    .from('hazard_reports')
    .select('created_by, photo_url')
    .eq('id', reportId)
    .single();

  if (fetchErr || !report) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  if (report.created_by !== verified.n && !isAdmin(sabun!)) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '본인 글 또는 관리자만 삭제할 수 있습니다' },
      { status: 403 },
    );
  }

  // 1) 댓글 삭제
  await serverSupabase.from('hazard_comments').delete().eq('report_id', reportId);

  // 2) 좋아요 삭제 (테이블 없으면 무시)
  try { await serverSupabase.from('hazard_likes').delete().eq('report_id', reportId); } catch { /* ignore */ }

  // 3) Storage 사진 삭제
  if (report.photo_url) {
    // photo_url: "https://.../storage/v1/object/public/hazard-photos/filename.jpg"
    const parts = report.photo_url.split('/hazard-photos/');
    if (parts.length === 2) {
      const fileName = parts[1];
      await serverSupabase.storage.from('hazard-photos').remove([fileName]);
    }
  }

  // 4) 글 삭제
  const { error: deleteErr } = await serverSupabase
    .from('hazard_reports')
    .delete()
    .eq('id', reportId);

  if (deleteErr) {
    return NextResponse.json(
      { code: 'DELETE_FAILED', message: '삭제에 실패했습니다', detail: deleteErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
