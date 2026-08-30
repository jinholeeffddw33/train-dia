'use client';

/**
 * 관리자 모드 — 관리자 전용 화면들의 입구
 *
 * 비밀번호를 여기서 한 번만 묻고, 안쪽 화면들은 바로 열린다.
 * (예전에는 접속 현황판·명부 관리가 설정에 흩어져 각자 비밀번호를 물었다)
 *
 * 앞으로 만들 관리자 기능은 MENU 에 한 줄 추가하면 된다.
 */

import { useState, useCallback } from 'react';
import { ArrowLeft, ShieldCheck, BarChart3, Users, ChevronRight } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import AdminDashboard from './AdminDashboard';
import RosterAdmin from './RosterAdmin';
import styles from '../styles/More.module.css';

const ADMIN_PIN = '9110';

type Screen = 'dashboard' | 'roster';

const MENU: { id: Screen; label: string; desc: string; icon: React.ReactNode; tone: string }[] = [
  {
    id: 'dashboard',
    label: '접속 현황판',
    desc: '누가 언제 앱을 썼는지',
    icon: <BarChart3 size={20} />,
    tone: 'toolIconBlue',
  },
  {
    id: 'roster',
    label: '명부 관리',
    desc: '인원·근무형태·직급 바꾸기',
    icon: <Users size={20} />,
    tone: 'toolIconGreen',
  },
];

export default function AdminHub({ onClose }: { onClose: () => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [screen, setScreen] = useState<Screen | null>(null);

  useEscapeClose(true, () => { if (screen) setScreen(null); else onClose(); });

  const submit = useCallback(() => {
    if (pin === ADMIN_PIN) { setAuthenticated(true); setPinError(''); }
    else { setPinError('비밀번호가 올바르지 않아요'); setPin(''); }
  }, [pin]);

  if (screen === 'dashboard') return <AdminDashboard onClose={() => setScreen(null)} />;
  if (screen === 'roster') return <RosterAdmin onClose={() => setScreen(null)} />;

  return (
    <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="관리자 모드">
      <div className={styles.overlayHeader}>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.overlayTitle}>관리자 모드</h2>
      </div>

      {!authenticated ? (
        <div className={styles.adminPinGate}>
          <div className={styles.adminPinIcon}><ShieldCheck size={40} /></div>
          <p className={styles.adminPinLabel}>관리자 비밀번호를 입력하세요</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className={styles.adminPinInput}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="****"
            autoFocus
          />
          {pinError && <p className={styles.adminPinError}>{pinError}</p>}
          <button
            type="button"
            className={`z-cta ${styles.adminPinSubmit}`}
            data-press
            onClick={submit}
            disabled={pin.length < 4}
          >
            확인
          </button>
        </div>
      ) : (
        <div className={styles.adminContent}>
          <ul className={styles.adminMenu}>
            {MENU.map((m) => (
              <li key={m.id}>
                <button type="button" className={styles.adminMenuItem} data-press onClick={() => setScreen(m.id)}>
                  <span className={`${styles.tileIcon} ${styles[m.tone]}`}>{m.icon}</span>
                  <span className={styles.adminMenuText}>
                    <span className={styles.adminMenuLabel}>{m.label}</span>
                    <span className={styles.adminMenuDesc}>{m.desc}</span>
                  </span>
                  <ChevronRight size={18} className={styles.adminMenuArrow} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
