'use client';

import { CPH_CTRL, CPH } from '@/data/contacts';
import styles from '../styles/Contacts.module.css';

export default function ContactsTab() {
  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>비상 연락처</h2>

      {/* 관제센터 — 긴급 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.urgentDot} />
          관제센터
        </h3>
        {CPH_CTRL.map((c) => (
          <div key={c.n} className={styles.cardUrgent}>
            <span className={styles.cardName}>{c.n}</span>
            <div className={styles.phones}>
              <a href={`tel:${c.a}`} className={styles.phoneBtn} aria-label={`${c.n} ${c.a} 전화`}>
                <span className={styles.phoneIcon}>📞</span>
                {c.a}
              </a>
              {c.b && (
                <a href={`tel:${c.b}`} className={styles.phoneBtn} aria-label={`${c.n} ${c.b} 전화`}>
                  <span className={styles.phoneIcon}>📞</span>
                  {c.b}
                </a>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* 승무사업소 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>승무사업소 · 기지</h3>
        {CPH.map((c) => (
          <div key={c.n} className={styles.card}>
            <span className={styles.cardName}>{c.n}</span>
            <div className={styles.phones}>
              <a href={`tel:${c.a}`} className={styles.phoneBtnSmall} aria-label={`${c.n} ${c.a} 전화`}>
                {c.a}
              </a>
              {c.b && (
                <a href={`tel:${c.b}`} className={styles.phoneBtnSmall} aria-label={`${c.n} ${c.b} 전화`}>
                  {c.b}
                </a>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
