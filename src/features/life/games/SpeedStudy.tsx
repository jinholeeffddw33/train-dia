'use client';

import { useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SPEED_RULES, SPEED_GROUP_LABEL, type SpeedGroup } from '@/data/speedLimits';
import styles from './SpeedStudy.module.css';

/**
 * 속도 공부하기 — 스피드 마스터에서 바로 열어 보는 정리 화면.
 *
 * 게임과 같은 speedLimits.ts 를 본다. 공부한 숫자와 게임에서 채점하는 숫자가 어긋나면
 * 둘 중 하나는 틀린 것을 외우게 되므로, 목록을 따로 적어 두지 않는다.
 *
 * 묶음 안에서는 느린 속도부터 놓는다 — 5·15·20·25 처럼 숫자로 묶어 외우는 편이 쉽다.
 */

const GROUP_ORDER: SpeedGroup[] = ['abnormal', 'restrict', 'depot', 'disaster', 'fault'];

/** 속도대별 색 — 얼마나 조여진 값인지 한눈에 */
function bandClass(limit: number): string {
  if (limit <= 20) return styles.bandStop;
  if (limit <= 45) return styles.bandCaution;
  return styles.bandGo;
}

export default function SpeedStudy({ onClose }: { onClose: () => void }) {
  const groups = useMemo(
    () => GROUP_ORDER.map((g) => ({
      key: g,
      label: SPEED_GROUP_LABEL[g],
      rules: SPEED_RULES.filter((r) => r.group === g).sort((a, b) => a.limit - b.limit),
    })).filter((g) => g.rules.length > 0),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.wrap} role="dialog" aria-modal="true" aria-label="속도 공부하기">
      {/* 닫기는 왼쪽 뒤로가기로 — 오른쪽 위는 앱의 테마 배지가 떠 있어 가린다 */}
      <header className={styles.header}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <h2 className={styles.title}>속도 공부하기</h2>
      </header>

      <div className={styles.body}>
        <p className={styles.lead}>
          게임에 나오는 속도를 모은 것입니다. 숫자로 묶어 외우면 훨씬 빨리 붙습니다.
        </p>

        {groups.map((g) => (
          <section key={g.key} className={styles.group}>
            <h3 className={styles.groupTitle}>{g.label}</h3>
            <ul className={styles.list}>
              {g.rules.map((r) => (
                <li key={r.id} className={styles.item}>
                  <span className={`${styles.limit} ${bandClass(r.limit)}`}>
                    {r.limit}<em>km/h</em>
                  </span>
                  <span className={styles.itemText}>
                    <b className={styles.itemLabel}>{r.label}</b>
                    <small className={styles.itemSource}>{r.source}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className={styles.foot}>
          규정 개정과 소속 지시가 있을 때는 그쪽이 우선입니다.
        </p>
      </div>
    </div>
  );
}
