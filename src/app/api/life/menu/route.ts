import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

/**
 * 이번주 식당 메뉴 — 전 직원 공유(누구나 등록, 모두 열람).
 * 테이블 없이 Storage 버킷만 사용: menu/ 폴더의 "가장 최근 파일"이 이번주 메뉴.
 * 등록 시 기존 파일을 지우고 새로 올려 항상 1개만 유지.
 */
const BUCKET = 'restaurant-menu';
const FOLDER = 'menu';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type FileRow = { name: string; created_at?: string; updated_at?: string };

async function listMenu() {
  if (!serverSupabase) return [] as FileRow[];
  const { data, error } = await serverSupabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return [] as FileRow[]; // 버킷 미생성 등 → 빈 목록 취급
  return (data ?? []).filter((f) => f.name && !f.name.startsWith('.')) as FileRow[];
}

function toItem(name: string, updatedAt?: string | null) {
  const path = `${FOLDER}/${name}`;
  const url = serverSupabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const kind = name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
  return { url, kind, name, updatedAt: updatedAt ?? null };
}

// GET — 현재 등록된 메뉴(없으면 null)
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }
  const files = await listMenu();
  if (files.length === 0) return NextResponse.json({ data: null });
  const latest = files[0];
  return NextResponse.json({ data: toItem(latest.name, latest.created_at ?? latest.updated_at ?? null) });
}

// POST — 메뉴 등록/교체 (multipart/form-data, field: file)
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file || file.size < 100) {
    return NextResponse.json({ code: 'NO_FILE', message: '파일을 선택해주세요' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ code: 'FILE_TOO_LARGE', message: '10MB 이하로 올려주세요' }, { status: 400 });
  }

  // 버킷 보장(없으면 생성). 이미 있으면 에러 무시.
  await serverSupabase.storage.createBucket(BUCKET, { public: true });

  // 기존 메뉴 파일 제거(항상 최신 1개만 유지)
  const existing = await listMenu();
  if (existing.length > 0) {
    await serverSupabase.storage.from(BUCKET).remove(existing.map((f) => `${FOLDER}/${f.name}`));
  }

  const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const ext = isPdf ? 'pdf' : file.type.includes('png') ? 'png' : 'jpg';
  const fileName = `${FOLDER}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await serverSupabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: file.type || 'application/octet-stream', upsert: true });

  if (upErr) {
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: '업로드 실패', detail: upErr.message }, { status: 500 });
  }

  const name = fileName.split('/').pop() as string;
  return NextResponse.json({ data: toItem(name, new Date().toISOString()) });
}

// DELETE — 메뉴 삭제
export async function DELETE() {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }
  const existing = await listMenu();
  if (existing.length > 0) {
    await serverSupabase.storage.from(BUCKET).remove(existing.map((f) => `${FOLDER}/${f.name}`));
  }
  return NextResponse.json({ ok: true });
}
