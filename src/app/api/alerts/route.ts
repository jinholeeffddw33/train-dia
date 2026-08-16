import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRoster } from '@/data/cycle';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';
import type { Person } from '@/lib/types';

// ── 서버 전용 Supabase 클라이언트 ──
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

// service key가 있으면 service role, 없으면 anon key 사용
const serverSupabase =
  supabaseUrl && (supabaseServiceKey || supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
    : null;

const allUsers = () => [...getRoster(), ...EXTRA_USERS, ...INTERN_USERS];

/**
 * 이름 + 사번 매칭 검증.
 * lib/auth 의 verifyUser 를 쓰면 안 된다 — 그쪽은 모르는 사번도 통과시키는(로그인용) 관대한 버전이라
 * 여기 필요한 "일치하지 않으면 null" 이 성립하지 않는다.
 */
function verifyUser(name: string, sabun: string): Person | null {
  return allUsers().find((p) => p.n === name && p.s === sabun) ?? null;
}

// ── POST: 알림 등록 ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 연결이 설정되지 않았습니다' },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const { name, sabun, stationFrom, stationTo, direction, message, severity, expiresAt } =
    body as {
      name?: string;
      sabun?: string;
      stationFrom?: string;
      stationTo?: string;
      direction?: string;
      message?: string;
      severity?: string;
      expiresAt?: string | null;
    };

  // 필수값 검증
  if (!name || !sabun || !message) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '이름, 사번, 메시지는 필수입니다' },
      { status: 400 },
    );
  }

  // 🔒 핵심: 이름 + 사번 매칭 검증
  const verified = verifyUser(name.trim(), sabun.trim());
  if (!verified) {
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '이름과 사번이 일치하지 않습니다' },
      { status: 403 },
    );
  }

  // Supabase insert — 서버에서 검증된 이름 사용
  const { data, error } = await serverSupabase
    .from('alerts')
    .insert({
      station_from: stationFrom || '',
      station_to: stationTo || '',
      direction: direction || '',
      station: stationFrom || '',
      message: message.trim(),
      severity: severity || 'medium',
      created_by: verified.n, // 서버에서 확인된 이름만 사용
      is_active: true,
      expires_at: expiresAt || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '알림 등록에 실패했습니다', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}

// ── DELETE: 알림 해제 ──
export async function DELETE(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 연결이 설정되지 않았습니다' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const name = searchParams.get('name');
  const sabun = searchParams.get('sabun');

  if (!id || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: 'id, name, sabun은 필수입니다' },
      { status: 400 },
    );
  }

  // 🔒 이름 + 사번 검증
  const verified = verifyUser(name.trim(), sabun.trim());
  if (!verified) {
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '이름과 사번이 일치하지 않습니다' },
      { status: 403 },
    );
  }

  // 본인이 만든 알림인지 확인
  const { data: alert } = await serverSupabase
    .from('alerts')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!alert || alert.created_by !== verified.n) {
    return NextResponse.json(
      { code: 'NOT_OWNER', message: '본인이 등록한 알림만 해제할 수 있습니다' },
      { status: 403 },
    );
  }

  const { error } = await serverSupabase
    .from('alerts')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: '알림 해제에 실패했습니다' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
