'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import styles from '../styles/ShuttleSchedule.module.css';
import moreStyles from '../styles/More.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'weekday' | 'holiday';

/* ── 평일 운행표 ── */
const WEEKDAY_DATA = [
  { no: 1, depart: '05:20', sangil: '05:30', arrive: '05:40', inDia: '', outDia: '01', note: '강동(05:49)' },
  { no: 2, depart: '05:40', sangil: '06:00', arrive: '06:10', inDia: '', outDia: '09', note: '강동(06:18)' },
  { no: 3, depart: '06:00', sangil: '06:20', arrive: '06:30', inDia: '', outDia: '02', note: '상일동(06:28)' },
  { no: 4, depart: '06:20', sangil: '06:40', arrive: '06:50', inDia: '', outDia: '04', note: '강동(06:52)' },
  { no: 5, depart: '06:50', sangil: '07:10', arrive: '07:20', inDia: '', outDia: '11', note: '강동(07:23)' },
  { no: 6, depart: '07:00', sangil: '07:20', arrive: '07:30', inDia: '', outDia: '19', note: '상일동(07:28)' },
  { no: 7, depart: '07:30', sangil: '07:50', arrive: '08:00', inDia: '', outDia: '05', note: '강동(07:55)' },
  { no: 8, depart: '14:30', sangil: '14:50', arrive: '15:00', inDia: '', outDia: '29', note: '상일동(14:54)' },
  { no: 9, depart: '15:30', sangil: '15:50', arrive: '16:00', inDia: '', outDia: '31', note: '강동(15:55)' },
  { no: 10, depart: '00:00', sangil: '00:15', arrive: '00:25', inDia: '22', outDia: '', note: '평평: 8651(고덕↔미사, 00:30~01:11)\n평휴: 8651(고덕↔미사, 00:30~01:11)' },
  { no: 11, depart: '00:10', sangil: '00:25', arrive: '00:35', inDia: '24', outDia: '', note: '평평: 8653(고덕↔미사, 00:42~01:22)\n평휴: 8653(고덕↔미사, 00:42~01:22)' },
  { no: 12, depart: '00:20', sangil: '00:35', arrive: '00:45', inDia: '26', outDia: '', note: '평평: 8655(고덕↔미사, 00:53~01:33)\n평휴: 8655(고덕↔미사, 00:53~01:33)' },
  { no: 13, depart: '00:30', sangil: '00:45', arrive: '00:55', inDia: '28', outDia: '', note: '평평: 8657(고덕↔미사, 01:04~01:43)\n평휴: 8657(고덕↔미사, 01:04~01:43)' },
  { no: 14, depart: '00:50', sangil: '01:05', arrive: '01:15', inDia: '30', outDia: '', note: '평평: 8659(고덕↔미사, 01:22~02:02)\n평휴: 없음' },
];

/* ── 휴일 운행표 ── */
const HOLIDAY_DATA = [
  { no: 1, depart: '05:30', sangil: '05:50', arrive: '06:00', inDia: '', outDia: '01', note: '강동(06:09)' },
  { no: 2, depart: '06:00', sangil: '06:20', arrive: '06:30', inDia: '', outDia: '03', note: '상일동(06:28)' },
  { no: 3, depart: '06:50', sangil: '07:10', arrive: '07:20', inDia: '', outDia: '07', note: '강동(07:22)' },
  { no: 4, depart: '07:10', sangil: '07:30', arrive: '07:40', inDia: '', outDia: '09', note: '상일동(07:37)' },
  { no: 5, depart: '14:30', sangil: '14:50', arrive: '15:00', inDia: '', outDia: '17', note: '상일동(14:55)' },
  { no: 6, depart: '15:30', sangil: '15:50', arrive: '16:00', inDia: '', outDia: '19', note: '강동(15:56)\n※ 토요일만 운행' },
  { no: 7, depart: '00:00', sangil: '00:15', arrive: '00:25', inDia: '14', outDia: '', note: '휴평: 8651(고덕↔미사, 00:30~01:11)\n휴휴: 8651(고덕↔미사, 00:30~01:11)' },
  { no: 8, depart: '00:10', sangil: '00:25', arrive: '00:35', inDia: '16', outDia: '', note: '휴평: 8653(고덕↔미사, 00:42~01:22)\n휴휴: 8653(고덕↔미사, 00:42~01:22)' },
  { no: 9, depart: '00:30', sangil: '00:45', arrive: '00:55', inDia: '18', outDia: '', note: '휴평: 8655(고덕↔미사, 00:53~01:33)\n휴휴: 없음' },
];

/* ── 휴일(야간) 고덕기지 입고열차 ── */
const HOLIDAY_NIGHT_DATA = [
  { work: '12', train: '8812', dapsimni: '23:28', inTrain: '8651', sangil: '00:06', misa: '00:17', hpDia: '14', hhDia: '14' },
  { work: '14', train: '8814', dapsimni: '23:38', inTrain: '8653', sangil: '00:19', misa: '00:29', hpDia: '16', hhDia: '16' },
  { work: '16', train: '8816', dapsimni: '23:50', inTrain: '8655', sangil: '00:30', misa: '00:40', hpDia: '18', hhDia: '' },
  { work: '18', train: '8818', dapsimni: '00:02', inTrain: '8657', sangil: '00:41', misa: '00:52', hpDia: '', hhDia: '' },
  { work: '20', train: '8820', dapsimni: '00:13', inTrain: '8659', sangil: '00:53', misa: '01:03', hpDia: '', hhDia: '' },
  { work: '22', train: '8822', dapsimni: '00:25', inTrain: '8661', sangil: '01:04', misa: '01:15', hpDia: '', hhDia: '' },
  { work: '24', train: '8824', dapsimni: '00:36', inTrain: '8663', sangil: '01:15', misa: '01:26', hpDia: '', hhDia: '' },
];

export default function ShuttleScheduleOverlay({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('weekday');

  if (!open) return null;

  return (
    <div className={moreStyles.fullOverlay}>
      <div className={moreStyles.overlayHeader}>
        <button
          type="button"
          className={moreStyles.overlayClose}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={22} />
        </button>
        <h2 className={moreStyles.overlayTitle}>승용차 운행 시간표</h2>
      </div>

      <div className={styles.shuttleBody}>
        {/* 탭 전환 */}
        <div className={styles.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'weekday'}
            className={`${styles.tabBtn} ${tab === 'weekday' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('weekday')}
          >
            평일
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'holiday'}
            className={`${styles.tabBtn} ${tab === 'holiday' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('holiday')}
          >
            휴일
          </button>
        </div>

        {/* 안내 문구 */}
        <p className={styles.subtitle}>고덕기지 ↔ 상일동</p>

        {tab === 'weekday' ? (
          <>
            {/* 평일 출고 편승 (1~9) */}
            <section className={styles.tableSection}>
              <h3 className={styles.tableTitle}>출고 편승</h3>
              <div className={styles.tableWrap}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th className={styles.thNarrow}>순번</th>
                      <th>기지출발</th>
                      <th>상일동</th>
                      <th>기지도착</th>
                      <th>출고 DIA</th>
                      <th className={styles.thWide}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAY_DATA.filter(r => r.no <= 9).map((r) => (
                      <tr key={r.no}>
                        <td className={styles.tdCenter}>{r.no}</td>
                        <td className={styles.tdCenter}>{r.depart}</td>
                        <td className={styles.tdCenter}>{r.sangil}</td>
                        <td className={styles.tdCenter}>{r.arrive}</td>
                        <td className={styles.tdDia}>{r.outDia}</td>
                        <td className={styles.tdNote}>{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 평일 입고 편승 (10~14) */}
            <section className={styles.tableSection}>
              <h3 className={styles.tableTitle}>입고 편승 (야간)</h3>
              <div className={styles.tableWrap}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th className={styles.thNarrow}>순번</th>
                      <th>기지출발</th>
                      <th>상일동</th>
                      <th>기지도착</th>
                      <th>입고 DIA</th>
                      <th className={styles.thWide}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAY_DATA.filter(r => r.no >= 10).map((r) => (
                      <tr key={r.no}>
                        <td className={styles.tdCenter}>{r.no}</td>
                        <td className={styles.tdCenter}>{r.depart}</td>
                        <td className={styles.tdCenter}>{r.sangil}</td>
                        <td className={styles.tdCenter}>{r.arrive}</td>
                        <td className={styles.tdDia}>{r.inDia}</td>
                        <td className={styles.tdNote}>
                          {r.note.split('\n').map((line, i) => (
                            <span key={i}>{line}{i < r.note.split('\n').length - 1 && <br />}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* 휴일 출고 편승 (1~6) */}
            <section className={styles.tableSection}>
              <h3 className={styles.tableTitle}>출고 편승</h3>
              <div className={styles.tableWrap}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th className={styles.thNarrow}>순번</th>
                      <th>기지출발</th>
                      <th>상일동</th>
                      <th>기지도착</th>
                      <th>출고 DIA</th>
                      <th className={styles.thWide}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HOLIDAY_DATA.filter(r => r.no <= 6).map((r) => (
                      <tr key={r.no}>
                        <td className={styles.tdCenter}>{r.no}</td>
                        <td className={styles.tdCenter}>{r.depart}</td>
                        <td className={styles.tdCenter}>{r.sangil}</td>
                        <td className={styles.tdCenter}>{r.arrive}</td>
                        <td className={styles.tdDia}>{r.outDia}</td>
                        <td className={styles.tdNote}>
                          {r.note.split('\n').map((line, i) => (
                            <span key={i}>{line}{i < r.note.split('\n').length - 1 && <br />}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 휴일 입고 편승 (7~9) */}
            <section className={styles.tableSection}>
              <h3 className={styles.tableTitle}>입고 편승 (야간)</h3>
              <div className={styles.tableWrap}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th className={styles.thNarrow}>순번</th>
                      <th>기지출발</th>
                      <th>상일동</th>
                      <th>기지도착</th>
                      <th>입고 DIA</th>
                      <th className={styles.thWide}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HOLIDAY_DATA.filter(r => r.no >= 7).map((r) => (
                      <tr key={r.no}>
                        <td className={styles.tdCenter}>{r.no}</td>
                        <td className={styles.tdCenter}>{r.depart}</td>
                        <td className={styles.tdCenter}>{r.sangil}</td>
                        <td className={styles.tdCenter}>{r.arrive}</td>
                        <td className={styles.tdDia}>{r.inDia}</td>
                        <td className={styles.tdNote}>
                          {r.note.split('\n').map((line, i) => (
                            <span key={i}>{line}{i < r.note.split('\n').length - 1 && <br />}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 휴일(야간) 고덕기지 입고열차 */}
            <section className={styles.tableSection}>
              <h3 className={styles.tableTitle}>휴일(야간) 고덕기지 입고열차</h3>
              <div className={styles.tableWrap}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th>근무</th>
                      <th>열차번호</th>
                      <th>답심리</th>
                      <th>입고열번</th>
                      <th>상일동</th>
                      <th>미사</th>
                      <th>휴평 DIA</th>
                      <th>휴휴 DIA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HOLIDAY_NIGHT_DATA.map((r) => (
                      <tr key={r.work}>
                        <td className={styles.tdCenter}>{r.work}</td>
                        <td className={styles.tdCenter}>{r.train}</td>
                        <td className={styles.tdCenter}>{r.dapsimni}</td>
                        <td className={styles.tdCenter}>{r.inTrain}</td>
                        <td className={styles.tdCenter}>{r.sangil}</td>
                        <td className={styles.tdCenter}>{r.misa}</td>
                        <td className={styles.tdDia}>{r.hpDia || '-'}</td>
                        <td className={styles.tdDia}>{r.hhDia || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
