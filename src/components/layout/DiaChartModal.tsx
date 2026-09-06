'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Modal from '@/components/common/Modal';
import { getType, isHoliday } from '@/lib/schedule';
import styles from './DiaChartModal.module.css';

interface DiaChartModalProps {
  open: boolean;
  dia: string | null;
  date: Date;
  diaLabel?: string;
  /** 작은 미리보기 — 시트를 낮게 띄워 뒤 화면(5호선 운행도)이 더 보이게 한다 */
  compact?: boolean;
  onClose: () => void;
}

function getRouteImagePath(dia: string, date: Date): string | null {
  if (dia.startsWith('휴') || dia.startsWith('대')) return null;
  const diaNum = parseInt(dia.replace(/\D/g, ''));
  if (isNaN(diaNum)) return null;
  const h = isHoliday(date);
  const tm = new Date(date);
  tm.setDate(tm.getDate() + 1);
  const th = isHoliday(tm);
  const isNight = getType(dia) === 'night';
  let prefix: string;
  if (!isNight) { prefix = h ? 'p_hol' : 'p_ord'; }
  else if (h && th) prefix = 'p_hh';
  else if (h && !th) prefix = 'p_hp';
  else if (!h && th) prefix = 'p_ph';
  else prefix = 'p_pp';
  return `/images/route/${prefix}_${diaNum}.png`;
}

/**
 * 이 교번에 볼 행로표가 있는가 — 휴무·비번·대기는 운전행로가 없다.
 * 누를 수 있는 것만 누르게 하려고 부르는 쪽에서 미리 쓴다(눌렀더니 빈 창이 뜨지 않도록).
 */
export function hasDiaChart(dia: string | null | undefined): boolean {
  if (!dia) return false;
  if (dia.startsWith('휴') || dia.startsWith('대') || dia.endsWith('~')) return false;
  return !isNaN(parseInt(dia.replace(/\D/g, '')));
}

/**
 * 행로표 보기 — 달력의 근무 상세와 같은 바텀시트다.
 *
 * 예전엔 이 화면만 가운데 뜨는 별도 오버레이였다. 그래서 같은 앱 안에서 «행로표를 보는
 * 동작»이 두 가지였고, 안드로이드 뒤로가기로 닫히지도, 아래로 끌어 내리지도 않았다.
 * 이제 공용 Modal(바텀시트 SSOT) 위에 얹는다 — 위로 올라오고, 아래로 끌면 내려가고,
 * 뒤로가기·ESC·배경탭이 모두 그대로 따라온다.
 */
export default function DiaChartModal({ open, dia, date, diaLabel, compact, onClose }: DiaChartModalProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { if (open) setImgError(false); }, [open, dia]);

  const imgPath = dia ? getRouteImagePath(dia, date) : null;

  // 행로표는 근무 카드·5호선 운행도 «안쪽»에서 열린다. 그 자리에 그대로 그리면 감싼 상자가
  // 시트의 기준이 되어, 화면 아래에 붙지 않고 상자 한가운데 떠 버린다(근무 화면에서 실제로 그랬다).
  // 화면 최상위(body)로 옮겨 달면 어디서 열든 달력의 근무 상세와 똑같이 아래에서 올라온다.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <Modal
      open={open}
      onClose={onClose}
      title={diaLabel ? `${diaLabel} 다이아 표` : '다이아 표'}
    >
      <div className={`${styles.chart} ${compact ? styles.chartCompact : ''}`}>
        {imgPath && !imgError ? (
          <Image
            src={imgPath}
            alt={`${diaLabel ?? dia} 다이아 운전행로`}
            width={1200}
            height={900}
            className={styles.img}
            onError={() => setImgError(true)}
            priority
            unoptimized
          />
        ) : (
          <div className={styles.empty}>
            <p>이 다이아의 표 이미지가 준비되지 않았어요.</p>
            <p className={styles.emptySub}>{dia ? `(${dia})` : ''}</p>
          </div>
        )}
      </div>
    </Modal>,
    document.body,
  );
}
