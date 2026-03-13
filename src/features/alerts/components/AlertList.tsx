'use client';

import { useAlertStore } from '@/stores/alert';
import { useDriverStore } from '@/stores/driver';
import styles from '../styles/Alerts.module.css';

const SEVERITY_LABEL = {
  high: '긴급',
  medium: '이례사항',
  low: '참고',
} as const;

const DIRECTION_LABEL: Record<string, string> = {
  both: '상하선',
  up: '상선',
  down: '하선',
};

function formatExpiry(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return '만료됨';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return '곧 만료';
  if (diffHours < 24) return `${diffHours}시간 후 만료`;
  const month = expires.getMonth() + 1;
  const day = expires.getDate();
  return `${month}/${day}까지`;
}

export default function AlertList({ onClose }: { onClose: () => void }) {
  const { alerts, deactivate } = useAlertStore();
  const currentName = useDriverStore((s) => s.current?.n ?? '');
  const currentSabun = useDriverStore((s) => s.current?.s ?? '');

  return (
    <div className={styles.listContainer}>
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>장애 알림</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className={styles.emptyList}>
          <span className={styles.emptyListIcon}>✓</span>
          <p className={styles.emptyListText}>장애 알림이 없어요</p>
          <p className={styles.emptyListHint}>정상 운행 중이에요</p>
        </div>
      ) : (
        <div className={styles.alertCards}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alertCard} ${styles[`severity_${alert.severity}`]}`}
            >
              <div className={styles.alertCardHeader}>
                <span className={`${styles.severityBadge} ${styles[`severityBadge_${alert.severity}`]}`}>
                  {SEVERITY_LABEL[alert.severity]}
                </span>
                {alert.stationFrom && alert.stationTo ? (
                  <span className={styles.alertStation}>
                    {alert.stationFrom} → {alert.stationTo}
                    {alert.direction && DIRECTION_LABEL[alert.direction] && (
                      <span className={styles.alertDirection}> ({DIRECTION_LABEL[alert.direction]})</span>
                    )}
                  </span>
                ) : (
                  <span className={styles.alertStation}>전체</span>
                )}
                <span className={styles.alertTime}>
                  {new Date(alert.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className={styles.alertMessage}>{alert.message}</p>
              {alert.createdBy && (
                <span className={styles.alertAuthor}>{alert.createdBy}</span>
              )}
              {alert.expires_at && (
                <span className={styles.alertExpiry}>
                  {formatExpiry(alert.expires_at)}
                </span>
              )}
              {currentName && currentSabun && currentName === alert.createdBy && (
                <button
                  type="button"
                  className={styles.resolveBtn}
                  onClick={() => deactivate(alert.id, currentName, currentSabun)}
                >
                  해제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
