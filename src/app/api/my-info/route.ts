/**
 * 내 정보 — 한 사람의 민원 등급·개인 통계를 한 번에 (설정 → 내 정보).
 *
 * GET ?sabun=XXXX (없으면 본인) → MyInfoData
 * 개인정보라 본인만 본다. 다른 사람은 소장·부소장·관리자 계정만 (src/features/myinfo/lib/myInfoAccess.ts).
 * ★ 막는 곳은 여기다 — 화면에서 사람 고르기 칸을 숨기는 것만으로는 주소창 조작을 못 막는다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, parseQuery, ERROR_CODES } from '@/lib/api/response';
import { canViewInfoOf } from '@/features/myinfo/lib/myInfoAccess';
import type { Stage } from '@/features/myinfo/lib/complaintStages';
import type { ComplaintCase, MyInfoData } from '@/features/myinfo/lib/myInfoTypes';
import { getRoster } from '@/data/cycle';
import { officeUsers, internUsers, getUserRole } from '@/lib/auth';
import { workersOn } from '@/lib/rollcallReaders';
import { VISIT_ACTIONS, getKstDayStart, kstDay, dayKST } from '@/lib/visitStats';

const Query = z.object({ sabun: z.string().regex(/^[0-9A-Za-z]{4,10}$/).optional() });

const DOOR_KINDS = new Set(['신체끼임', '문닫힘', '물건끼임']);
const DRIVING_TAGS = new Set(['시설물', '열차', '신호']);
const TRAIN_TAG_RE = /^(?:\d+|전)편성$/;
const ROLLCALL_START = '2026-09-21'; // 점호 읽음 기록이 시작된 날 (rollcall_reads 마이그레이션)
const GAME_LABEL: Record<string, string> = {
  apex: 'APEX RUSH', snake: '사과 먹기', reaction: '반응속도', mental: '암산 스프린트', simon: '색깔 따라하기',
  halli: '할리갈리', speed: '스피드 마스터', breaker: '차단기 마스터', omok: '오목', reversi: '오델로',
};

function firstLine(desc: string | null) {
  return ((desc ?? '').replace(/\r\n?/g, '\n').split('\n')[0] ?? '').trim();
}
function tagOf(desc: string | null) {
  const m = firstLine(desc).match(/^\[([^\]]+)\]/);
  return m ? m[1].trim() : '';
}
function titleOf(desc: string | null, location: string | null) {
  const t = firstLine(desc).replace(/^\[[^\]]+\]\s*/, '');
  const no = location && /^\d+호$/.test(location) ? `${location} ` : '';
  return `${no}${t}`.trim() || '운전정보';
}
function quarterOf(d: string) {
  const y = d.slice(0, 4), q = Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1;
  return { key: `${y}-Q${q}`, label: `${y}년 ${q}분기` };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const q = parseQuery(req.url, Query);
  if (!q.ok) return q.response;
  const target = q.data.sabun ?? auth.sabun;
  if (!canViewInfoOf({ sabun: auth.sabun, role: auth.role }, target)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '내 정보는 본인만 볼 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 불러올 수 없어요. 잠시 후 다시 시도해주세요');
  }
  const sb = serverSupabase;

  try {
    const known = [...getRoster(new Date()), ...officeUsers(), ...internUsers()].find((p) => p.s === target);
    const { data: profile } = await sb.from('driver_profiles').select('id, name').eq('sabun', target).maybeSingle();
    const name = known?.n ?? (profile as { name?: string } | null)?.name ?? (target === auth.sabun ? auth.name : '');
    if (!name) return errorResponse(ERROR_CODES.NOT_FOUND, '그 사번의 직원을 찾지 못했어요');

    const since90 = getKstDayStart(89);
    const [cp, allCp, cases, inspect, reads, rcReads, quiz, levels, integ, scores, fame, multi, rides, visits, firstLogin] = await Promise.all([
      sb.from('complaint_people').select('*').eq('sabun', target).maybeSingle(),
      sb.from('complaint_people').select('door_events, all_events, door_stage, all_stage, period_from, period_to'),
      sb.from('complaint_cases').select('case_date, kind, kinds, flags, station, time_band, direction, train_no, content, shared')
        .eq('sabun', target).order('case_date', { ascending: false }),
      sb.from('hazard_reports').select('id, description, location, created_at').eq('category', 'inspect').order('created_at', { ascending: false }),
      sb.from('hazard_reads').select('report_id').eq('user_sabun', target),
      sb.from('rollcall_reads').select('read_date').eq('sabun', target).gte('read_date', ROLLCALL_START),
      sb.from('edu_quiz_results').select('mode, score, total, percent, solved_at').eq('sabun', target).order('solved_at', { ascending: false }),
      sb.from('level_records').select('level_name, score, passed, created_at').eq('sabun', target).order('created_at', { ascending: false }).limit(10),
      sb.from('integrity_quiz_submissions').select('score, total, created_at').eq('sabun', target).order('created_at', { ascending: false }).limit(1),
      sb.from('game_scores').select('game, score').eq('sabun', target),
      sb.from('game_hall_of_fame').select('game, year, month, rank').eq('sabun', target).order('year', { ascending: false }).order('month', { ascending: false }),
      sb.from('multi_game_ratings').select('game, rating, wins, losses').eq('sabun', target),
      sb.from('jido_rides').select('ride_date').eq('driver_sabun', target).order('ride_date', { ascending: false }),
      profile ? sb.from('audit_log').select('created_at').eq('user_id', (profile as { id: string }).id)
        .in('action', VISIT_ACTIONS as unknown as string[]).gte('created_at', since90).order('created_at', { ascending: false }).limit(2000)
        : Promise.resolve({ data: [], error: null }),
      profile ? sb.from('audit_log').select('created_at').eq('user_id', (profile as { id: string }).id).eq('action', 'first_login').order('created_at').limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [cp, allCp, cases, inspect, reads, rcReads, quiz, levels, integ, scores, fame, rides]) {
      if (r.error) return internalError(r.error, 'my-info GET');
    }

    // ── 민원 ──
    type PeopleRow = { door_events: number; all_events: number; door_stage: Stage; all_stage: Stage; period_from: string; period_to: string };
    const everyone = (allCp.data as PeopleRow[] | null) ?? [];
    const me = cp.data as (PeopleRow & {
      door_complaints: number; all_complaints: number; praise: number; injury: number; mgmt: string;
      detail: { types?: Record<string, number>; mainStations?: string; mainTimes?: string; otherComplaints?: string; chance?: string };
      first_date: string | null; last_date: string | null;
    }) | null;
    const caseRows = ((cases.data as {
      case_date: string | null; kind: string; kinds: string; flags: string; station: string; time_band: string;
      direction: string; train_no: string; content: string; shared: boolean;
    }[] | null) ?? []);
    const caseList: ComplaintCase[] = caseRows.map((c) => ({
      date: c.case_date, kind: c.kind, kinds: c.kinds, flags: c.flags, station: c.station, timeBand: c.time_band,
      direction: c.direction, trainNo: c.train_no, content: c.content, shared: c.shared,
    }));
    const years = new Map<string, { door: number; all: number }>();
    for (const c of caseRows) {
      const y = c.case_date?.slice(0, 4); if (!y || c.kind === '칭찬') continue;
      const v = years.get(y) ?? { door: 0, all: 0 };
      v.all++; if (DOOR_KINDS.has(c.kind)) v.door++;
      years.set(y, v);
    }
    const dist = (key: 'door_stage' | 'all_stage') => [1, 2, 3, 4, 5, 6, 7].map((s) => everyone.filter((p) => p[key] === s).length);
    const avg = (key: 'door_events' | 'all_events') =>
      everyone.length ? Math.round((everyone.reduce((a, p) => a + p[key], 0) / everyone.length) * 10) / 10 : 0;

    // ── 안전: 운전정보 · 열차정보 읽음 ──
    const readSet = new Set(((reads.data as { report_id: string }[] | null) ?? []).map((r) => String(r.report_id)));
    const posts = ((inspect.data as { id: string; description: string | null; location: string | null; created_at: string }[] | null) ?? []);
    const driving = posts.filter((p) => DRIVING_TAGS.has(tagOf(p.description)));
    const trainPosts = posts.filter((p) => TRAIN_TAG_RE.test(tagOf(p.description)));
    const unreadDriving = driving.filter((p) => !readSet.has(String(p.id)));

    // ── 점호: 최근 30일(기록 시작일 이후) 근무일 중 읽은 날 ──
    const rcDays = new Set(((rcReads.data as { read_date: string }[] | null) ?? []).map((r) => r.read_date.slice(0, 10)));
    let workDays = 0, readDays = 0, days = 0;
    for (let i = 0; i < 30; i++) {
      const d = dayKST(i);
      if (d < ROLLCALL_START) break;
      days++;
      const [y, m, dd] = d.split('-').map(Number);
      if (!workersOn(new Date(y, m - 1, dd, 12)).some((w) => w.sabun === target)) continue;
      workDays++; if (rcDays.has(d)) readDays++;
    }

    // ── 접속 ──
    const visitTimes = ((visits.data as { created_at: string }[] | null) ?? []).map((v) => v.created_at);
    const visitDays = new Set(visitTimes.map(kstDay));
    const since30 = dayKST(29);

    // ── 교육 ──
    const quizRows = ((quiz.data as { mode: string; score: number; total: number; percent: number; solved_at: string }[] | null) ?? []);
    const integRow = ((integ.data as { score: number; total: number; created_at: string }[] | null) ?? [])[0];

    // ── 게임 ── (game_scores 는 지난달 기록을 매달 정리한다 → 이번 달 기록)
    const best = new Map<string, { score: number; plays: number }>();
    for (const s of ((scores.data as { game: string; score: number }[] | null) ?? [])) {
      const low = s.game === 'reaction', cur = best.get(s.game);
      if (!cur) best.set(s.game, { score: s.score, plays: 1 });
      else best.set(s.game, { score: low ? Math.min(cur.score, s.score) : Math.max(cur.score, s.score), plays: cur.plays + 1 });
    }

    // ── 지도승무 ──
    const rideDates = ((rides.data as { ride_date: string }[] | null) ?? []).map((r) => r.ride_date.slice(0, 10));
    const nowQ = quarterOf(dayKST(0));

    const data: MyInfoData = {
      person: { sabun: target, name, role: getUserRole(target).replace(/님$/, '') },
      viewingOther: target !== auth.sabun,
      complaint: {
        info: me ? {
          doorEvents: me.door_events, doorComplaints: me.door_complaints, allEvents: me.all_events, allComplaints: me.all_complaints,
          praise: me.praise, injury: me.injury, doorStage: me.door_stage, allStage: me.all_stage, mgmt: me.mgmt,
          types: me.detail?.types ?? {}, mainStations: me.detail?.mainStations ?? '', mainTimes: me.detail?.mainTimes ?? '',
          otherComplaints: me.detail?.otherComplaints ?? '', chance: me.detail?.chance ?? '',
          firstDate: me.first_date, lastDate: me.last_date,
          byYear: [...years.entries()].sort().map(([year, v]) => ({ year, ...v })),
          cases: caseList,
        } : null,
        summary: everyone.length ? {
          periodFrom: everyone[0].period_from, periodTo: everyone[0].period_to, people: everyone.length,
          avgDoor: avg('door_events'), avgAll: avg('all_events'),
          doorDist: dist('door_stage'), allDist: dist('all_stage'),
          doorMore: me ? everyone.filter((p) => p.door_events > me.door_events).length : 0,
          doorSame: me ? everyone.filter((p) => p.door_events === me.door_events).length : 0,
        } : null,
      },
      safety: {
        driving: {
          total: driving.length, read: driving.length - unreadDriving.length, unread: unreadDriving.length,
          unreadTitles: unreadDriving.slice(0, 5).map((p) => ({ id: String(p.id), title: titleOf(p.description, p.location), date: kstDay(p.created_at) })),
        },
        train: { total: trainPosts.length, read: trainPosts.filter((p) => readSet.has(String(p.id))).length, unread: trainPosts.filter((p) => !readSet.has(String(p.id))).length },
        rollcall: { days, workDays, readDays },
      },
      activity: {
        visitDays30: [...visitDays].filter((d) => d >= since30).length,
        visitDays90: visitDays.size,
        lastVisit: visitTimes[0] ?? null,
        firstLogin: ((firstLogin.data as { created_at: string }[] | null) ?? [])[0]?.created_at ?? null,
      },
      edu: {
        quiz: {
          count: quizRows.length,
          avg: quizRows.length ? Math.round(quizRows.reduce((a, r) => a + r.percent, 0) / quizRows.length) : 0,
          best: quizRows.length ? Math.max(...quizRows.map((r) => r.percent)) : 0,
          recent: quizRows.slice(0, 5).map((r) => ({ mode: r.mode, percent: r.percent, score: r.score, total: r.total, at: r.solved_at })),
        },
        levels: ((levels.data as { level_name: string; score: number; passed: boolean; created_at: string }[] | null) ?? [])
          .map((l) => ({ name: l.level_name, score: l.score, passed: l.passed, at: l.created_at })),
        integrity: integRow ? { score: integRow.score, total: integRow.total, at: integRow.created_at } : null,
      },
      games: {
        best: [...best.entries()].map(([game, v]) => ({ game, label: GAME_LABEL[game] ?? game, score: v.score, lowerIsBetter: game === 'reaction', plays: v.plays })),
        fame: ((fame.data as { game: string; year: number; month: number; rank: number }[] | null) ?? [])
          .map((f) => ({ ...f, label: GAME_LABEL[f.game] ?? f.game })),
        multi: (multi.error ? [] : ((multi.data as { game: string; rating: number; wins: number; losses: number }[] | null) ?? []))
          .map((m) => ({ ...m, label: GAME_LABEL[m.game] ?? m.game })),
      },
      jido: {
        quarter: nowQ.label,
        quarterCount: rideDates.filter((d) => quarterOf(d).key === nowQ.key).length,
        total: rideDates.length,
        last: rideDates[0] ?? null,
      },
    };
    return okJson(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return internalError(e, 'my-info GET');
  }
}
