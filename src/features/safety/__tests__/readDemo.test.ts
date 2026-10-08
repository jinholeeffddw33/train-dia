import { describe, it, expect } from 'vitest';
import { readDemoActive, demoReadRatio, fillDemoReads, READ_DEMO_UNTIL } from '../lib/readDemo';

describe('발표용 읽음 현황 예시 — 체험 계정 · 10/21 까지만', () => {
  it('체험 계정만, 2026-10-22 00:00(KST) 부터는 꺼진다', () => {
    const oct21 = Date.parse('2026-10-21T23:59:00+09:00');
    const oct22 = Date.parse('2026-10-22T00:00:00+09:00');
    expect(readDemoActive('1234', oct21)).toBe(true);
    expect(readDemoActive('1234', oct22)).toBe(false);
    expect(readDemoActive('21714375', oct21)).toBe(false);
    expect(oct22).toBe(READ_DEMO_UNTIL);
  });

  it('운전정보 호수별 목표 비율', () => {
    expect(demoReadRatio('[열차] 무엇', '18호')).toBe(0.95);
    expect(demoReadRatio('[신호] 무엇', '19호')).toBe(0.85);
    expect(demoReadRatio('[시설물] 무엇', '20호')).toBe(0.7);
    expect(demoReadRatio('[503편성] 열차정보', '')).toBeGreaterThanOrEqual(0.95);
    expect(demoReadRatio('사례교육', '5호')).toBeGreaterThanOrEqual(0.95);
  });

  it('실제 읽은 사람은 그대로 두고 모자란 만큼만 채운다 — 늘 같은 결과', () => {
    const people = Array.from({ length: 100 }, (_, i) => ({ sabun: String(10000 + i), name: `직원${i}` }));
    const real = people.slice(0, 10).map((p) => ({ ...p, readAt: '2026-10-01' }));
    const a = fillDemoReads('rep1', real, people.slice(10), 0.7, 'x');
    const b = fillDemoReads('rep1', real, people.slice(10), 0.7, 'x');
    expect(a.readers.length).toBe(70);
    expect(a.nonReaders.length).toBe(30);
    expect(a.readers.slice(0, 10)).toEqual(real);
    expect(a.readers.map((p) => p.sabun)).toEqual(b.readers.map((p) => p.sabun));
  });

  it('이미 목표보다 많이 읽었으면 그대로', () => {
    const people = Array.from({ length: 10 }, (_, i) => ({ sabun: String(i), name: String(i), readAt: 'r' }));
    const out = fillDemoReads<{ sabun: string; name: string }>('x', people, [], 0.7, 'y');
    expect(out.readers.length).toBe(10);
  });
});
