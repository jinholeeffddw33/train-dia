import { useState, useEffect, useCallback } from 'react';
import { useAlertStore } from '@/stores/alert';

interface CategoryCounts {
  hazard:  { count: number; ids: string[] };
  action:  { count: number; ids: string[] };
  inspect: { count: number; ids: string[] };
}

const STORAGE_KEY = 'safety-read-ids';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function useSafetyUnread() {
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);
  const alerts = useAlertStore((s) => s.alerts);
  const [alertReadIds, setAlertReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('safety-alert-read-ids');
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Set();
  });

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/safety/hazards/counts');
      if (res.ok) {
        const json = await res.json() as { data: CategoryCounts };
        setCounts(json.data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const markAsRead = useCallback((reportId: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(reportId);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAlertAsRead = useCallback((alertId: string) => {
    setAlertReadIds(prev => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem('safety-alert-read-ids', JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const getUnread = useCallback((category: 'hazard' | 'action' | 'inspect') => {
    if (!counts) return 0;
    const cat = counts[category];
    if (!cat) return 0;
    const unreadCount = cat.ids.filter(id => !readIds.has(id)).length;
    return unreadCount;
  }, [counts, readIds]);

  /** 카테고리별 미확인 ID 목록 — counts 배열은 최신순(created_at DESC)으로 정렬되어 있음 */
  const getUnreadIds = useCallback((category: 'hazard' | 'action' | 'inspect'): string[] => {
    if (!counts) return [];
    const cat = counts[category];
    if (!cat) return [];
    return cat.ids.filter(id => !readIds.has(id));
  }, [counts, readIds]);

  /** 미확인 알림(공지) ID 목록 — 최신순으로 정렬 */
  const unreadAlertIds = alerts
    .filter(a => !alertReadIds.has(a.id))
    .map(a => a.id);

  const alertUnread = unreadAlertIds.length;

  return { getUnread, getUnreadIds, unreadAlertIds, alertUnread, markAsRead, markAlertAsRead, fetchCounts };
}
