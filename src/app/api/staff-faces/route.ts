/**
 * 직원 얼굴 찾기 — GET → StaffFacesResponse
 *
 * 로그인한 직원만(체험 계정 제외). 다이아 앱 «지금 명단»에 있는 사람만, 사진은 1시간짜리 서명 주소로.
 * 사진 원본: gw_seniors(기관사 나침반 «선배 찾기», 보관함 gw-seniors) + 신규 인턴 dia-faces/interns.
 * 자세한 사정은 src/features/more/lib/staffFaces.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, ERROR_CODES } from '@/lib/api/response';
import { getRoster } from '@/data/cycle';
import { officeUsers, internUsers, getUserRole } from '@/lib/auth';
import { isGuest } from '@/lib/guestAccount';
import {
  EXTRA_FACES, EXTRA_FACE_BUCKET, baseName, type StaffFace, type StaffFacesResponse,
} from '@/features/more/lib/staffFaces';

const SENIOR_BUCKET = 'gw-seniors';
const TTL = 3600;

async function sign(bucket: string, paths: string[]): Promise<Map<string, string>> {
  if (!serverSupabase || paths.length === 0) return new Map();
  const { data, error } = await serverSupabase.storage.from(bucket).createSignedUrls(paths, TTL);
  if (error) throw error;
  return new Map((data ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path!, s.signedUrl]));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (isGuest(auth.sabun)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '직원 얼굴은 사업소 직원만 볼 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 불러올 수 없어요. 잠시 후 다시 시도해주세요');
  }

  try {
    // 지금 명단 — 같은 이름(김성준A·B)은 한 칸으로 묶는다
    const groups = new Map<string, { sabuns: string[] }>();
    for (const p of [...getRoster(new Date()), ...officeUsers(), ...internUsers()]) {
      if (!p.s || /^결원/.test(p.n) || isGuest(p.s)) continue;
      const name = baseName(p.n);
      const g = groups.get(name) ?? { sabuns: [] };
      if (!g.sabuns.includes(p.s)) g.sabuns.push(p.s);
      groups.set(name, g);
    }

    const { data, error } = await serverSupabase
      .from('gw_seniors')
      .select('name, photo, sort')
      .eq('active', true)
      .order('sort');
    if (error) return internalError(error, 'staff-faces gw_seniors');
    const byName = new Map<string, string[]>();
    for (const r of (data as { name: string; photo: string }[] | null) ?? []) {
      if (!groups.has(r.name)) continue; // 명단에 없는 사람(퇴직·전출) 사진은 내보내지 않는다
      byName.set(r.name, [...(byName.get(r.name) ?? []), r.photo]);
    }

    const seniorUrls = await sign(SENIOR_BUCKET, [...byName.values()].flat());
    const extraUrls = await sign(EXTRA_FACE_BUCKET, Object.values(EXTRA_FACES));

    const people: StaffFace[] = [...groups.entries()].map(([name, g]) => {
      const photos = (byName.get(name) ?? []).map((p) => seniorUrls.get(p) ?? '').filter(Boolean);
      if (photos.length === 0) {
        for (const s of g.sabuns) {
          const extra = EXTRA_FACES[s] && extraUrls.get(EXTRA_FACES[s]);
          if (extra) photos.push(extra);
        }
      }
      const roles = [...new Set(g.sabuns.map((s) => getUserRole(s).replace(/님$/, '')))];
      return { key: g.sabuns[0], name, role: roles.join('·'), photos, same: g.sabuns.length };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const out: StaffFacesResponse = { people, withPhoto: people.filter((p) => p.photos.length > 0).length };
    return okJson(out, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return internalError(e, 'staff-faces GET');
  }
}
