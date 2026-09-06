/**
 * 교번 비교 표에서 어떤 근무를 누를 수 있는가.
 *
 * 누를 수 있는 것만 눌리게 해야 한다 — 눌렀는데 「표 이미지가 준비되지 않았어요」 가
 * 뜨면 그건 고장으로 보인다. 휴무·비번·대기는 애초에 볼 운전행로가 없다.
 */

import { describe, it, expect } from 'vitest';
import { hasDiaChart } from '@/components/layout/DiaChartModal';

describe('hasDiaChart', () => {
  it('근무 교번은 누를 수 있다', () => {
    for (const dia of ['1', '25', '42', '65', '91']) {
      expect(hasDiaChart(dia)).toBe(true);
    }
  });

  it('휴무·비번·대기는 누를 수 없다', () => {
    for (const dia of ['휴25', '휴3', '65~', '91~', '대1', '대10', '대61']) {
      expect(hasDiaChart(dia)).toBe(false);
    }
  });

  it('빈 값도 안전하다', () => {
    expect(hasDiaChart(null)).toBe(false);
    expect(hasDiaChart(undefined)).toBe(false);
    expect(hasDiaChart('')).toBe(false);
  });
});
