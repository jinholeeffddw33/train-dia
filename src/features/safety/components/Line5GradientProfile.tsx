'use client';

import { useMemo, useState } from 'react';
import { TrendingUp, AlignJustify } from 'lucide-react';
import styles from './Line5GradientProfile.module.css';

/**
 * 5호선 상구배 단면도 — 위험개소(안전) 화면 상단에 노출.
 * 20‰ 초과 오르막만, 진행 방향으로 솟는 경사면(가로) / 노선 막대(세로) 두 보기 토글.
 * 데이터는 승무 참고 자료(카카오톡 정리본) 기준 — 정적.
 */
const MAIN = ['방화', '개화산', '김포공항', '송정', '마곡', '발산', '우장산', '화곡', '까치산', '신정', '목동', '오목교', '양평', '영등포구청', '영등포시장', '신길', '여의도', '여의나루', '마포', '공덕', '애오개', '충정로', '서대문', '광화문', '종로3가', '을지로4가', '동대문역사문화공원', '청구', '신금호', '행당', '왕십리', '마장', '답십리', '장한평', '군자', '아차산', '광나루', '천호', '강동', '길동', '굽은다리', '명일', '고덕', '상일동', '강일', '미사', '하남풍산', '하남시청', '하남검단산'];
const BRANCH = ['강동', '둔촌동', '올림픽공원', '방이', '오금', '개롱', '거여', '마천'];

interface Inc { a: string; b: string; seg: string; dir: 'up' | 'down'; g: number; gt?: string; blk: string; br?: number }
const INC: Inc[] = [
  { a: '둔촌동', b: '강동', seg: '둔촌→강동', dir: 'up', g: 33, blk: '3폐색~2폐색', br: 1 },
  { a: '상일동', b: '고덕', seg: '상일동→고덕', dir: 'up', g: 29.2, blk: '5폐색~2폐색' },
  { a: '천호', b: '광나루', seg: '천호→광나루', dir: 'up', g: 32, blk: '1폐색~장내' },
  { a: '광나루', b: '아차산', seg: '광나루→아차산', dir: 'up', g: 24.9, blk: '3폐색~장내' },
  { a: '답십리', b: '장한평', seg: '장한평→답십리', dir: 'up', g: 21.62, blk: '4폐색~출발' },
  { a: '마장', b: '답십리', seg: '답십리→마장', dir: 'up', g: 26, blk: '3폐색~4폐색' },
  { a: '신금호', b: '행당', seg: '행당→신금호', dir: 'up', g: 29.7, gt: '29.3~29.7', blk: '출발~1폐색' },
  { a: '마포', b: '여의나루', seg: '마포→여의나루', dir: 'up', g: 23, blk: '4폐색~1폐색' },
  { a: '여의나루', b: '여의도', seg: '여의나루→여의도', dir: 'up', g: 22.8, blk: '출발~2폐색' },
  { a: '여의도', b: '신길', seg: '여의도→신길', dir: 'up', g: 27, blk: '5폐색~1폐색' },
  { a: '양평', b: '오목교', seg: '양평→오목교', dir: 'up', g: 25, blk: '3폐색~1폐색' },
  { a: '오목교', b: '목동', seg: '오목교→목동', dir: 'up', g: 23, blk: '출발~4폐색' },
  { a: '목동', b: '신정', seg: '목동→신정', dir: 'up', g: 22.7, blk: '출발~2폐색' },
  { a: '까치산', b: '화곡', seg: '까치산→화곡', dir: 'up', g: 28, gt: '28~27', blk: '출발~1폐색' },
  { a: '송정', b: '마곡', seg: '송정→마곡', dir: 'down', g: 34, blk: '1폐색~장내' },
  { a: '까치산', b: '신정', seg: '까치산→신정', dir: 'down', g: 24, blk: '4폐색~장내' },
  { a: '영등포시장', b: '신길', seg: '영등포시장→신길', dir: 'down', g: 32, blk: '3폐색~장내' },
  { a: '신길', b: '여의도', seg: '신길→여의도', dir: 'down', g: 21, blk: '3폐색~장내' },
  { a: '여의나루', b: '마포', seg: '여의나루→마포', dir: 'down', g: 30, blk: '3폐색~1폐색(수문)' },
  { a: '마포', b: '공덕', seg: '마포→공덕', dir: 'down', g: 28, blk: '출발~1폐색' },
  { a: '애오개', b: '충정로', seg: '애오개→충정로', dir: 'down', g: 25, blk: '4폐색~출발' },
  { a: '청구', b: '신금호', seg: '청구→신금호', dir: 'down', g: 24, gt: '24~22.6', blk: '장내~출발' },
  { a: '장한평', b: '군자', seg: '장한평→군자', dir: 'down', g: 24, blk: '2폐색~장내' },
  { a: '군자', b: '아차산', seg: '군자→아차산', dir: 'down', g: 30.77, blk: '3폐색~장내' },
  { a: '굽은다리', b: '명일', seg: '굽은다리→명일', dir: 'down', g: 25, blk: '3폐색~장내' },
  { a: '올림픽공원', b: '방이', seg: '올림픽→방이', dir: 'down', g: 20, blk: '출발~1폐색', br: 1 },
  { a: '강동', b: '둔촌동', seg: '강동→둔촌', dir: 'down', g: 29, blk: '2폐색~1폐색', br: 1 },
];
interface Depot { station: string; name: string; dir: 'up' | 'down'; g: number; blk: string }
const DEPOT: Depot[] = [
  { station: '방화', name: '방화기지', dir: 'up', g: 31, blk: '3폐색~2폐색' },
  { station: '상일동', name: '고덕차량기지', dir: 'up', g: 33, blk: '7폐색~5폐색' },
  { station: '상일동', name: '고덕차량기지', dir: 'down', g: 33, blk: '5폐색~1폐색' },
];
const TERM: Record<string, number> = { 방화: 1, 하남검단산: 1, 마천: 1 };
const JCT: Record<string, number> = { 강동: 1 };

const esc = (s: unknown) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const climbAt = (A: string, B: string, dir: string, br?: boolean) =>
  INC.find((x) => !!x.br === !!br && x.dir === dir && ((x.a === A && x.b === B) || (x.a === B && x.b === A)));

// ── 가로(종단면도) — SVG 문자열 ──
const STEP = 44, VS = 1.05, PADX = 34, TOP = 26, LABEL = 90;
function buildH(stations: string[], dir: 'up' | 'down', br: boolean, arrowLeft: boolean): string {
  const n = stations.length, col = dir === 'up' ? '--dia-purple' : '--dia-sky-text';
  const climbs: Record<number, Inc> = {}; let maxG = 0; let i: number;
  for (i = 0; i < n - 1; i++) { const c = climbAt(stations[i], stations[i + 1], dir, br); if (c) { climbs[i] = c; if (c.g > maxG) maxG = c.g; } }
  const deps: Record<number, Depot> = {};
  DEPOT.filter((d) => d.dir === dir).forEach((d) => { const idx = stations.indexOf(d.station); if (idx >= 0) { deps[idx] = d; if (d.g > maxG) maxG = d.g; } });
  const maxH = maxG * VS, baseY = TOP + maxH, W = PADX * 2 + (n - 1) * STEP, H = baseY + LABEL;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="inherit">`;
  s += `<line x1="${PADX}" y1="${baseY}" x2="${W - PADX}" y2="${baseY}" stroke="var(--dia-border-strong)" stroke-width="2"/>`;
  for (i = 0; i < n - 1; i++) {
    if (!climbs[i]) continue;
    const cc = climbs[i], to = (cc.seg || '').split('→')[1] || '', siA = stations[i];
    const same = siA === to || siA.indexOf(to) === 0 || to.indexOf(siA) === 0;
    const pk = same ? i : i + 1, bs = pk === i ? i + 1 : i;
    const xPk = PADX + pk * STEP, xBs = PADX + bs * STEP, py = baseY - cc.g * VS;
    s += `<path d="M ${xBs} ${baseY} L ${xPk} ${py} L ${xPk} ${baseY} Z" fill="var(${col})" fill-opacity="0.16"/>`;
    s += `<path d="M ${xBs} ${baseY} L ${xPk} ${py}" fill="none" stroke="var(${col})" stroke-width="2.5" stroke-linecap="round"/>`;
    s += `<circle cx="${xPk}" cy="${py}" r="2.6" fill="var(${col})"/>`;
    s += `<text x="${xPk}" y="${py - 6}" text-anchor="middle" font-size="12.5" font-weight="800" fill="var(${col})">${esc(cc.gt || Math.round(cc.g * 100) / 100)}</text>`;
  }
  for (const k in deps) { const d = deps[k], dx = PADX + +k * STEP, dy = baseY - d.g * VS;
    s += `<line x1="${dx}" y1="${baseY}" x2="${dx}" y2="${dy}" stroke="var(${col})" stroke-width="2" stroke-dasharray="3 3"/>`;
    s += `<circle cx="${dx}" cy="${dy}" r="2.4" fill="var(${col})"/>`;
    s += `<text x="${dx}" y="${dy - 6}" text-anchor="middle" font-size="11" font-weight="800" fill="var(${col})">🚇${esc(d.g)}</text>`; }
  for (i = 0; i < n; i++) { const xx = PADX + i * STEP;
    s += `<line x1="${xx}" y1="${baseY}" x2="${xx}" y2="${baseY + 4}" stroke="var(--dia-border)" stroke-width="1.5"/>`;
    s += `<text x="${xx}" y="${baseY + 11}" text-anchor="end" font-size="12.5" fill="var(--dia-text-secondary)" transform="rotate(-50 ${xx} ${baseY + 11})">${esc(stations[i])}</text>`; }
  if (arrowLeft) s += `<text x="${PADX}" y="${TOP - 8}" text-anchor="start" font-size="11.5" font-weight="800" fill="var(${col})">◀ 진행방향(방화)</text>`;
  else s += `<text x="${W - PADX}" y="${TOP - 8}" text-anchor="end" font-size="11.5" font-weight="800" fill="var(${col})">진행방향 ▶</text>`;
  s += '</svg>';
  return s;
}

// ── 세로(막대) — DOM 문자열 ──
const px = (g: number) => Math.max(16, Math.round((g - 15) * 4.6));
const segFor = (x: string, y: string, br?: boolean) => INC.filter((i) => !!i.br === !!br && ((i.a === x && i.b === y) || (i.a === y && i.b === x)));
const depotFor = (st: string) => DEPOT.filter((d) => d.station === st);
function bcell(list: (Inc | Depot)[], side: 'R' | 'L'): string {
  const it = list.find((i) => (side === 'R' ? i.dir === 'up' : i.dir === 'down')) as (Inc & Partial<Depot> & { depot?: boolean }) | undefined;
  const zc = side === 'R' ? `${styles.zone} ${styles.zoneR}` : `${styles.zone} ${styles.zoneL}`;
  const cc = side === 'R' ? `${styles.cap} ${styles.capR}` : `${styles.cap} ${styles.capL}`;
  if (!it) return `<div class="${zc}"></div><div class="${cc}"></div>`;
  const isDepot = (it as { depot?: boolean }).depot;
  const barCls = (side === 'R' ? `${styles.bar} ${styles.barR}` : `${styles.bar} ${styles.barL}`) + (isDepot ? ` ${styles.depot}` : '');
  const bar = `<div class="${zc}"><div class="${barCls}" style="width:${px(it.g)}px"></div></div>`;
  const grade = (it as Inc).gt || String(Math.round(it.g * 100) / 100);
  const dp = isDepot ? `<div class="${styles.dp}">🚇 ${esc((it as Depot).name)}</div>` : '';
  const seg = (it as Inc).seg || '';
  const cap = `<div class="${cc}">${dp}<div class="${styles.l1}"><span class="${styles.g}">${esc(grade)}<i>‰</i></span><span class="${styles.sn}">${esc(seg)}</span></div><div class="${styles.bk}">${esc(it.blk)}</div></div>`;
  return side === 'R' ? bar + cap : cap + bar;
}
const irow = (list: (Inc | Depot)[]) => `<div class="${styles.brow}">${bcell(list, 'L')}<div></div>${bcell(list, 'R')}</div>`;
function buildV(arr: string[], br: boolean): string {
  let h = '';
  for (let k = 0; k < arr.length; k++) {
    const st = arr[k];
    h += `<div class="${styles.prow}"><span class="${styles.pill}${TERM[st] ? ` ${styles.term}` : ''}${JCT[st] ? ` ${styles.jct}` : ''}">${esc(st)}</span></div>`;
    const dps = depotFor(st);
    if (dps.length) { dps.forEach((d) => ((d as Depot & { depot?: boolean }).depot = true)); h += irow(dps); }
    if (k < arr.length - 1) { const segs = segFor(st, arr[k + 1], br); h += segs.length ? irow(segs) : `<div class="${styles.spacer}"></div>`; }
  }
  return h;
}

export default function Line5GradientProfile() {
  const [view, setView] = useState<'H' | 'V'>('H');
  const H = useMemo(() => ({
    up: buildH(MAIN, 'up', false, true),
    dn: buildH(MAIN, 'down', false, false),
    br: buildH(BRANCH, 'down', true, false),
  }), []);
  const V = useMemo(() => ({ main: buildV(MAIN, false), br: buildV(BRANCH, true) }), []);

  return (
    <section className={styles.wrap} aria-label="5호선 상구배 단면도">
      <p className={styles.sub}>20‰ 넘는 오르막만 · 급할수록 더 가파르고 높게 · 상선 퍼플 / 하선 스카이</p>

      <div className={styles.toggle} role="tablist" aria-label="보기 전환">
        <button type="button" role="tab" aria-selected={view === 'H'} className={`${styles.tbtn} ${view === 'H' ? styles.on : ''}`} onClick={() => setView('H')}>
          <TrendingUp size={16} strokeWidth={2.2} /> 가로 보기
        </button>
        <button type="button" role="tab" aria-selected={view === 'V'} className={`${styles.tbtn} ${view === 'V' ? styles.on : ''}`} onClick={() => setView('V')}>
          <AlignJustify size={16} strokeWidth={2.2} /> 세로 보기
        </button>
      </div>

      <div className={styles.legend}>
        <span className={styles.lg}><span className={`${styles.ramp} ${styles.rampB}`} /> 완만 20‰</span>
        <span className={styles.lg}><span className={`${styles.ramp} ${styles.rampA}`} /> 급경사 34‰</span>
        <span className={`${styles.lg} ${styles.lgUp}`}><b>■ 상선</b> 방화 방면</span>
        <span className={`${styles.lg} ${styles.lgDown}`}><b>■ 하선</b> 하남·마천 방면</span>
      </div>

      {view === 'H' ? (
        <div className={styles.views}>
          <div className={styles.secTitle}><span className={`${styles.tag} ${styles.tagUp}`}>상선</span> 방화 방면 · 본선 <span className={styles.dst}>방화 ◀ 하남검단산</span></div>
          <div className={styles.scroll} dangerouslySetInnerHTML={{ __html: H.up }} />
          <p className={styles.hint}>← 좌우로 밀어서 전체 구간 보기 →</p>
          <div className={styles.secTitle}><span className={`${styles.tag} ${styles.tagDown}`}>하선</span> 하남 방면 · 본선 <span className={styles.dst}>방화 → 하남검단산</span></div>
          <div className={styles.scroll} dangerouslySetInnerHTML={{ __html: H.dn }} />
          <p className={styles.hint}>← 좌우로 밀어서 전체 구간 보기 →</p>
          <div className={styles.secTitle}><span className={`${styles.tag} ${styles.tagDown}`}>하선</span> 마천 방면 · 마천 지선 <span className={styles.dst}>강동 → 마천</span></div>
          <div className={styles.scroll} dangerouslySetInnerHTML={{ __html: H.br }} />
        </div>
      ) : (
        <div className={styles.views}>
          <div className={styles.secTitle}>본선 <span className={styles.dst}>방화 ↔ 하남검단산 · 상선▶ · 하선◀</span></div>
          <div className={styles.diagram} dangerouslySetInnerHTML={{ __html: V.main }} />
          <div className={styles.secTitle}>마천 지선 <span className={styles.dst}>강동 분기 · 마천 방면</span></div>
          <div className={styles.diagram} dangerouslySetInnerHTML={{ __html: V.br }} />
        </div>
      )}
    </section>
  );
}
