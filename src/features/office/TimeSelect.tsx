'use client';

/**
 * 시/분 드롭다운 시각 선택 — 브라우저 기본 time 피커 대신 사용.
 * 분은 10분 단위(00·10·20·30·40·50)만 노출해 기기 무관 동일 동작 보장.
 * value: 'HH:MM' | ''  (빈 값 = 미선택)
 */
import styles from './TimeSelect.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '10', '20', '30', '40', '50'];

export default function TimeSelect({
  value,
  onChange,
  ariaLabel = '시각',
  allowEmpty = true,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  allowEmpty?: boolean;
}) {
  const [h, m] = value ? value.split(':') : ['', ''];

  const emit = (nh: string, nm: string) => {
    if (!nh && !nm) { onChange(''); return; }
    onChange(`${(nh || '00').padStart(2, '0')}:${(nm || '00').padStart(2, '0')}`);
  };

  return (
    <span className={styles.wrap}>
      <select className={styles.sel} value={h} aria-label={`${ariaLabel} 시`}
        onChange={(e) => emit(e.target.value, m || (e.target.value ? '00' : ''))}>
        {allowEmpty && <option value="">시</option>}
        {HOURS.map((hh) => <option key={hh} value={hh}>{hh}시</option>)}
      </select>
      <span className={styles.colon}>:</span>
      <select className={styles.sel} value={m} aria-label={`${ariaLabel} 분`}
        onChange={(e) => emit(h || (e.target.value ? '00' : ''), e.target.value)}>
        {allowEmpty && <option value="">분</option>}
        {MINUTES.map((mm) => <option key={mm} value={mm}>{mm}분</option>)}
      </select>
    </span>
  );
}
