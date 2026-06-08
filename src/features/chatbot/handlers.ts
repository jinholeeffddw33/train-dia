/**
 * 인텐트별 답변 생성 핸들러. 모두 동기 또는 Promise<string>.
 */

import type { Person } from '@/lib/types';
import { getDia, getSchedule, getType, getDiaDisplay, getMonthSummary, isHoliday } from '@/lib/schedule';
import {
  fetchWeather, formatWeatherNow, formatWeatherToday, formatWeatherTomorrow,
  formatWeatherWeek, formatRainAnswer,
} from './weather';
import type { IntentId } from './intents';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(d: Date): string {
  const dow = DOW[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${dow})`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diaLabel(dia: string): string {
  if (!dia) return '미배정';
  if (dia.startsWith('휴')) return dia;
  if (dia.startsWith('대')) return `대기 ${dia.slice(1)}`;
  if (dia === '비') return '비번';
  if (/^[주야]/.test(dia)) return dia; // 내근직 라벨
  return getDiaDisplay(dia);
}

function typeName(dia: string): string {
  const t = getType(dia);
  if (t === 'day') return '주간';
  if (t === 'night') return '야간';
  if (t === 'standby') return '대기';
  if (t === 'rest') return dia.startsWith('휴') ? '휴무' : '비번';
  return '';
}

function describeDay(person: Person, date: Date): string {
  const dia = getDia(person, date);
  if (!dia) return `${fmtDate(date)} 정보 없음`;
  const tp = getType(dia);
  const sched = getSchedule(dia, date);
  const label = diaLabel(dia);
  const tname = typeName(dia);
  let line = `📆 ${fmtDate(date)} · ${label}`;
  if (tname && tname !== '휴무' && tname !== '비번') line += ` (${tname})`;
  if (sched && tp !== 'rest' && sched.s && sched.e && /\d/.test(sched.s)) {
    line += `\n⏰ 출근 ${sched.s} → 퇴근 ${sched.e}`;
    if (sched.w) line += ` · 근무 ${sched.w}`;
  }
  return line;
}

function describeTimeOnly(person: Person, date: Date, which: 'in' | 'out'): string {
  const dia = getDia(person, date);
  if (!dia) return '교번 정보가 없어요';
  const sched = getSchedule(dia, date);
  if (!sched) return `${fmtDate(date)}는 ${diaLabel(dia)} (운행 일정 없음)`;
  if (which === 'in') return `⏰ ${fmtDate(date)} 출근 ${sched.s}`;
  return `⏰ ${fmtDate(date)} 퇴근 ${sched.e}`;
}

function findNextRest(person: Person, from: Date): Date | null {
  for (let i = 1; i <= 60; i++) {
    const d = addDays(from, i);
    const dia = getDia(person, d);
    if (dia && (dia.startsWith('휴') || dia === '비')) return d;
  }
  return null;
}

function findNextWork(person: Person, from: Date): { date: Date; dia: string } | null {
  for (let i = 1; i <= 60; i++) {
    const d = addDays(from, i);
    const dia = getDia(person, d);
    if (!dia) continue;
    const t = getType(dia);
    if (t === 'day' || t === 'night') return { date: d, dia };
  }
  return null;
}

function countByType(person: Person, year: number, month: number) {
  const summary = getMonthSummary(person, year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  let rest = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dia = getDia(person, date);
    if (dia && dia.startsWith('휴')) rest++;
  }
  return { ...summary, rest, total: daysInMonth };
}

export interface HandlerContext {
  driver: Person | null;
  /** 기준 '오늘'. 테스트 가능성 위해 주입 */
  today: Date;
  /** 라이프 모듈 진입 콜백 (옵션) */
  navigate?: (target: 'fortune' | 'stamp' | 'mission' | 'lunch') => void;
}

/** 인텐트 → 답변 문자열 (또는 Promise) */
export async function handleIntent(intent: IntentId, ctx: HandlerContext): Promise<string> {
  const { driver, today } = ctx;
  const tomorrow = addDays(today, 1);
  const afterTomorrow = addDays(today, 2);

  switch (intent) {
    // ── 날씨 ──
    case 'temp_now': {
      try { const w = await fetchWeather(); return formatWeatherNow(w); }
      catch { return '날씨 정보를 불러올 수 없어요'; }
    }
    case 'weather_today': {
      try { const w = await fetchWeather(); return `${formatWeatherNow(w)}\n${formatWeatherToday(w)}`; }
      catch { return '날씨 정보를 불러올 수 없어요'; }
    }
    case 'weather_tomorrow': {
      try { const w = await fetchWeather(); return formatWeatherTomorrow(w); }
      catch { return '날씨 정보를 불러올 수 없어요'; }
    }
    case 'weather_week': {
      try { const w = await fetchWeather(); return formatWeatherWeek(w); }
      catch { return '날씨 정보를 불러올 수 없어요'; }
    }
    case 'rain_today': {
      try { const w = await fetchWeather(); return formatRainAnswer(w, 'today'); }
      catch { return '날씨 정보를 불러올 수 없어요'; }
    }
    case 'rain_tomorrow': {
      try { const w = await fetchWeather(); return formatRainAnswer(w, 'tomorrow'); }
      catch { return '날씨 정보를 불러올 수 없어요'; }
    }

    // ── 교번·스케줄 ──
    case 'shift_today':
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      return describeDay(driver, today);
    case 'shift_tomorrow':
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      return describeDay(driver, tomorrow);
    case 'shift_after_tomorrow':
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      return describeDay(driver, afterTomorrow);
    case 'shift_week': {
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      const lines: string[] = ['📅 이번 주 (오늘부터 7일)'];
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        const dia = getDia(driver, d);
        lines.push(`· ${fmtDate(d)} ${diaLabel(dia)}`);
      }
      return lines.join('\n');
    }
    case 'in_time_today':
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      return describeTimeOnly(driver, today, 'in');
    case 'in_time_tomorrow':
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      return describeTimeOnly(driver, tomorrow, 'in');
    case 'out_time_today':
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      return describeTimeOnly(driver, today, 'out');

    case 'next_rest': {
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      const d = findNextRest(driver, today);
      if (!d) return '60일 안에 휴무가 없어요 (?)';
      const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
      const dia = getDia(driver, d);
      return `🛌 다음 휴무는 ${fmtDate(d)} (${diff}일 후) · ${dia}`;
    }
    case 'next_work': {
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      const w = findNextWork(driver, today);
      if (!w) return '60일 안에 근무가 없어요 (?)';
      const sched = getSchedule(w.dia, w.date);
      const diff = Math.round((w.date.getTime() - today.getTime()) / 86400000);
      let line = `🚆 다음 근무는 ${fmtDate(w.date)} (${diff}일 후) · ${getDiaDisplay(w.dia)}`;
      if (sched?.s) line += ` · 출근 ${sched.s}`;
      return line;
    }
    case 'depot_today': {
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      const dia = getDia(driver, today);
      const sched = getSchedule(dia, today);
      const isDepot = !!sched?.m?.startsWith('기');
      return isDepot
        ? `⛏️ 오늘은 고덕기지 출근이에요. 출근 ${sched?.s} · 다이아 ${getDiaDisplay(dia)}\n답십리가 아닌 기지로 가야 해요`
        : `🚆 오늘은 기지 출근 아니에요 (답십리 출근). 다이아 ${diaLabel(dia)}`;
    }

    case 'month_summary':
    case 'work_count': {
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      const c = countByType(driver, today.getFullYear(), today.getMonth() + 1);
      return `📊 ${today.getMonth() + 1}월 근무 현황\n· 주간 ${c.dayWork}일 · 야간 ${c.nightWork}일 · 대기 ${c.dayStandby + c.nightStandby}일 · 휴무 ${c.rest}일 (총 ${c.total}일)`;
    }
    case 'rest_count': {
      if (!driver) return '기관사 로그인 후에 답할 수 있어요';
      const c = countByType(driver, today.getFullYear(), today.getMonth() + 1);
      return `🛌 ${today.getMonth() + 1}월 휴무 ${c.rest}일`;
    }

    // ── 동료 (현재는 자체 데이터로 정확한 매칭 어려움 — 안내만) ──
    case 'partner_today':
    case 'partner_tomorrow':
      return '교대자 자동 매칭은 아직 준비 중이에요. 캘린더 탭 하단 "오늘의 내근 근무" 카드에서 본소·기지·관제 담당자를 확인할 수 있어요';
    case 'office_today':
      return '캘린더 탭 아래 "오늘의 내근 근무" 카드에서 본소·기지·기지관제 주야 담당자를 확인하세요';

    // ── 모듈 연결 ──
    case 'fortune':
      ctx.navigate?.('fortune');
      return '🔮 라이프 > 오늘의 운세에서 확인하세요. (라이프 메뉴로 이동해보세요)';
    case 'stamp':
      ctx.navigate?.('stamp');
      return '🗿 라이프 > 무사고 출근 도장에서 확인 가능해요';
    case 'lunch':
      return '🍱 점심 추천 기능은 준비 중이에요. 동료에게 물어보는 게 더 빠를지도?';
    case 'mission_card':
      return '🛡️ 캘린더 탭 우측 상단의 "개인별 임무카드" 버튼을 눌러 본인 카드를 확인하세요';

    // ── 기본 ──
    case 'greeting': {
      const h = today.getHours();
      if (h < 6) return '🌙 안녕하세요. 야간 근무 중이신가요? 무사고 운행 응원합니다';
      if (h < 12) return '☀️ 안녕하세요. 좋은 아침이에요';
      if (h < 18) return '👋 안녕하세요. 어떤 도움이 필요하세요?';
      return '🌆 안녕하세요. 오늘 하루도 수고하셨어요';
    }
    case 'thanks':
      return '💙 별말씀을요. 또 필요한 거 있으면 물어봐주세요';
    case 'bye':
      return '👋 안전 운행 하세요!';
    case 'about_bot':
      return '저는 답십리 일상 도우미예요. 날씨·교번·출퇴근 시각 같은 일상 질문에 답해드려요. 규정 같은 지식 질문은 [규정] 메뉴를 활용하세요';
    case 'help':
      return '제가 답할 수 있는 것:\n· 오늘/내일 날씨, 비 올지\n· 오늘/내일/이번 주 교번\n· 출근·퇴근 시각\n· 다음 휴무, 다음 근무\n· 이번 달 근무 요약\n· 기지 출근 여부\n· 운세·도장·임무카드 안내';

    case 'fallback':
    default:
      return '음… 그 질문은 잘 모르겠어요 😅\n"오늘 날씨", "내일 교번", "다음 휴무" 같은 일상 질문을 물어봐주세요.\n도움말이 필요하면 "뭐 할 수 있어?"라고 물어보세요';
  }
}

// helper: isHoliday 사용 시 import 보존 (트리쉐이킹 방지)
export const _holidayCheck = isHoliday;
