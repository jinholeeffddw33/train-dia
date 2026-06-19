'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Megaphone, RefreshCw, ChevronRight } from 'lucide-react';
import { useAlertStore } from '@/stores/alert';
import { useExchangeStore } from '@/stores/exchange';
import styles from '../styles/Home.module.css';

interface RealTimeInfoProps {
  onSafetyClick?: () => void;
  onAlertClick?: () => void;
  onExchangeClick?: () => void;
}

interface HazardCounts {
  hazard:  { count: number; ids: string[] };
  action:  { count: number; ids: string[] };
  inspect: { count: number; ids: string[] };
}

const SAFETY_READ_KEY = 'safety-read-ids';

function loadReadCount(allIds: string[]): number {
  try {
    const raw = localStorage.getItem(SAFETY_READ_KEY);
    if (!raw) return allIds.length;
    const read = new Set(JSON.parse(raw) as string[]);
    return allIds.filter((id) => !read.has(id)).length;
  } catch { return allIds.length; }
}

export default function RealTimeInfo({ onSafetyClick, onAlertClick, onExchangeClick }: RealTimeInfoProps) {
  const [hazardUnread, setHazardUnread] = useState(0);
  const alerts = useAlertStore((s) => s.alerts);
  const exchangePosts = useExchangeStore((s) => s.posts);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/safety/hazards/counts')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data as HazardCounts | undefined;
        if (!data) return;
        const allIds = [...data.hazard.ids, ...data.action.ids, ...data.inspect.ids];
        setHazardUnread(loadReadCount(allIds));
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  const alertCount = alerts.length;
  const exchangeCount = exchangePosts.filter((p) => p.status === 'pending').length;

  const items: Array<{
    icon: typeof AlertTriangle;
    label: string;
    count: number;
    color: 'red' | 'amber' | 'sky';
    onClick?: () => void;
  }> = [
    { icon: AlertTriangle, label: '최근 사고사례', count: hazardUnread, color: 'red',   onClick: onSafetyClick },
    { icon: Megaphone,     label: '알림마당',     count: alertCount,    color: 'amber', onClick: onAlertClick },
    { icon: RefreshCw,     label: '교번 교환 요청', count: exchangeCount, color: 'sky',   onClick: onExchangeClick },
  ];

  return (
    <section className={styles.realtimeCard} aria-label="실시간 정보">
      <div className={styles.realtimeHeader}>
        <h3 className={styles.realtimeTitle}>실시간 정보</h3>
      </div>
      <ul className={styles.realtimeList}>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <button
                type="button"
                className={styles.realtimeItem}
                onClick={it.onClick}
                aria-label={`${it.label} ${it.count > 0 ? `${it.count}건` : ''}`}
              >
                <span className={`${styles.realtimeIconWrap} ${styles[`realtimeIcon_${it.color}`]}`}>
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span className={styles.realtimeLabel}>{it.label}</span>
                {it.count > 0 && <span className={styles.realtimeBadge}>{it.count}</span>}
                <ChevronRight size={16} className={styles.realtimeChevron} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
