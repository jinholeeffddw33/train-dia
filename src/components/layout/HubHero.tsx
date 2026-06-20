'use client';

import { useMemo, useState } from 'react';
import { TrainFront, FileText, ChevronRight, Briefcase, Calendar } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { useGetSwappedDia } from '@/hooks/useSwappedDia';
import {
  getType, getSchedule, getDiaDisplay, getWorkTime,
  isSpecialRest, getSpecialRestLabel, isHoliday,
} from '@/lib/schedule';
import { useClock } from '@/features/home/hooks/useClock';
import { getUserRole, isRegularDayOffice } from '@/lib/auth';
import { DOW } from '@/lib/constants';
import DiaChartModal from './DiaChartModal';
import styles from './HubHero.module.css';

interface HubHeroProps {
  /** 카드 본체 클릭 → 근무 세계 진입 */
  onClick?: () => void;
}

export default function HubHero({ onClick }: HubHeroProps) {
  const [chartOpen, setChartOpen] = useState(false);
  // 0 = 오늘, 1 = 내일
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const driver = useDriverStore((s) => s.current);
  const getSwappedDia = useGetSwappedDia();
  const clock = useClock();

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(parseInt(clock.hours), parseInt(clock.minutes), parseInt(clock.seconds));
    return d;
  }, [clock.hours, clock.minutes, clock.seconds]);

  // 선택된 근무일 (오늘/내일)
  const targetDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [now, dayOffset]);

  // 기관사 외 직원 (소장·부소장·부장·인턴·내근직) 판별
  const isOfficeStaff = !!driver && driver.I === '0';

  const info = useMemo(() => {
    if (!driver || isOfficeStaff) return null;
    const dia = getSwappedDia(driver, targetDate);
    if (!dia) return null;
    const schedule = getSchedule(dia, targetDate);
    const diaType = getType(dia);
    const specialRest = isSpecialRest(schedule);
    const restLabel = specialRest ? getSpecialRestLabel(schedule) : '';
    const isRest = diaType === 'rest' || specialRest;

    return {
      dia,
      diaLabel: getDiaDisplay(dia),
      diaType,
      isRest,
      restLabel,
      schedule,
      workTime: schedule ? getWorkTime(schedule) : '',
    };
  }, [driver, isOfficeStaff, getSwappedDia, targetDate]);

  const enterDuty = () => { onClick?.(); };
  const openChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (info?.dia && !info.isRest) setChartOpen(true);
  };

  // ─── 1) 내근직 (기관사 외 직원) 전용 카드 ───
  if (isOfficeStaff && driver) {
    const role = getUserRole(driver.s).replace('님', '');
    const holiday = isHoliday(now);
    const isRegularOffice = isRegularDayOffice(driver.s);
    // 평일 09~18 통상근무자 + 공휴일 → 휴무
    const isOff = holiday && isRegularOffice;
    const dowLabel = DOW[now.getDay()];
    const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 (${dowLabel})`;

    return (
      <div
        className={`${styles.heroCard} ${isOff ? styles.tone_office_rest : styles.tone_office}`}
        role="button"
        tabIndex={0}
        aria-label="근무 화면으로 이동"
        onClick={enterDuty}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterDuty(); }
        }}
      >
        <div className={styles.heroBadge}>오늘 일정</div>
        <div className={styles.heroMain}>
          <div className={styles.heroIconWrap}>
            <Briefcase size={28} strokeWidth={2} />
          </div>
          <span className={styles.heroTitle}>
            <span className={styles.officeName}>{driver.n}</span>
            <span className={styles.titleSuffix}>{role}</span>
          </span>
        </div>
        <div className={styles.officeBody}>
          <div className={styles.officeRow}>
            <Calendar size={16} className={styles.officeIcon} aria-hidden />
            <span>{dateStr}</span>
          </div>
          <div className={styles.officeRow}>
            <span className={styles.officeStatus}>
              {isOff
                ? '오늘은 휴일입니다 · 푹 쉬세요'
                : isRegularOffice
                  ? '평일 통상근무 · 09:00 ~ 18:00'
                  : '오늘도 안전한 하루 되세요'}
            </span>
          </div>
        </div>
        {/* 내근직은 다이아 표 없음 — 상세보기 버튼 미노출 */}
      </div>
    );
  }

  // ─── 2) 기관사 카드 ───
  // 톤 클래스
  let toneClass = styles.tone_idle;
  if (info && !info.isRest) {
    toneClass = info.diaType === 'night' ? styles.tone_night
      : info.diaType === 'standby' ? styles.tone_standby
      : styles.tone_day;
  } else if (info?.isRest) {
    toneClass = styles.tone_rest;
  }

  // 제목
  let titleNode: React.ReactNode;
  if (!driver) titleNode = <span className={styles.heroTitle}>기관사 선택</span>;
  else if (!info) titleNode = <span className={styles.heroTitle}>정보 없음</span>;
  else if (info.isRest) titleNode = <span className={styles.heroTitle}>{info.restLabel || '휴무'}</span>;
  else titleNode = (
    <span className={styles.heroTitle}>
      <span className={styles.bigNumber}>{info.diaLabel}</span>
      <span className={styles.titleSuffix}>다이아</span>
    </span>
  );

  const isWorking = !!info && !info.isRest && !!info.dia;

  return (
    <>
      <div
        className={`${styles.heroCard} ${toneClass}`}
        role="button"
        tabIndex={0}
        aria-label="근무 화면으로 이동"
        onClick={enterDuty}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterDuty(); }
        }}
      >
        <div className={styles.heroTopRow}>
          <div className={styles.heroBadge}>{dayOffset === 0 ? '오늘 근무' : '내일 근무'}</div>
          {driver && (
            <div className={styles.heroDayToggle} role="tablist" aria-label="근무일 선택">
              <button
                type="button"
                role="tab"
                aria-selected={dayOffset === 0}
                className={`${styles.heroDayBtn} ${dayOffset === 0 ? styles.heroDayBtnActive : ''}`}
                onClick={(e) => { e.stopPropagation(); setDayOffset(0); }}
              >
                오늘
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dayOffset === 1}
                className={`${styles.heroDayBtn} ${dayOffset === 1 ? styles.heroDayBtnActive : ''}`}
                onClick={(e) => { e.stopPropagation(); setDayOffset(1); }}
              >
                내일
              </button>
            </div>
          )}
        </div>
        <div className={styles.heroMain}>
          <div className={styles.heroIconWrap}>
            <TrainFront size={28} strokeWidth={2} />
          </div>
          {titleNode}
        </div>

        {isWorking && (
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>출근</span>
              <span className={styles.statValue}>{info.schedule?.s ?? '-'}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>퇴근</span>
              <span className={styles.statValue}>{info.schedule?.e ?? '-'}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>근무시간</span>
              <span className={styles.statValue}>{info.workTime || '-'}</span>
            </div>
          </div>
        )}

        {/* 근무날만 다이아 표 버튼 노출 (비번/휴무/대휴/운휴/정보 없음 → 미노출) */}
        {isWorking && (
          <button
            type="button"
            className={styles.detailBtn}
            onClick={openChart}
            aria-label="다이아 표 보기"
          >
            <FileText size={18} strokeWidth={2.2} className={styles.detailIcon} aria-hidden />
            <span>근무 정보 상세보기</span>
            <ChevronRight size={18} className={styles.detailChevron} aria-hidden />
          </button>
        )}
      </div>

      {info && (
        <DiaChartModal
          open={chartOpen}
          dia={info.dia}
          date={targetDate}
          diaLabel={info.diaLabel}
          onClose={() => setChartOpen(false)}
        />
      )}
    </>
  );
}
