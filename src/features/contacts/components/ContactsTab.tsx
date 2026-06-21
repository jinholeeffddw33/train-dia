'use client';

import { Phone, Shield, Building2 } from 'lucide-react';
import { CPH_CTRL, CPH } from '@/data/contacts';
import styles from '../styles/Contacts.module.css';

export default function ContactsTab() {
  return (
    <div className={styles.container}>
      {/* 도트 패턴 배경 */}
      <div className={styles.dotPattern} aria-hidden="true" />

      <h2 className={styles.pageTitle}>비상 연락처</h2>
      <p className={styles.pageDesc}>긴급 상황 시 즉시 연결되는 번호예요</p>

      {/* 관제센터 — 긴급 */}
      <section className={styles.urgentSection}>
        <h3 className={styles.urgentLabel}>
          <span className={styles.urgentDot} />
          긴급 관제
        </h3>
        {CPH_CTRL.map((c) => (
          <div key={c.n} className={styles.urgentCard}>
            <div className={styles.urgentCardGlow} aria-hidden="true" />
            <div className={styles.urgentHeader}>
              <Shield size={20} className={styles.urgentIcon} />
              <span className={styles.urgentName}>{c.n}</span>
            </div>
            <div className={styles.urgentPhones}>
              <a href={`tel:${c.a.replace(/-/g, '')}`} className={`z-glass-pill ${styles.urgentBtn}`} data-press aria-label={`${c.n} ${c.a} 전화`}>
                <Phone size={18} className={styles.urgentPhoneIcon} />
                <span className={styles.urgentPhoneNum}>{c.a}</span>
              </a>
              {c.b && (
                <a href={`tel:${c.b.replace(/-/g, '')}`} className={`z-glass-pill ${styles.urgentBtn}`} data-press aria-label={`${c.n} ${c.b} 전화`}>
                  <Phone size={18} className={styles.urgentPhoneIcon} />
                  <span className={styles.urgentPhoneNum}>{c.b}</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* 승무사업소 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Building2 size={16} className={styles.sectionIcon} />
          승무사업소 · 기지
        </h3>
        <div className={styles.cardGrid}>
          {CPH.map((c) => (
            <div key={c.n} className={styles.card}>
              <span className={styles.cardName}>{c.n}</span>
              <div className={styles.phones}>
                <a href={`tel:${c.a.replace(/-/g, '')}`} className={`z-glass-pill ${styles.phoneChip}`} data-press aria-label={`${c.n} ${c.a} 전화`}>
                  {c.a}
                </a>
                {c.b && (
                  <a href={`tel:${c.b.replace(/-/g, '')}`} className={`z-glass-pill ${styles.phoneChip}`} data-press aria-label={`${c.n} ${c.b} 전화`}>
                    {c.b}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
