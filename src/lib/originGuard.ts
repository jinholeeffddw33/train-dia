/**
 * Origin 킬 스위치 — 등록되지 않은(무단 복제) 도메인에서 앱이 뜨면 차단.
 *
 * 설계 원칙(실사용자 오차단 방지가 최우선):
 *  1. 화이트리스트는 넉넉하게 — dia5.kr·서브도메인, *.vercel.app, localhost, 사설 LAN.
 *  2. 판단 불가/오류 시 fail-open — 절대 정상 사용자를 막지 않는다.
 *  3. 비상 해제: 환경변수 NEXT_PUBLIC_DISABLE_ORIGIN_GUARD='1' 로 즉시 무력화.
 *  4. 차단은 DOM 오버레이로 — 복제본에 "무단 복제본" 전면 안내를 띄운다.
 *
 * ⚠️ 무단 복제 방지 장치. 변경/삭제 금지. @/lib/provenance 와 함께 동작.
 */

import { WATERMARK, COPYRIGHT_NOTICE } from './provenance';

/** 정식 배포 도메인 — 여기에 없는 호스트는 무단 복제본으로 간주 */
const ALLOWED_SUFFIXES = [
  'dia5.kr', // 정식 도메인 + 모든 서브도메인
  'vercel.app', // Vercel 프로덕션/프리뷰
  'localhost',
  '127.0.0.1',
];

/** 사설/개발 네트워크 접두 — 사내 테스트·LAN 접속 허용(오차단 방지) */
const PRIVATE_PREFIXES = ['192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.'];

function isAllowedHost(host: string): boolean {
  if (!host) return true; // 알 수 없으면 통과(fail-open)
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local')) return true; // 사내 mDNS
  if (PRIVATE_PREFIXES.some((p) => h.startsWith(p))) return true;
  return ALLOWED_SUFFIXES.some((s) => h === s || h.endsWith('.' + s));
}

/** 무단 복제본 전면 안내 오버레이 삽입 */
function blockWithNotice(host: string): void {
  try {
    document.title = '무단 복제본 — Train DIA';
    const el = document.createElement('div');
    el.setAttribute('data-traindia-guard', WATERMARK);
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'flex-direction:column', 'gap:16px',
      'align-items:center', 'justify-content:center', 'text-align:center',
      'padding:24px', 'background:#0F172A', 'color:#F1F5F9',
      'font-family:sans-serif', 'font-size:16px', 'line-height:1.6',
    ].join(';');
    el.innerHTML =
      '<div style="font-size:44px">🚫</div>' +
      '<div style="font-size:20px;font-weight:800">무단 복제본입니다</div>' +
      '<div style="max-width:520px;color:#94A3B8">이 앱은 답십리승무사업소 전용(dia5.kr)입니다.<br>' +
      '허가되지 않은 도메인에서 실행되어 사용이 제한됩니다.</div>' +
      '<div style="margin-top:8px;font-size:13px;color:#64748B">' + COPYRIGHT_NOTICE + '</div>';
    document.body.appendChild(el);
    // 스크롤·상호작용 잠금
    document.documentElement.style.overflow = 'hidden';
  } catch {
    /* noop — 오류 시 조용히 통과(fail-open) */
  }
}

/**
 * 무단 호스트 감지 → 기록 + 차단.
 * 정상 도메인이면 아무것도 하지 않는다.
 */
export function runOriginGuard(): void {
  if (typeof window === 'undefined') return;
  // 비상 해제 스위치
  if (process.env.NEXT_PUBLIC_DISABLE_ORIGIN_GUARD === '1') return;
  try {
    const host = window.location.hostname;
    if (isAllowedHost(host)) return;

    // 무단 호스트 — 흔적 남기고(대조/증거) 차단
    // eslint-disable-next-line no-console
    console.warn('[Train DIA] 무단 복제 감지:', host, WATERMARK);
    (window as unknown as Record<string, unknown>).__traindiaUnauthorizedHost = host;
    blockWithNotice(host);
  } catch {
    /* noop — fail-open */
  }
}
