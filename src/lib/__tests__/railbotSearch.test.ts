/**
 * 레일봇 검색 — «같은 질문이면 띄어쓰기가 달라도 같은 답» 을 지키는 시험.
 *
 * 예전 방식은 질문을 통째로 이어 붙인 뒤 조각을 뽑아, 띄어쓰기를 바꾸면 조각이 달라지고
 * 답도 달라졌다. 낱말 단위로 뜻을 잡고 이어 붙인 구를 따로 세는 지금 방식은 그러지 않아야
 * 한다. 이 시험이 그것을 지킨다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { search, type Chunk } from '../railbotSearch';

const INDEX = path.join(process.cwd(), 'public/data/edu/railbot-index.json');
const chunks = JSON.parse(fs.readFileSync(INDEX, 'utf8')) as Chunk[];

const top = (q: string, n = 1) =>
  search(chunks, q, null, 8).slice(0, n).map((h) => h.c.source);

describe('띄어쓰기가 달라도 같은 답', () => {
  const same: [string, string[]][] = [
    ['판타그라프 상승불량', ['판타그라프상승불량', '판타 그라프 상승 불량', '판타그라프상승 불량']],
    ['확인운전 명령', ['확인운전명령', '확인 운전 명령']],
    ['주박할 때 확인', ['주박할때 확인', '주박 할 때 확인']],
    // 진호 지적 — 「출고 점검시」 로 띄면 «출고점검» 이 안 만들어져 엉뚱한 「주의사항」 조문이 나왔다
    ['출고점검 주의사항', ['출고 점검시 주의 사항', '출고점검시 주의사항', '출고 점검 주의사항']],
  ];
  for (const [base, variants] of same) {
    for (const v of variants) {
      it(`「${base}」 = 「${v}」`, () => {
        expect(top(v)).toEqual(top(base));
      });
    }
  }
});

describe('낱말을 두루 덮은 쪽이 이긴다', () => {
  it('「판타그라프 상승불량」 은 그 제목을 가진 대목이 1등', () => {
    expect(top('판타그라프 상승불량')[0]).toContain('판타그라프 상승불량');
  });

  it('「확인운전 명령」 은 제55조(확인운전 명령)가 1등', () => {
    expect(top('확인운전 명령')[0]).toContain('제55조');
  });

  it('「출고 점검시 주의 사항」 은 주제(출고점검)가 이긴다 — 흔한 「주의사항」 이 아니라', () => {
    // 아무 조문에나 있는 「주의사항」 이 주제어를 이기던 것을 막는다
    expect(top('출고 점검시 주의 사항', 2).join(' ')).toContain('출고점검');
  });

  it('출고를 물었는데 입고가 나오지 않는다', () => {
    const hits = top('출고점검', 3).join(' ');
    expect(hits).toContain('출고점검');
  });
});

describe('근거가 없으면 답하지 않는다', () => {
  it('업무와 무관한 질문은 아무것도 못 찾거나 아주 낮은 점수', () => {
    const hits = search(chunks, "오늘 점심 뭐 먹지", null, 8);
    expect(hits.length === 0 || hits[0].score < 15).toBe(true);
  });
});

describe('왜 이 답인지 돌려준다', () => {
  it('걸린 말을 함께 준다 — 화면에서 색칠할 것', () => {
    const hits = search(chunks, '판타그라프 상승불량', null, 8);
    expect(hits[0].terms.length).toBeGreaterThan(0);
    expect(hits[0].terms.join(' ')).toContain('판타그라프');
  });
});
