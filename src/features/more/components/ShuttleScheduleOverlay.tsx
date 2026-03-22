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

/* ── 평일 운행표 (2026.3.23 시행) ── */
const WEEKDAY_DATA = [
  { no: 1, depart: '06:20', sangil: '06:30', arrive: '06:40', inDia: '5509열차(89dia) 답심리:06:02승차\n강동역이차 5005열차(출:06:17)로 환승', outDia: '7, 12', note: '2149열차 [출 교:06:41]\n1036열차 [출 교:06:55]' },
  { no: 2, depart: '06:45', sangil: '06:55', arrive: '07:05', inDia: '5009열차 (답심리:06:31) 승62\n[상일동 도착:06:54]', outDia: '18', note: '1040열차 [출고 교:07:11]' },
  { no: 3, depart: '09:40', sangil: '09:50', arrive: '10:00', inDia: '29, 4', outDia: '', note: '' },
  { no: 4, depart: '10:20', sangil: '10:30', arrive: '10:40', inDia: '15, 33', outDia: '', note: '' },
  { no: 5, depart: '11:05', sangil: '11:15', arrive: '11:25', inDia: '52, 53', outDia: '', note: '' },
  { no: 6, depart: '15:20', sangil: '15:30', arrive: '15:40', inDia: '', outDia: '38, 11, 22', note: '5107열차 (12Dia)\n답심리:15:04, 상일동:15:27' },
  { no: 7, depart: '17:20', sangil: '17:30', arrive: '17:40', inDia: '', outDia: '기지근무자', note: '' },
];

/** DIA 13 편승 참고 (7~8번 사이 안내) */
const WEEKDAY_DIA13_NOTE = '1056열차(32Dia) 출고차 편승\n18:16 (18:05진도)';

const WEEKDAY_NIGHT_DATA = [
  { no: 8, depart: '19:30', sangil: '19:40', arrive: '19:50', inDia: '25, 28', outDia: '', note: '' },
  { no: 9, depart: '20:00', sangil: '20:10', arrive: '20:20', inDia: '36, 35, 37, 41', outDia: '', note: '' },
];

/** 10번 — 평평/평휴 분리 */
const WEEKDAY_10_PP = { no: 10, depart: '20:20', sangil: '20:30', arrive: '20:40', inDia: '43, (평평) 71, 76', outDia: '', note: '(평평) 운행', variant: '평평' as const };
const WEEKDAY_10_PH = { no: 10, depart: '20:20', sangil: '20:30', arrive: '20:40', inDia: '43, (평휴) 71, 76, 74', outDia: '', note: '(평휴) 운행', variant: '평휴' as const };

/** 11번 — 평휴 운행 */
const WEEKDAY_11 = { no: 11, depart: '20:50', sangil: '21:00', arrive: '21:10', inDia: '(평휴) 77, 63', outDia: '', note: '(평휴) 83DIA 익일편승\n1014열차(06:02진도) 영89dia', variant: '평휴' as const };

/** 12~14번 — 월~목 평평 운행 */
const WEEKDAY_LATE = [
  { no: 12, depart: '22:15', sangil: '22:25', arrive: '22:35', inDia: '(월~목) (평평) 운행', outDia: '69, 64, 68, 66', note: '5183열차 [영77Dia]\n답심리:21:56, 상일동:22:18' },
  { no: 13, depart: '22:55', sangil: '23:05', arrive: '23:15', inDia: '(월~목) (평평) 운행', outDia: '72, 75, 70, 73', note: '5189열차 [답91Dia]\n답심리:22:35, 상일동:22:58' },
  { no: 14, depart: '23:40', sangil: '23:50', arrive: '00:00', inDia: '(월~목) (평평) 운행', outDia: '78, 80', note: '5195열차 [영83Dia]\n답심리:23:20, 상일동:23:43' },
];

/* ── 휴일 운행표 ── */
const HOLIDAY_DATA = [
  { no: 1, depart: '08:00', sangil: '08:10', arrive: '08:20', inDia: '', outDia: '16, 19', note: '5019열차 (답 4dia)\n답심리:07:42, 상일동:08:05' },
  { no: 2, depart: '09:10', sangil: '09:20', arrive: '09:30', inDia: '4', outDia: '', note: '' },
  { no: 3, depart: '11:00', sangil: '11:10', arrive: '11:20', inDia: '21, 22', outDia: '', note: '' },
  { no: 4, depart: '16:00', sangil: '16:10', arrive: '16:20', inDia: '', outDia: '27, 30, 33', note: '5093열차 (영12dia)\n답심리:15:44, 상일동:16:07' },
  { no: 5, depart: '19:00', sangil: '19:10', arrive: '19:20', inDia: '35, 34', outDia: '', note: '' },
  { no: 6, depart: '19:50', sangil: '20:00', arrive: '20:10', inDia: '70(휴-휴)', outDia: '', note: '토요일만 운행', isSatOnly: true },
];

const HOLIDAY_NIGHT_DATA = [
  { no: 7, depart: '20:50', sangil: '21:00', arrive: '21:10', inDia: '', outDia: '[휴-평] 62, 63, 64, 65', note: '5137열차 (답85dia)\n답심리(20:30), 상일동(20:53)' },
  { no: 8, depart: '21:40', sangil: '21:50', arrive: '22:00', inDia: '', outDia: '[휴-평] 72, 78, 73', note: '5145열차 (답82dia)\n답심리(21:22), 상일동(21:45)' },
  { no: 9, depart: '22:35', sangil: '22:45', arrive: '22:55', inDia: '', outDia: '[휴-평] 68, 67, 70, 71', note: '5153열차 (영76dia)\n답심리(22:14), 상일동(22:37)' },
];

/* ── 휴일(야간) 고덕기지 입고열차 ── */
const HOLIDAY_DEPOT_DATA = [
  { work: '영77', train: '5657', dapsimni: '21:54', inTrain: '1005', sangil: '22:57', misa: '', hpDia: '', hhDia: '' },
  { work: '영79', train: '5153', dapsimni: '22:14', inTrain: '2012', sangil: '', misa: '23:04', hpDia: '', hhDia: '77(23:09)' },
  { work: '영82', train: '5661', dapsimni: '22:20', inTrain: '1007', sangil: '23:21', misa: '', hpDia: '', hhDia: '' },
  { work: '영76', train: '5161', dapsimni: '23:11', inTrain: '1009', sangil: '23:34', misa: '', hpDia: '69(22:15), 81(22:30),\n83(23:09)', hhDia: '상일동 입고차 이용', isHighlight: true },
  { work: '영74', train: '5665', dapsimni: '22:47', inTrain: '1011', sangil: '23:43', misa: '', hpDia: '', hhDia: '' },
  { work: '영75', train: '5165', dapsimni: '23:44', inTrain: '1013', sangil: '00:07', misa: '', hpDia: '', hhDia: '' },
  { work: '영88', train: '5167', dapsimni: '23:52', inTrain: '1015', sangil: '00:15', misa: '', hpDia: '', hhDia: '' },
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
        {/* 타이틀 */}
        <div className={styles.docTitle}>
          <h3 className={styles.docMainTitle}>2026년 고덕기지 승용차 운행 시간표</h3>
          <div className={styles.docSubRow}>
            <span className={styles.docOrg}>□답십리승무사업소</span>
            <span className={styles.docDate}>2026.3.23.(월) 시행</span>
          </div>
        </div>

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

        {tab === 'weekday' ? (
          <>
            <h4 className={styles.sectionHeader}>평 일 운 행 표</h4>

            {/* 평일 주간 (1~7) */}
            <div className={styles.tableWrap}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th className={styles.thNo}>순번</th>
                    <th>기지출발</th>
                    <th className={styles.thSangil}>상일동</th>
                    <th>기지도착</th>
                    <th>입고 후 편승 DIA</th>
                    <th>편승 후 출고 DIA</th>
                    <th className={styles.thNote}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAY_DATA.map((r) => (
                    <tr key={`w${r.no}`}>
                      <td className={styles.tdCenter}>{r.no}</td>
                      <td className={styles.tdCenter}>{r.depart}</td>
                      <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{r.sangil}</td>
                      <td className={styles.tdCenter}>{r.arrive}</td>
                      <td className={styles.tdDia}>{r.inDia && r.inDia.split('\n').map((l, i) => <span key={i}>{l}{i === 0 && r.inDia.includes('\n') && <br />}</span>)}</td>
                      <td className={styles.tdDiaOut}>{r.outDia}</td>
                      <td className={styles.tdNote}>{r.note && r.note.split('\n').map((l, i) => <span key={i}>{l}{i < r.note.split('\n').length - 1 && <br />}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* DIA 13 안내 */}
            <div className={styles.diaNote}>
              <span className={styles.diaNoteNum}>13</span>
              <span className={styles.diaNoteText}>{WEEKDAY_DIA13_NOTE.split('\n').map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}</span>
            </div>

            {/* 평일 야간 (8~14) */}
            <div className={styles.tableWrap}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th className={styles.thNo}>순번</th>
                    <th>기지출발</th>
                    <th className={styles.thSangil}>상일동</th>
                    <th>기지도착</th>
                    <th>입고 후 편승 DIA</th>
                    <th>편승 후 출고 DIA</th>
                    <th className={styles.thNote}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAY_NIGHT_DATA.map((r) => (
                    <tr key={`wn${r.no}`}>
                      <td className={styles.tdCenter}>{r.no}</td>
                      <td className={styles.tdCenter}>{r.depart}</td>
                      <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{r.sangil}</td>
                      <td className={styles.tdCenter}>{r.arrive}</td>
                      <td className={styles.tdDia}>{r.inDia}</td>
                      <td className={styles.tdDiaOut}>{r.outDia}</td>
                      <td className={styles.tdNote}>{r.note}</td>
                    </tr>
                  ))}
                  {/* 10번 — 평평 */}
                  <tr className={styles.trHighlight}>
                    <td className={styles.tdCenter}>{WEEKDAY_10_PP.no}</td>
                    <td className={styles.tdCenter}>{WEEKDAY_10_PP.depart}</td>
                    <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{WEEKDAY_10_PP.sangil}</td>
                    <td className={styles.tdCenter}>{WEEKDAY_10_PP.arrive}</td>
                    <td className={styles.tdDia}>{WEEKDAY_10_PP.inDia}</td>
                    <td className={styles.tdDiaOut}>{WEEKDAY_10_PP.outDia}</td>
                    <td className={styles.tdNote}><strong>{WEEKDAY_10_PP.note}</strong></td>
                  </tr>
                  {/* 10번 — 평휴 */}
                  <tr className={styles.trHighlight}>
                    <td className={styles.tdCenter}>{WEEKDAY_10_PH.no}</td>
                    <td className={styles.tdCenter}>{WEEKDAY_10_PH.depart}</td>
                    <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{WEEKDAY_10_PH.sangil}</td>
                    <td className={styles.tdCenter}>{WEEKDAY_10_PH.arrive}</td>
                    <td className={styles.tdDia}>{WEEKDAY_10_PH.inDia}</td>
                    <td className={styles.tdDiaOut}>{WEEKDAY_10_PH.outDia}</td>
                    <td className={styles.tdNote}><strong>{WEEKDAY_10_PH.note}</strong></td>
                  </tr>
                  {/* 11번 — 평휴 */}
                  <tr className={styles.trHighlight}>
                    <td className={styles.tdCenter}>{WEEKDAY_11.no}</td>
                    <td className={styles.tdCenter}>{WEEKDAY_11.depart}</td>
                    <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{WEEKDAY_11.sangil}</td>
                    <td className={styles.tdCenter}>{WEEKDAY_11.arrive}</td>
                    <td className={styles.tdDia}>{WEEKDAY_11.inDia}</td>
                    <td className={styles.tdDiaOut}>{WEEKDAY_11.outDia}</td>
                    <td className={styles.tdNote}>
                      {WEEKDAY_11.note.split('\n').map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}
                    </td>
                  </tr>
                  {/* 12~14번 — 월~목 평평 */}
                  {WEEKDAY_LATE.map((r) => (
                    <tr key={`wl${r.no}`}>
                      <td className={styles.tdCenter}>{r.no}</td>
                      <td className={styles.tdCenter}>{r.depart}</td>
                      <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{r.sangil}</td>
                      <td className={styles.tdCenter}>{r.arrive}</td>
                      <td className={styles.tdDia}>{r.inDia}</td>
                      <td className={styles.tdDiaOut}>{r.outDia}</td>
                      <td className={styles.tdNote}>{r.note.split('\n').map((l, i) => <span key={i}>{l}{i < r.note.split('\n').length - 1 && <br />}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h4 className={styles.sectionHeader}>휴 일 운 행 표</h4>

            {/* 휴일 주간 (1~6) */}
            <div className={styles.tableWrap}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th className={styles.thNo}>순번</th>
                    <th>기지출발</th>
                    <th className={styles.thSangil}>상일동</th>
                    <th>기지도착</th>
                    <th>입고 후 편승 DIA</th>
                    <th>편승 후 출고 DIA</th>
                    <th className={styles.thNote}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {HOLIDAY_DATA.map((r) => (
                    <tr key={`h${r.no}`} className={r.isSatOnly ? styles.trSatOnly : ''}>
                      <td className={styles.tdCenter}>{r.no}</td>
                      <td className={styles.tdCenter}>{r.depart}</td>
                      <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{r.sangil}</td>
                      <td className={styles.tdCenter}>{r.arrive}</td>
                      <td className={styles.tdDia}>{r.inDia}</td>
                      <td className={styles.tdDiaOut}>{r.outDia}</td>
                      <td className={styles.tdNote}>
                        {r.note && r.note.split('\n').map((l, i) => <span key={i}>{l}{i < r.note.split('\n').length - 1 && <br />}</span>)}
                        {r.isSatOnly && <strong className={styles.satOnlyTag}>토요일만 운행</strong>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 구분선 */}
            <div className={styles.divider} />

            {/* 휴일 야간 (7~9) */}
            <div className={styles.tableWrap}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th className={styles.thNo}>순번</th>
                    <th>기지출발</th>
                    <th className={styles.thSangil}>상일동</th>
                    <th>기지도착</th>
                    <th>입고 후 편승 DIA</th>
                    <th>편승 후 출고 DIA</th>
                    <th className={styles.thNote}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {HOLIDAY_NIGHT_DATA.map((r) => (
                    <tr key={`hn${r.no}`}>
                      <td className={styles.tdCenter}>{r.no}</td>
                      <td className={styles.tdCenter}>{r.depart}</td>
                      <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{r.sangil}</td>
                      <td className={styles.tdCenter}>{r.arrive}</td>
                      <td className={styles.tdDia}>{r.inDia}</td>
                      <td className={styles.tdDiaOut}>{r.outDia}</td>
                      <td className={styles.tdNote}>{r.note.split('\n').map((l, i) => <span key={i}>{l}{i < r.note.split('\n').length - 1 && <br />}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 휴일(야간) 고덕기지 입고열차 */}
            <h4 className={styles.sectionHeader}>휴일(야간) 고덕기지 입고열차</h4>
            <div className={styles.tableWrap}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th>근무</th>
                    <th>열차번호</th>
                    <th className={styles.thDapsimni}>답심리</th>
                    <th>입고열번</th>
                    <th className={styles.thSangil}>상일동</th>
                    <th>미사</th>
                    <th>[휴평 편승 다이아]</th>
                    <th>[휴휴 편승 다이아]</th>
                  </tr>
                </thead>
                <tbody>
                  {HOLIDAY_DEPOT_DATA.map((r) => (
                    <tr key={r.work} className={r.isHighlight ? styles.trDepotHighlight : ''}>
                      <td className={styles.tdCenter}>{r.work}</td>
                      <td className={styles.tdCenter}>{r.train}</td>
                      <td className={`${styles.tdCenter} ${styles.tdDapsimni}`}>{r.dapsimni}</td>
                      <td className={styles.tdCenter}>{r.inTrain}</td>
                      <td className={`${styles.tdCenter} ${styles.tdSangil}`}>{r.sangil}</td>
                      <td className={styles.tdCenter}>{r.misa}</td>
                      <td className={styles.tdDia}>{r.hpDia && r.hpDia.split('\n').map((l, i) => <span key={i}>{l}{i < r.hpDia.split('\n').length - 1 && <br />}</span>)}</td>
                      <td className={styles.tdDia}>{r.hhDia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
