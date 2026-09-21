import { NextRequest } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/serverSupabase';
import { isAdmin, verifyUser } from '@/lib/auth';
import { ERROR_CODES, errorResponse, internalError, okJson } from '@/lib/api/response';

/**
 * 공지(점호)사항 게시판 — 줄 하나를 계속 고쳐 쓰는 게시판.
 *
 * GET 은 누구나(로그인한 사람은 다 본다), 쓰기는 공지 등록 권한과 같은 사람(사업소 관리자)만.
 * 지금까지 공지 등록은 화면에서만 막고 서버는 아무나 받았는데, 여기서는 서버가 막는다.
 *
 * 첨부는 많이 쓰지 않는다고 해서 한 개만 둔다(사진이든 문서든). 기존 hazard-photos 통을 같이 쓴다.
 */

const BOARD_ID = 1;
const MAX_ATTACHMENT = 20 * 1024 * 1024; // 20MB — 안전 게시판 첨부와 같은 한도
/** 너무 작은 파일은 브라우저가 만든 빈 껍데기다(안전 게시판과 같은 규칙) */
const PLACEHOLDER_BYTES = 100;

const ItemSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(4000),
  detail: z.string().max(8000).optional(),
  // 제목 글자색 — 없으면 검정. 예전에 저장한 항목에는 이 칸이 없다.
  color: z.enum(['red', 'blue']).optional(),
});
const ItemsSchema = z.array(ItemSchema).max(50);

export interface RollCallItem {
  id: string;
  text: string;
  detail?: string;
  color?: 'red' | 'blue';
}

export async function GET() {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }
  const { data, error } = await serverSupabase
    .from('rollcall_board')
    .select('items, attachment_url, attachment_name, updated_by, updated_at')
    .eq('id', BOARD_ID)
    .maybeSingle();

  if (error) {
    return internalError(error, 'rollcall:GET', '점호 사항을 불러오지 못했어요. 잠시 후 다시 시도해주세요');
  }

  return okJson({
    items: (data?.items ?? []) as RollCallItem[],
    attachmentUrl: data?.attachment_url ?? null,
    attachmentName: data?.attachment_name ?? null,
    updatedBy: data?.updated_by ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

/**
 * POST — 게시판 통째로 저장(항목 목록 + 첨부).
 * 항목 하나만 고쳐도 목록 전체를 보낸다 — 순서가 곧 번호라 부분 저장이 더 위험하다.
 */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '요청 형식이 올바르지 않아요');
  }

  const name = String(form.get('name') ?? '').trim();
  const sabun = String(form.get('sabun') ?? '').trim();
  const verified = verifyUser(name, sabun);
  if (!verified) {
    return errorResponse(ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다');
  }
  if (!isAdmin(sabun)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '점호 사항은 관리자만 쓸 수 있어요');
  }

  let items: RollCallItem[];
  try {
    const parsed = ItemsSchema.safeParse(JSON.parse(String(form.get('items') ?? '[]')));
    if (!parsed.success) {
      return errorResponse(ERROR_CODES.BAD_REQUEST, '항목을 확인해주세요');
    }
    items = parsed.data;
  } catch {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '항목을 확인해주세요');
  }

  // 현재 첨부 — 지우거나 새로 올릴 때 예전 파일을 통에서 치우려고 먼저 읽는다
  const { data: current } = await serverSupabase
    .from('rollcall_board')
    .select('attachment_url')
    .eq('id', BOARD_ID)
    .maybeSingle();

  let attachmentUrl: string | null = current?.attachment_url ?? null;
  let attachmentName: string | null = null;
  const keepAttachment = String(form.get('keepAttachment') ?? '') === 'true';
  const file = form.get('attachment');

  if (file instanceof File && file.size > PLACEHOLDER_BYTES) {
    if (file.size > MAX_ATTACHMENT) {
      return errorResponse(ERROR_CODES.UNPROCESSABLE, '첨부 파일은 20MB까지 올릴 수 있어요');
    }
    const safeExt = (file.name.split('.').pop() ?? 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin';
    const path = `rollcall/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await serverSupabase.storage
      .from('hazard-photos')
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upErr) {
      return internalError(upErr, 'rollcall:upload', '첨부 파일을 올리지 못했어요. 잠시 후 다시 시도해주세요');
    }
    await removeStored(attachmentUrl);
    attachmentUrl = serverSupabase.storage.from('hazard-photos').getPublicUrl(path).data.publicUrl;
    attachmentName = file.name.slice(0, 200);
  } else if (keepAttachment) {
    const { data: keep } = await serverSupabase
      .from('rollcall_board')
      .select('attachment_name')
      .eq('id', BOARD_ID)
      .maybeSingle();
    attachmentName = keep?.attachment_name ?? null;
  } else {
    await removeStored(attachmentUrl);
    attachmentUrl = null;
    attachmentName = null;
  }

  const { error } = await serverSupabase
    .from('rollcall_board')
    .update({
      items,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      updated_by: verified.n,
      updated_by_sabun: sabun,
      updated_at: new Date().toISOString(),
    })
    .eq('id', BOARD_ID);

  if (error) {
    return internalError(error, 'rollcall:POST', '점호 사항을 저장하지 못했어요. 잠시 후 다시 시도해주세요');
  }

  return okJson({ ok: true });
}

/** 통에 있던 첨부 지우기 — 실패해도 저장은 계속한다(파일 하나 남는 것보다 저장이 중요) */
async function removeStored(url: string | null) {
  if (!serverSupabase || !url) return;
  const path = url.split('/hazard-photos/')[1];
  if (!path) return;
  try {
    await serverSupabase.storage.from('hazard-photos').remove([path]);
  } catch {
    /* ignore */
  }
}
