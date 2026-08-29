'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle, ChevronDown } from 'lucide-react';
import {
  useAlarmStore,
  NORMAL_OPTIONS,
  DEPOT_OPTIONS,
  FIXED_TIME_OPTIONS,
  ALARM_LABELS,
  type AlarmMinute,
  type FixedTime,
} from '@/stores/alarm';
import { useNotification } from '@/hooks/useNotification';
import { isNativeApp } from '@/lib/native/platform';
import { listScheduledAlarms } from '@/lib/native/localAlarms';
import { showToast } from '@/stores/toast';
import styles from '../styles/More.module.css';

/**
 * 근무 알람 설정 — 2026-08-18 복원.
 *
 * ★ 이 화면은 **없어졌던 것**이다.
 *   알람 엔진(useSegmentAlarm)·저장소(stores/alarm)·CSS 는 전부 살아 있는데,
 *   `4a3ea52 feat(home): 홈 화면 재구성` 에서 RouteTimeline 의 알람 UI 만 빠졌다
 *   (그 파일 주석에 "대기시간·알람 UI 제거"로 남아 있다).
 *   엔진은 계속 돌지만 켤 방법이 없으니 selected 는 영원히 빈 배열 —
 *   **근무 알람이 통째로 죽어 있었다.**
 *
 * 홈이 아니라 설정에 두는 이유:
 *   · 홈의 "화면 단순화" 의도를 되돌리지 않는다
 *   · 알람 설정은 구간별이 아니라 **전역**이다(store 가 selected 하나를 모든 구간에 적용).
 *     원래 UI 는 구간마다 열렸지만 값은 하나였다 — 설정에 있는 편이 실제 동작과 맞다
 *   · More.module.css 에 .alarmRow/.alarmChipGroup 이 이미 준비돼 있었다(원래 여기 두려던 자리)
 *
 * 네이티브에서는 켜는 순간 **알림 권한**이 필요하다. 권한 없이 켜면 예약이 조용히
 * 실패해서 "켰는데 안 울린다"가 된다 — 그래서 여기서 권한을 먼저 받고, 거부되면 그 사실을 말한다.
 */
export default function AlarmSettings() {
  const { selected, fixedTimes, toggle, toggleFixed, clearAll } = useAlarmStore();
  const { supported, permission, requestPermission } = useNotification();
  const [scheduledCount, setScheduledCount] = useState<number | null>(null);
  /* 기본은 접어 둔다(진호 요청). 웹에서는 앱 화면이 켜져 있을 때만 울려서
     실제로 쓰는 사람이 드문데, 펼쳐 두면 설정 화면에서 가장 큰 자리를 차지한다.
     켜 둔 사람이 못 찾는 일이 없도록 접힌 줄에 켜진 개수를 적어 둔다. */
  const [open, setOpen] = useState(false);

  const anyOn = selected.length > 0 || fixedTimes.length > 0;
  const native = isNativeApp();
  const blocked = native && permission === 'denied';

  // 네이티브: 실제로 OS 에 몇 개가 걸렸는지 보여 준다.
  // "켰다"는 화면 상태이고 "걸렸다"는 사실이다 — 둘을 같이 보여 줘야 신뢰가 생긴다.
  const refreshScheduled = useCallback(async () => {
    if (!native) return;
    const list = await listScheduledAlarms();
    setScheduledCount(list.length);
  }, [native]);

  useEffect(() => {
    void refreshScheduled();
    // 설정이 바뀌면 useSegmentAlarm 이 재동기화하므로 잠시 뒤 다시 센다
    const t = setTimeout(() => { void refreshScheduled(); }, 600);
    return () => clearTimeout(t);
  }, [selected, fixedTimes, refreshScheduled]);

  /** 알람을 켜기 전에 권한을 확보한다. 못 받으면 켜지 않는다(거짓 켜짐 방지). */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (!native) return true;
    if (permission === 'granted') return true;
    if (permission === 'denied') {
      showToast('휴대폰 설정에서 이 앱의 알림을 켜주세요', 'warning');
      return false;
    }
    const ok = await requestPermission();
    if (!ok) showToast('알림을 허용해야 알람이 울려요', 'warning');
    return ok;
  }, [native, permission, requestPermission]);

  const handleToggle = useCallback(async (m: AlarmMinute) => {
    // 끄는 건 권한과 무관하다
    if (selected.includes(m)) { toggle(m); return; }
    if (await ensurePermission()) toggle(m);
  }, [selected, toggle, ensurePermission]);

  const handleToggleFixed = useCallback(async (t: FixedTime) => {
    if (fixedTimes.includes(t)) { toggleFixed(t); return; }
    if (await ensurePermission()) toggleFixed(t);
  }, [fixedTimes, toggleFixed, ensurePermission]);

  if (!supported && native) return null;

  return (
    <div className={styles.alarmRow}>
      {/* 줄 전체가 여닫는 단추다 — 접힌 상태에서 켜진 개수를 함께 보여 준다 */}
      <button
        type="button"
        className={styles.alarmToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.ctrlIcon}>{anyOn ? <Bell size={18} /> : <BellOff size={18} />}</span>
        <span className={styles.ctrlLabel}>근무 알람</span>
        <span className={styles.alarmState}>
          {anyOn ? `${selected.length + fixedTimes.length}개 켜짐` : '꺼짐'}
        </span>
        <ChevronDown
          size={18}
          className={`${styles.alarmChevron} ${open ? styles.alarmChevronOpen : ''}`}
          aria-hidden
        />
      </button>

      {!open && !native && (
        <p className={styles.alarmDesc}>앱 화면이 켜져 있을 때만 울려요</p>
      )}

      {open && (
      <>
      {anyOn && (
        <div className={styles.alarmHeader}>
          <button type="button" className={styles.notifBtn} onClick={clearAll}>
            전체 끄기
          </button>
        </div>
      )}

      <p className={styles.alarmDesc}>
        {native
          ? '출발 시각 전에 미리 알려드려요. 앱을 꺼두어도 울립니다.'
          : '출발 시각 전에 미리 알려드려요. (앱 화면이 켜져 있을 때만 울립니다)'}
      </p>

      {blocked && (
        <p className={styles.alarmDesc} role="status">
          <AlertCircle size={13} aria-hidden /> 알림이 차단되어 있어요 — 휴대폰 설정에서 켜주세요
        </p>
      )}

      <div className={styles.alarmChipLabel}>출발 전</div>
      <div className={styles.alarmChipGroup}>
        {NORMAL_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.alarmChip} ${selected.includes(m) ? styles.alarmChipActive : ''}`}
            aria-pressed={selected.includes(m)}
            onClick={() => { void handleToggle(m); }}
          >
            {ALARM_LABELS[m]}
          </button>
        ))}
      </div>

      <div className={styles.alarmChipLabel}>기지 출고 근무 (1000·1500·2000번대)</div>
      <div className={styles.alarmChipGroup}>
        {DEPOT_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.alarmChip} ${selected.includes(m) ? styles.alarmChipActive : ''}`}
            aria-pressed={selected.includes(m)}
            onClick={() => { void handleToggle(m); }}
          >
            {ALARM_LABELS[m]}
          </button>
        ))}
      </div>

      <div className={styles.alarmChipLabel}>익일 근무 고정 시각 (85~91 다이아)</div>
      <div className={styles.alarmChipGroup}>
        {FIXED_TIME_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.alarmChip} ${fixedTimes.includes(t) ? styles.alarmChipActive : ''}`}
            aria-pressed={fixedTimes.includes(t)}
            onClick={() => { void handleToggleFixed(t); }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 사실 보고 — 화면의 "켜짐"과 OS 에 실제로 걸린 개수를 같이 보여 준다 */}
      {native && anyOn && scheduledCount !== null && (
        <p className={styles.alarmDesc} role="status">
          {scheduledCount > 0
            ? `예약됨 ${scheduledCount}개`
            : '예약된 알람 없음 — 오늘 남은 근무가 없거나 알림 권한을 확인해주세요'}
        </p>
      )}
      </>
      )}
    </div>
  );
}
