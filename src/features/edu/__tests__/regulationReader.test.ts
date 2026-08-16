import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { articleToChunks, type ReaderArticle } from '../hooks/useRegulationReader';

const DIR = path.join(process.cwd(), 'public/data/edu/regulations');

function load(id: string): ReaderArticle[] {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${id}-articles.json`), 'utf-8'));
}

describe('규정 낭독 — 표 처리', () => {
  it('표 마커 안의 내용은 낭독하지 않는다', () => {
    const a: ReaderArticle = {
      n: 1, title: '시험',
      text: '제1조(시험) 앞 문장이다. 【표】기울기(‰) 90 80 75【/표】 뒤 문장이다.',
      hasTable: true, tableShare: 30,
    };
    const said = articleToChunks(a).map((c) => c.text).join(' ');
    expect(said).not.toContain('기울기');
    expect(said).not.toContain('【표】');
    expect(said).toContain('앞 문장이다.');
    expect(said).toContain('뒤 문장이다.');
    expect(said).toContain('여기에 표가 있습니다');
  });

  it('표가 조문의 절반을 넘으면 조문째 안내로 대체한다', () => {
    // 표 사이에 낀 본문 조각만 남으면 따로 읽어도 말이 안 된다
    const a: ReaderArticle = {
      n: 38, title: '지적확인환호', text: '제38조(지적확인환호) 【표】…【/표】',
      hasTable: true, tableShare: 81,
    };
    const chunks = articleToChunks(a);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].kind).toBe('notice');
    expect(chunks[1].text).toContain('표로 되어 있습니다');
  });

  it('표가 없으면 안내 없이 본문만 읽는다', () => {
    const a: ReaderArticle = { n: 35, title: '이례상황보고', text: '제35조(이례상황보고) 지체없이보고한다.', hasTable: false, tableShare: 0 };
    expect(articleToChunks(a).some((c) => c.kind === 'notice')).toBe(false);
  });

  it('조문 제목은 첫 조각에서 한 번만 읽는다', () => {
    const a: ReaderArticle = { n: 7, title: '용어의정의', text: '제7조(용어의정의) 이규정에서쓰는용어는다음과같다.', hasTable: false, tableShare: 0 };
    const chunks = articleToChunks(a);
    expect(chunks[0].text).toBe('제7조. 용어의정의.');
    expect(chunks.slice(1).join(' ')).not.toContain('제7조(용어의정의)');
  });
});

describe('규정 낭독 — 실제 조문 인덱스', () => {
  const ids = fs.readdirSync(DIR).filter((f) => f.endsWith('-articles.json'))
    .map((f) => f.replace('-articles.json', ''));

  it('9개 규정 전부 조문 인덱스가 있다', () => {
    expect(ids.length).toBe(9);
  });

  it('어떤 조문도 낭독 조각이 비지 않는다', () => {
    for (const id of ids) {
      for (const a of load(id)) {
        const chunks = articleToChunks(a);
        expect(chunks.length, `${id} 제${a.n}조`).toBeGreaterThan(0);
        /* 크롬이 긴 발화를 15초쯤에서 끊는다 — 조각을 짧게 유지한다.
           다만 "한다." 같은 토막을 앞뒤에 도로 붙이느라 상한(120)을 40자까지 넘길 수 있다. */
        for (const c of chunks) expect(c.text.length, `${id} 제${a.n}조`).toBeLessThanOrEqual(160);
      }
    }
  });

  it('소리로 읽을 수 없는 기호가 남지 않는다', () => {
    // ①(항 번호) · <개정…>(이력) · ‰㎞%(단위) · ：(전각 콜론) 은 엔진마다 제멋대로 읽는다
    const bad = /[①-⑳<>〈〉：‰㎞%~∼]|\[제목개정/;
    for (const id of ids) {
      for (const a of load(id)) {
        for (const c of articleToChunks(a)) {
          expect(c.text, `${id} 제${a.n}조`).not.toMatch(bad);
        }
      }
    }
  });

  it('항·호 번호를 말로 풀어 읽는다', () => {
    const a: ReaderArticle = {
      n: 44, title: '출발도착선',
      text: '제44조(출발도착선) ① 원칙으로 한다. 1. 첫째 2. 둘째 ② 예외로 한다. <개정 2019.12.16.>',
      hasTable: false, tableShare: 0,
    };
    const said = articleToChunks(a).map((c) => c.text).join(' ');
    expect(said).toContain('제1항.');
    expect(said).toContain('제2항.');
    expect(said).toContain('제1호.');
    expect(said).not.toContain('개정');       // 개정 이력은 조문 내용이 아니다
  });

  it('단위와 날짜를 소리 나는 대로 바꾼다', () => {
    const a: ReaderArticle = {
      n: 1, title: '시험', text: '제1조(시험) 제한속도는 25㎞/h 이고 기울기는 35‰ 이다. 2017.12.21. 개정.',
      hasTable: false, tableShare: 0,
    };
    const said = articleToChunks(a).map((c) => c.text).join(' ');
    expect(said).toContain('킬로미터');
    expect(said).toContain('퍼밀');
    expect(said).toContain('2017년 12월 21일');
  });

  it('낭독 텍스트에 표 마커가 새어 나가지 않는다', () => {
    for (const id of ids) {
      for (const a of load(id)) {
        const said = articleToChunks(a).map((c) => c.text).join(' ');
        expect(said, `${id} 제${a.n}조`).not.toMatch(/【\/?표】/);
      }
    }
  });

  it('제101조(내림기울기 제한속도)는 표로 인식돼 수치를 읽지 않는다', () => {
    const a = load('operation-rules').find((x) => x.n === 101)!;
    expect(a.hasTable).toBe(true);
    const said = articleToChunks(a).map((c) => c.text).join(' ');
    expect(said).not.toContain('1,000분의10');
  });
});
