'use client';

import { useEffect } from 'react';
import { installProvenance } from '@/lib/provenance';
import { runOriginGuard } from '@/lib/originGuard';

/**
 * 원작 지문 각인 + 무단 호스트(킬 스위치) 감지.
 * - installProvenance: window.__traindia 에 워터마크/미끼 각인 (복제본 대조용)
 * - runOriginGuard: 등록되지 않은 도메인에서 뜨면 감지·기록(무단 복제본 판별)
 * 화면에는 아무것도 그리지 않는다.
 */
export default function Provenance() {
  useEffect(() => {
    installProvenance();
    runOriginGuard();
  }, []);
  return null;
}
