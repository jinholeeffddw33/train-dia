'use client';

import { getRouteDiagram } from '@/data/routeDiagrams';
import styles from './RouteDiagram.module.css';

interface Props {
  /** 교번 (예: "79") */
  dia: string;
  /** 근무 index (0 = 1근무, 1 = 2근무) */
  seg: number;
}

/**
 * 행로도(노선 축) — 근무 1개 조각을 카드 안에 인라인 표시.
 * 가로 = 노선 위치(왼쪽 방화 / 오른쪽 마천·하남). 출발시각은 크고 진하게 강조.
 */
export default function RouteDiagram({ dia, seg }: Props) {
  const d = getRouteDiagram(dia);
  const s = d?.segs[seg];
  if (!s) return null;

  const [vx, vy, vw, vh] = s.viewBox;

  return (
    <div className={styles.scroll}>
      <svg
        className={styles.svg}
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        role="img"
        aria-label={`${seg + 1}근무 행로`}
      >
        {/* 연결선 · 화살표 */}
        {s.paths.map((p, i) => (
          <path key={`p${i}`} className={styles.rdLine} d={p} />
        ))}

        {/* 기지 출고 시작점 ● */}
        {s.nodes.map((node, i) => (
          <circle key={`n${i}`} className={styles.rdNode} cx={node.x} cy={node.y} r={4} />
        ))}

        {/* 시각 / km */}
        {s.texts.map((t, i) => (
          <text
            key={`t${i}`}
            className={t.dep ? styles.rdDep : t.kind === 'km' ? styles.rdKm : styles.rdTime}
            x={t.x}
            y={t.y}
            textAnchor={t.anchor ?? 'start'}
          >
            {t.t}
          </text>
        ))}

        {/* 열차번호 알약 */}
        {s.pills.map((p, i) => (
          <g key={`pl${i}`}>
            <rect className={styles.rdPill} x={p.x} y={p.y} width={46} height={22} rx={11} />
            <text className={styles.rdPillTx} x={p.x + 23} y={p.y + 15} textAnchor="middle">
              {p.t}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
