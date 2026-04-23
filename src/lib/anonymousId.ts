/**
 * 디바이스 고유 익명 ID
 *
 * 피드백 시스템에서 이름/사번 없이 "내 제보" 스레드를 추적하기 위한 UUID.
 * 최초 생성 시 localStorage에 저장 → 이후 재사용.
 * 앱 데이터 삭제 시 초기화됨 (익명성 강화).
 */

const STORAGE_KEY = 'train-dia-anon-id';

function generateUuid(): string {
  // crypto.randomUUID가 지원되면 사용, 아니면 fallback
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // fallback: RFC4122 v4 형태의 수동 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 저장된 익명 ID를 반환, 없으면 새로 생성 */
export function getAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = generateUuid();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // localStorage 비활성 환경에서는 세션용 임시값 반환
    return generateUuid();
  }
}
