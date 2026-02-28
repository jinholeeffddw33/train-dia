'use client';

import { useAlertStore } from '@/stores/alert';
import styles from '../styles/Alerts.module.css';

const SEVERITY_LABEL = {
  high: '긴급',
  medium: '주의',
  low: '참고',
} as const;

export default function AlertList({ onClose }: { onClose: () => void }) {
  const { alerts, deactivate } = useAlertStore();

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
                <span className={styles.alertStation}>{alert.station}</span>
                <span className={styles.alertTime}>
                  {new Date(alert.created_at).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className={styles.alertMessage}>{alert.message}</p>
              {alert.photos && alert.photos.length > 0 && (
                <div className={styles.alertPhotos}>
                  {alert.photos.map((url, i) => (
                    <img
                      key={`${alert.id}-${i}`}
                      src={url}
                      alt={`장애 사진 ${i + 1}`}
                      className={styles.alertPhoto}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                className={styles.resolveBtn}
                onClick={() => deactivate(alert.id)}
              >
                해제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
