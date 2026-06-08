/**
 * 키워드 매칭 인텐트. 정규식 또는 다중 키워드 ALL/ANY.
 * 최상단부터 우선 매칭 (구체적인 것 먼저).
 */

export type IntentId =
  // 날씨
  | 'weather_today' | 'weather_tomorrow' | 'weather_week' | 'rain_today' | 'rain_tomorrow' | 'temp_now'
  // 교번·스케줄
  | 'shift_today' | 'shift_tomorrow' | 'shift_after_tomorrow' | 'shift_week'
  | 'in_time_today' | 'in_time_tomorrow' | 'out_time_today'
  | 'next_rest' | 'next_work' | 'depot_today'
  | 'month_summary' | 'rest_count' | 'work_count'
  // 동료
  | 'partner_today' | 'partner_tomorrow' | 'office_today'
  // 일상
  | 'fortune' | 'stamp' | 'lunch' | 'mission_card'
  // 기본
  | 'greeting' | 'thanks' | 'bye' | 'help' | 'about_bot' | 'fallback';

export interface IntentRule {
  id: IntentId;
  /** 모두 포함되어야 매칭 */
  all?: string[];
  /** 하나라도 포함되면 매칭 */
  any?: string[];
  /** 정규식 (any/all과 OR 조건) */
  re?: RegExp;
}

/** 위에서부터 매칭 — 구체적인 인텐트 먼저 배치 */
export const INTENT_RULES: IntentRule[] = [
  // ── 날씨 (시간 표현 우선) ──
  { id: 'rain_tomorrow', all: ['내일'], any: ['비', '우산'] },
  { id: 'rain_today',    any: ['비 와', '비올', '비 올', '비온', '비오나', '우산', '비 옴'] },
  { id: 'weather_week',  any: ['주말 날씨', '이번 주 날씨', '주간 날씨', '주 날씨', '이번주 날씨', '7일 날씨', '일주일 날씨'] },
  { id: 'weather_tomorrow', all: ['내일'], any: ['날씨', '기온', '온도'] },
  { id: 'weather_today',  any: ['오늘 날씨', '지금 날씨', '현재 날씨', '오늘 기온', '지금 기온', '날씨 어때', '날씨 어떄'] },
  { id: 'temp_now',       any: ['몇 도', '몇도', '온도 얼마'] },

  // ── 교번·스케줄 ──
  { id: 'shift_after_tomorrow', all: ['모레'], any: ['교번', '근무', '다이아'] },
  { id: 'shift_tomorrow',       all: ['내일'], any: ['교번', '근무', '다이아', '뭐 해', '뭐해'] },
  { id: 'shift_week',           any: ['이번 주 교번', '이번주 교번', '이번 주 근무', '이번주 근무', '이번주 일정', '이번 주 일정'] },
  { id: 'shift_today',          any: ['오늘 교번', '오늘 다이아', '오늘 근무', '오늘 뭐', '오늘 뭐야', '오늘 다이야', '내 교번', '오늘의 교번'] },

  { id: 'in_time_tomorrow', all: ['내일'], any: ['출근'] },
  { id: 'in_time_today',    any: ['몇 시 출근', '몇시 출근', '출근 몇 시', '출근 몇시', '오늘 출근', '출근 시간'] },
  { id: 'out_time_today',   any: ['퇴근 몇', '퇴근 시간', '오늘 퇴근', '몇 시 퇴근', '몇시 퇴근'] },

  { id: 'next_rest', any: ['다음 휴무', '다음 쉬는날', '다음 쉬는 날', '쉬는 날 언제', '휴무 언제', '언제 쉬어'] },
  { id: 'next_work', any: ['다음 근무', '다음 출근', '언제 출근', '다음 일'] },
  { id: 'depot_today', any: ['기지 출근', '기지출근', '오늘 기지', '고덕 기지'] },

  { id: 'month_summary', any: ['이번 달 근무', '이번달 근무', '한 달 근무', '한달 근무', '월간 근무', '근무 며칠'] },
  { id: 'rest_count',    any: ['휴무 며칠', '쉬는 날 며칠', '이번 달 휴무'] },
  { id: 'work_count',    any: ['근무일 며칠', '며칠 일해', '며칠 근무'] },

  // ── 동료·내근 ──
  { id: 'partner_tomorrow', all: ['내일'], any: ['교대', '동료', '같이', '파트너'] },
  { id: 'partner_today',    any: ['오늘 교대', '교대자', '오늘 동료', '오늘 같이', '오늘 파트너', '같이 근무', '같이 일해'] },
  { id: 'office_today',     any: ['오늘 내근', '내근 누구', '본소 누구', '기지 누구', '관제 누구'] },

  // ── 일상 보조 (모듈 연결) ──
  { id: 'fortune', any: ['운세', '오늘의 운세', '오늘운세'] },
  { id: 'stamp',   any: ['도장', '출근 도장', '출근도장', '몇 일 찍'] },
  { id: 'lunch',   any: ['점심', '뭐 먹지', '뭐먹지', '메뉴 추천', '식당'] },
  { id: 'mission_card', any: ['임무카드', '임무 카드', '재난', '비상 카드'] },

  // ── 기본 ──
  { id: 'greeting', any: ['안녕', '하이', '헬로', '하잉', '안냥'] },
  { id: 'thanks',   any: ['고마워', '감사', '땡큐', '쌩큐', '고맙'] },
  { id: 'bye',      any: ['잘 가', '잘가', '안녕히', '잘 자', '잘자', '바이'] },
  { id: 'help',     any: ['뭐 할 수', '뭘 할 수', '뭐 할수', '도움말', '사용법', '뭐 물어', '어떻게 써'] },
  { id: 'about_bot', any: ['넌 누구', '너 누구', '챗봇', '봇이야'] },
];

/** 입력 텍스트 정규화 — 공백·구두점 제거, 소문자 */
function normalize(text: string): string {
  return text.replace(/[?!.,…~^]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function ruleMatches(rule: IntentRule, text: string): boolean {
  const t = ' ' + text + ' ';
  // 정규식 우선
  if (rule.re && rule.re.test(text)) return true;
  // all + any 둘 다 있으면 AND: all 전부 매치 AND any 중 하나 매치
  // all만 있으면 all 전부, any만 있으면 any 중 하나
  const hasAll = !!rule.all && rule.all.length > 0;
  const hasAny = !!rule.any && rule.any.length > 0;
  if (!hasAll && !hasAny) return false;
  const allOk = !hasAll || rule.all!.every((k) => t.includes(k.toLowerCase()));
  const anyOk = !hasAny || rule.any!.some((k) => t.includes(k.toLowerCase()));
  return allOk && anyOk;
}

export function matchIntent(input: string): IntentId {
  const text = normalize(input);
  if (!text) return 'fallback';
  for (const rule of INTENT_RULES) {
    if (ruleMatches(rule, text)) return rule.id;
  }
  return 'fallback';
}

/** 사용자에게 보여줄 빠른 추천 질문 */
export const QUICK_QUESTIONS: string[] = [
  '오늘 날씨',
  '내일 비 와?',
  '오늘 교번',
  '내일 교번',
  '다음 휴무',
  '오늘 출근 몇 시?',
  '이번 달 근무 며칠?',
  '오늘 운세',
];
