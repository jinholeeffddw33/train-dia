import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * supabase 지연 로더 — supabase-js(~100KB+)를 초기 번들에서 제외.
 *
 * `@/lib/supabase` 를 정적 import 하면 클라이언트 생성 코드가 초기 청크에 포함된다.
 * 초기 경로에 걸리는 스토어(alert/exchange)는 이 getSupabase() 를 통해
 * 첫 사용 시점에 dynamic import 로 클라이언트를 가져온다.
 * (타입 import 는 런타임에 지워지므로 번들 영향 없음)
 */
let cached: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!cached) {
    cached = import('@/lib/supabase').then((m) => m.supabase);
  }
  return cached;
}
