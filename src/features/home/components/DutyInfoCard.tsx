'use client';

import { useMemo } from 'react';
import { getDutyInfo } from '@/lib/dutySchedule';
import { today } from '@/lib/schedule';
import styles from '../styles/Home.module.css';

export default function DutyInfoCard() {
  const info = useMemo(() => {
    const d = today();
    return getDutyInfo(d);
  }, []);

  const dayBonso = info.assignments.find((a) => a.location === '본소' && a.shift === '주간');
  const dayGiji = info.assignments.find((a) => a.location === '기지' && a.shift === '주간');
  const nightBonso = info.assignments.find((a) => a.location === '본소' && a.shift === '야간');
  const nightGiji = info.assignments.find((a) => a.location === '기지' && a.shift === '야간');
  const dayGwanje = info.gwanje.find((g) => g.shift === '주간');
  const nightGwanje = info.gwanje.find((g) => g.shift === '야간');

  return (
    <section className={styles.dutyInfoSection}>
      <h3 className={styles.sectionTitle}>오늘의 근무 배치</h3>
      <div className={styles.dutyInfoCard}>
        <table className={styles.dutyTable}>
          <thead>
            <tr>
              <th className={styles.dutyTh}> </th>
              <th className={styles.dutyTh}>
                <span className={styles.dutyShiftDay}>주간</span>
              </th>
              <th className={styles.dutyTh}>
                <span className={styles.dutyShiftNight}>야간</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.dutyLocationCell}>본소</td>
              <td className={styles.dutyNameCell}>
                {dayBonso ? (
                  <>
                    <span className={styles.dutyName}>{dayBonso.manager}</span>
                    <span className={styles.dutyNameSep}>/</span>
                    <span className={styles.dutyName}>{dayBonso.crew}</span>
                  </>
                ) : <span className={styles.dutyOff}>-</span>}
              </td>
              <td className={styles.dutyNameCell}>
                {nightBonso ? (
                  <>
                    <span className={styles.dutyName}>{nightBonso.manager}</span>
                    <span className={styles.dutyNameSep}>/</span>
                    <span className={styles.dutyName}>{nightBonso.crew}</span>
                  </>
                ) : <span className={styles.dutyOff}>-</span>}
              </td>
            </tr>
            <tr>
              <td className={styles.dutyLocationCell}>기지</td>
              <td className={styles.dutyNameCell}>
                {dayGiji ? (
                  <>
                    <span className={styles.dutyName}>{dayGiji.manager}</span>
                    <span className={styles.dutyNameSep}>/</span>
                    <span className={styles.dutyName}>{dayGiji.crew}</span>
                  </>
                ) : <span className={styles.dutyOff}>-</span>}
              </td>
              <td className={styles.dutyNameCell}>
                {nightGiji ? (
                  <>
                    <span className={styles.dutyName}>{nightGiji.manager}</span>
                    <span className={styles.dutyNameSep}>/</span>
                    <span className={styles.dutyName}>{nightGiji.crew}</span>
                  </>
                ) : <span className={styles.dutyOff}>-</span>}
              </td>
            </tr>
            <tr>
              <td className={styles.dutyLocationCell}>기지관제</td>
              <td className={styles.dutyNameCell}>
                {dayGwanje ? (
                  <>
                    <span className={styles.dutyName}>{dayGwanje.names[0]}</span>
                    <span className={styles.dutyNameSep}>/</span>
                    <span className={styles.dutyName}>{dayGwanje.names[1]}</span>
                  </>
                ) : <span className={styles.dutyOff}>-</span>}
              </td>
              <td className={styles.dutyNameCell}>
                {nightGwanje ? (
                  <>
                    <span className={styles.dutyName}>{nightGwanje.names[0]}</span>
                    <span className={styles.dutyNameSep}>/</span>
                    <span className={styles.dutyName}>{nightGwanje.names[1]}</span>
                  </>
                ) : <span className={styles.dutyOff}>-</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
