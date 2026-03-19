'use client';

import styles from '../styles/edu.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ContentRendererProps {
  blocks: any[];
}

function FlowBlock({ title, steps }: { title?: string; steps: any[] }) {
  return (
    <div>
      {title && <div className={styles.heading}>{title}</div>}
      <div className={styles.flowWrap}>
        {steps.map((step: any, i: number) => (
          <div key={i} className={styles.flowStep}>
            <div className={styles.flowDot} />
            <div className={styles.flowLabel}>{step.label}</div>
            <div className={styles.flowItems}>
              {step.items.map((item: string, j: number) => (
                <div key={j} className={styles.flowItem}>{item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableBlock({ headers, rows, highlightRows }: { headers: string[]; rows: string[][]; highlightRows?: number[] }) {
  const hlSet = highlightRows ? new Set(highlightRows) : null;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={hlSet?.has(i) ? styles.tableRowHighlight : undefined}>
              {row.map((cell, j) => (
                <td key={j}>{cell.split('\n').map((line, k) => (
                  <span key={k}>{line}{k < cell.split('\n').length - 1 && <br />}</span>
                ))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareBlock({ items }: { items: any[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dia-space-3)' }}>
      {/* STYLE-EXCEPTION: flex-direction은 토큰으로 표현 불가 */}
      {items.map((item: any, i: number) => (
        <div key={i} className={styles.compareCard}>
          <div className={styles.compareTitle}>{item.category}</div>
          <div className={styles.compareRow}>
            {item.abb !== undefined && (
              <div className={styles.compareItem}>
                <div className={styles.compareLabel}>ABB</div>
                <div className={styles.compareText}>{item.abb}</div>
              </div>
            )}
            {item.woojin !== undefined && (
              <div className={styles.compareItem}>
                <div className={styles.compareLabel}>우진</div>
                <div className={styles.compareText}>{item.woojin}</div>
              </div>
            )}
            {item.rotem !== undefined && (
              <div className={styles.compareItem}>
                <div className={styles.compareLabel}>로템</div>
                <div className={styles.compareText}>{item.rotem}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListBlock({ items }: { items: { term: string; desc: string }[] }) {
  return (
    <div className={styles.defList}>
      {items.map((item, i) => (
        <div key={i} className={styles.defItem}>
          <div className={styles.defTerm}>{item.term}</div>
          <div className={styles.defDesc}>{item.desc}</div>
        </div>
      ))}
    </div>
  );
}

export default function ContentRenderer({ blocks }: ContentRendererProps) {
  return (
    <>
      {blocks.map((block: any, i: number) => {
        switch (block.type) {
          case 'heading':
            return <h3 key={i} className={styles.heading}>{block.text}</h3>;
          case 'text':
            return <p key={i} className={styles.textBlock}>{block.text}</p>;
          case 'callout':
            return (
              <div
                key={i}
                className={`${styles.callout} ${
                  block.variant === 'warning' ? styles.calloutWarning :
                  block.variant === 'danger' ? styles.calloutDanger :
                  styles.calloutInfo
                }`}
              >
                {block.text}
              </div>
            );
          case 'flow':
            return <FlowBlock key={i} title={block.title} steps={block.steps} />;
          case 'table':
            return <TableBlock key={i} headers={block.headers} rows={block.rows} highlightRows={block.highlightRows} />;
          case 'compare':
            return <CompareBlock key={i} items={block.items} />;
          case 'list':
            return <ListBlock key={i} items={block.items} />;
          default:
            return null;
        }
      })}
    </>
  );
}
