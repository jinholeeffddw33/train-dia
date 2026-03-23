import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { P } from '@/data/cycle';
import type { Person } from '@/lib/types';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

const serverSupabase =
  supabaseUrl && (supabaseServiceKey || supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
    : null;

const EXTRA_USERS: Person[] = [
  { I: '0', d: '', n: '이현구', s: '21711694' },
  { I: '0', d: '', n: '강병우', s: '21714898' },
  { I: '0', d: '', n: '박성아', s: '21714940' },
  { I: '0', d: '', n: '석영훈', s: '21715437' },
  { I: '0', d: '', n: '김준홍', s: '21715494' },
  { I: '0', d: '', n: '허금녀', s: '21715538' },
  { I: '0', d: '', n: '김민정', s: '21715676' },
  { I: '0', d: '', n: '최창욱', s: '21715684' },
  { I: '0', d: '', n: '이민우', s: '21716991' },
  { I: '0', d: '', n: '한태환', s: '21713547' },
  { I: '0', d: '', n: '반헌준', s: '21713554' },
  { I: '0', d: '', n: '신승헌', s: '21713568' },
  { I: '0', d: '', n: '정광구', s: '21714013' },
  { I: '0', d: '', n: '정용식', s: '21714357' },
  { I: '0', d: '', n: '이수윤', s: '21714586' },
  { I: '0', d: '', n: '김다솜', s: '22000103' },
  { I: '0', d: '', n: '하도현', s: '22000834' },
  { I: '0', d: '', n: '오현창', s: '22000850' },
  { I: '0', d: '', n: '김현진', s: '22200209' },
  { I: '0', d: '', n: '황선호', s: '21717719' },
  { I: '0', d: '', n: '이지훈', s: '21900305' },
  { I: '0', d: '', n: '장진수', s: '21707096' },
  { I: '0', d: '', n: '김봉철', s: '21707406' },
  { I: '0', d: '', n: '김창환', s: '21707420' },
  { I: '0', d: '', n: '김성준A', s: '21703825' },
  { I: '0', d: '', n: '안성숙', s: '21704630' },
  { I: '0', d: '', n: '신형식', s: '21704784' },
  { I: '0', d: '', n: '최승곤', s: '21706206' },
  { I: '0', d: '', n: '이병홍', s: '21706208' },
  { I: '0', d: '', n: '윤경일', s: '21706306' },
  { I: '0', d: '', n: '현덕일', s: '21706327' },
  { I: '0', d: '', n: '김대환', s: '21706363' },
  { I: '0', d: '', n: '김재범', s: '21707084' },
  { I: '0', d: '', n: '조재홍', s: '21709373' },
  { I: '0', d: '', n: '이승훈', s: '21711443' },
  { I: '0', d: '', n: '박종길', s: '21711719' },
  { I: '0', d: '', n: '김건래', s: '21711811' },
  { I: '0', d: '', n: '윤성애', s: '21712601' },
  { I: '0', d: '', n: '조효진', s: '21709378' },
  { I: '0', d: '', n: '신제윤', s: '21709575' },
  { I: '0', d: '', n: '김진완', s: '21709589' },
  { I: '0', d: '', n: '김윤수', s: '21709608' },
  { I: '0', d: '', n: '정성한', s: '21709635' },
  { I: '0', d: '', n: '조옥란', s: '21709649' },
  { I: '0', d: '', n: '이동복', s: '21710720' },
  { I: '0', d: '', n: '이선길', s: '21711197' },
  { I: '0', d: '', n: '전동규', s: '21711304' },
  { I: '0', d: '', n: '박용덕', s: '21711438' },
];

const ALL_USERS = [...P, ...EXTRA_USERS];

function verifyUser(name: string, sabun: string): Person | null {
  return ALL_USERS.find((p) => p.n === name && p.s === sabun) ?? null;
}

// ── POST: 댓글 등록 ──
export async function POST(
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

  const comment = (body.comment as string | undefined)?.trim();
  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();

  if (!comment || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '댓글, 이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  if (comment.length > 500) {
    return NextResponse.json(
      { code: 'COMMENT_TOO_LONG', message: '댓글은 500자 이하로 작성해주세요' },
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

  const { data, error } = await serverSupabase
    .from('hazard_comments')
    .insert({ report_id: reportId, comment, created_by: verified.n })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '댓글 등록에 실패했습니다', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
