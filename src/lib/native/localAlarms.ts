/**
 * 근무 알람 네이티브 예약 — 2026-08-18
 *
 * ★ 이것이 앱을 만드는 이유다.
 *   웹/PWA 의 알람은 `setInterval` 로 30초마다 "지금이 그 시각인가"를 보는 방식이라
 *   **앱 화면이 떠 있어야만** 울린다. 자기 전에 앱을 켜 두고 화면을 켠 채 두는 사람은 없으므로
 *   실질적으로 "출근 30분 전 알람"은 웹에서 거의 울린 적이 없다.
 *   여기서는 목록을 통째로 **OS 에 맡긴다** — 앱이 꺼져 있어도, 폰이 잠겨 있어도 울린다.
 *
 * 설계:
 *   · 예약은 항상 **전체 재동기화**다(기존 것 취소 → 계획대로 새로 등록).
 *     알람 설정이 바뀌었는데 옛 예약이 남으면 "끈 알람이 울리는" 최악의 버그가 된다.
 *   · ID 는 계획 키(key)에서 **결정적으로** 만든다. 같은 알람은 몇 번을 재동기화해도 같은 ID 라
 *     중복 등록되지 않는다.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import type { AlarmEvent } from '@/lib/alarmPlan';
import { isNativeApp, isNativeAndroid } from '@/lib/native/platform';

/** 안드로이드 알림 채널 — 중요도를 최고로 둬야 잠금화면에 뜨고 소리가 난다 */
const CHANNEL_ID = 'dia-duty-alarm';

/**
 * 우리가 만든 예약임을 표시하는 ID 대역.
 * 다른 곳에서 로컬 알림을 쓰게 되더라도 이 범위 밖이면 건드리지 않는다.
 */
const ID_BASE = 100_000;
const ID_RANGE = 900_000;

/**
 * 문자열 키 → 안정적인 32bit 정수 (djb2).
 * Capacitor 의 알림 ID 는 정수여야 하는데, 계획 키는 문자열이라 변환이 필요하다.
 * 랜덤이 아니라 **결정적**이어야 재동기화 때 같은 알람이 같은 ID 를 받는다.
 */
function idFromKey(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return ID_BASE + (Math.abs(hash) % ID_RANGE);
}

let channelReady = false;

/** 안드로이드 알림 채널 생성 (한 번만). 채널이 없으면 알림이 조용히 낮은 중요도로 뜬다. */
async function ensureChannel(): Promise<void> {
  if (channelReady || !isNativeAndroid()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: '근무 알람',
      description: '출발 시각 전에 미리 알려주는 알람',
      importance: 5, // MAX — 소리 + 헤드업 배너
      visibility: 1, // 잠금화면에 내용 표시
      vibration: true,
    });
    channelReady = true;
  } catch {
    // 채널 생성 실패해도 알림 자체는 뜬다(기본 채널). 알람을 통째로 포기할 이유는 아니다.
  }
}

export type AlarmPermission = 'granted' | 'denied' | 'prompt';

/** 지금 알림 권한 상태 */
export async function checkAlarmPermission(): Promise<AlarmPermission> {
  if (!isNativeApp()) return 'denied';
  try {
    const res = await LocalNotifications.checkPermissions();
    return res.display === 'granted' ? 'granted' : res.display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'denied';
  }
}

/** 알림 권한 요청 — 사용자 제스처(버튼 탭) 안에서 부를 것 */
export async function requestAlarmPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

/** 우리가 예약해 둔 알람만 골라 취소한다 */
async function cancelOurPending(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(
    (n) => n.id >= ID_BASE && n.id < ID_BASE + ID_RANGE
  );
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
}

export interface SyncResult {
  /** 실제로 OS 에 예약된 개수 */
  scheduled: number;
  /** 권한이 없어 아무것도 못 했으면 true */
  blocked: boolean;
}

/**
 * 계획을 OS 예약과 일치시킨다. 계획이 비어 있으면 전부 취소한다(= 알람 끄기).
 *
 * ⚠️ 권한을 여기서 **요청하지 않는다** — 권한 팝업은 사용자가 알람을 켜는 순간에만 떠야 한다.
 *   화면을 열 때마다 재동기화가 도는데 거기서 요청하면 팝업이 불쑥 뜬다.
 */
export async function syncScheduledAlarms(plan: AlarmEvent[]): Promise<SyncResult> {
  if (!isNativeApp()) return { scheduled: 0, blocked: false };

  const permission = await checkAlarmPermission();
  if (permission !== 'granted') {
    // 권한이 없으면 예약도 취소도 의미가 없다(애초에 등록된 게 없다)
    return { scheduled: 0, blocked: true };
  }

  await ensureChannel();
  await cancelOurPending();

  if (plan.length === 0) return { scheduled: 0, blocked: false };

  await LocalNotifications.schedule({
    notifications: plan.map((event) => ({
      id: idFromKey(event.key),
      title: event.title,
      body: event.body,
      schedule: {
        at: event.at,
        // 폰이 절전(Doze)에 들어가 있어도 제 시각에 깨운다.
        // 이게 false 면 안드로이드가 몇 분~수십 분 늦춰 묶어 보낼 수 있는데,
        // "10분 전 알람"에 그 지연은 기능을 통째로 무의미하게 만든다.
        allowWhileIdle: true,
      },
      channelId: CHANNEL_ID,
      smallIcon: 'ic_stat_icon_config_sample',
      // 알람은 사용자가 직접 지울 때까지 남기지 않는다 — 탭하면 앱이 열린다
      autoCancel: true,
    })),
  });

  return { scheduled: plan.length, blocked: false };
}

/** 예약된 우리 알람 전부 취소 (로그아웃·알람 끄기) */
export async function cancelAllAlarms(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await cancelOurPending();
  } catch {
    /* 취소 실패는 사용자에게 보고할 것이 없다 — 다음 재동기화에서 다시 정리된다 */
  }
}

/** 디버그용: 지금 OS 에 걸려 있는 우리 알람 목록 */
export async function listScheduledAlarms(): Promise<{ id: number; title?: string; at?: string }[]> {
  if (!isNativeApp()) return [];
  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications
      .filter((n) => n.id >= ID_BASE && n.id < ID_BASE + ID_RANGE)
      .map((n) => ({
        id: n.id,
        title: n.title,
        at: n.schedule?.at instanceof Date ? n.schedule.at.toISOString() : undefined,
      }));
  } catch {
    return [];
  }
}
