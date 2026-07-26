import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

/**
 * 식당 메뉴 — 전 직원 공유(누구나 등록, 모두 열람).
 * 테이블 없이 Storage 버킷만 사용. 파일명에 '적용 주(월요일 날짜)'를 담는다:
 *   menu/2026-07-13.jpg  ← 그 주(월~일) 메뉴
 * 덕분에 이번주·다음주가 공존하고, 월요일이 되면 다음주 파일이 저절로 이번주 메뉴가 된다
 * (아무도 교체 버튼을 누르지 않아도 됨).
 *
 * ⚠️ 주(週) 계산은 서버에서 하지 않는다. 서버는 UTC라 KST 월요일 00:00 을 못 맞춘다
 *    (일요일 15:00 UTC 에 넘어가 버림). 클라이언트(브라우저=한국시간)가 계산해 week 를 넘기고,
 *    서버는 파일 보관·정리만 담당한다.
 */
const BUCKET = 'restaurant-menu';
const FOLDER = 'menu';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const KEEP_FILES = 3; // 파일명이 날짜라 이름 내림차순 = 최신순

type FileRow = { name: string; created_at?: string; updated_at?: string };

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 파일명에서 적용 주 추출. 구(舊) 타임스탬프 파일은 null(=레거시) */
function weekOf(name: string): string | null {
  const base = name.replace(/\.[^.]+$/, '');
  return WEEK_RE.test(base) ? base : null;
}

async function listMenu(): Promise<FileRow[]> {
  if (!serverSupabase) return [];
  const { data, error } = await serverSupabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  if (error) return []; // 버킷 미생성 등 → 빈 목록 취급
  return (data ?? []).filter((f) => f.name && !f.name.startsWith('.')) as FileRow[];
}

function toItem(f: FileRow) {
  const path = `${FOLDER}/${f.name}`;
  const base = serverSupabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  // 파일명이 주(週)로 고정 + 덮어쓰기(upsert)라 교체해도 URL이 같아 캐시가 옛 사진을 보여준다.
  // 갱신 시각을 버전 표식으로 붙여, 교체할 때마다 URL이 달라지게 → 항상 최신 사진.
  const ver = f.updated_at ?? f.created_at ?? '';
  const url = ver ? `${base}?v=${encodeURIComponent(ver)}` : base;
  return {
    url,
    kind: f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
    name: f.name,
    week: weekOf(f.name), // null = 레거시(구 타임스탬프 파일) → 클라이언트가 이번주로 인정
    updatedAt: f.updated_at ?? f.created_at ?? null,
  };
}

// GET — 등록된 메뉴 전체(보통 1~2개). 어느 게 이번주인지는 클라이언트가 판단한다.
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }
  const files = await listMenu();
  return NextResponse.json({ data: files.map(toItem) });
}

// POST — 특정 주 메뉴 등록/교체 (multipart/form-data: file, week, current)
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const week = String(form.get('week') ?? '');
  const current = String(form.get('current') ?? '');

  if (!WEEK_RE.test(week) || !WEEK_RE.test(current)) {
    return NextResponse.json({ code: 'BAD_WEEK', message: '주간 정보가 올바르지 않습니다' }, { status: 400 });
  }
  if (!file || file.size < 100) {
    return NextResponse.json({ code: 'NO_FILE', message: '파일을 선택해주세요' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ code: 'FILE_TOO_LARGE', message: '10MB 이하로 올려주세요' }, { status: 400 });
  }

  // 버킷 보장(없으면 생성). 이미 있으면 에러 무시.
  await serverSupabase.storage.createBucket(BUCKET, { public: true });

  const existing = await listMenu();
  const doomed = existing.filter((f) => {
    const w = weekOf(f.name);
    if (w === week) return true;               // 같은 주 → 교체
    if (w === null) return week === current;   // 레거시는 '이번주'를 새로 올릴 때만 정리
    return w < current;                        // 지난 주 자동 정리 (ISO 문자열 비교 = 시간순)
  });
  if (doomed.length > 0) {
    await serverSupabase.storage.from(BUCKET).remove(doomed.map((f) => `${FOLDER}/${f.name}`));
  }

  const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const ext = isPdf ? 'pdf' : file.type.includes('png') ? 'png' : 'jpg';
  const fileName = `${FOLDER}/${week}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await serverSupabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: file.type || 'application/octet-stream', upsert: true });

  if (upErr) {
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: '업로드 실패', detail: upErr.message }, { status: 500 });
  }

  // 보관 상한 — 이름 내림차순(=최신순)으로 KEEP_FILES 개만 남긴다
  const after = await listMenu();
  const overflow = after.slice(KEEP_FILES);
  if (overflow.length > 0) {
    await serverSupabase.storage.from(BUCKET).remove(overflow.map((f) => `${FOLDER}/${f.name}`));
  }

  return NextResponse.json({ data: toItem({ name: `${week}.${ext}`, updated_at: new Date().toISOString() }) });
}

// DELETE — 파일 1개 삭제 (?name=2026-07-13.jpg). 이름은 GET 이 알려준 값 그대로.
export async function DELETE(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }
  const name = new URL(req.url).searchParams.get('name');
  if (!name || name.includes('/') || name.startsWith('.')) {
    return NextResponse.json({ code: 'BAD_NAME', message: '잘못된 요청입니다' }, { status: 400 });
  }
  const { error } = await serverSupabase.storage.from(BUCKET).remove([`${FOLDER}/${name}`]);
  if (error) {
    return NextResponse.json({ code: 'DELETE_FAILED', message: '삭제 실패', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
