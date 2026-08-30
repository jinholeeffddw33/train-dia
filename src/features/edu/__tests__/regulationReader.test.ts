import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { articleToChunks, articleTitle, type ReaderArticle } from '../hooks/useRegulationReader';

/**
 * 규정 읽어주기 전수 점검 — 9종 892조문을 실제 낭독 변환기에 통과시킨다.
 *
 * 귀로만 듣는 기능이라 눈으로는 이상을 못 찾는다. 그래서 «소리로 나가면 이상한 것» 을
 * 규칙으로 못 박는다: 빈 조각, 기호만 남은 조각, 지워졌어야 할 표시(【표】·<개정 …>),
 * 한 번에 못 읽을 만큼 긴 조각.
 */

const DIR = path.join(process.cwd(), 'public', 'data', 'edu', 'regulations');
const IDS = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('-articles.json'))
  .map((f) => f.replace('-articles.json', ''))
  .sort();

function load(id: string): ReaderArticle[] {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, `${id}-articles.json`), 'utf-8'));
  return Array.isArray(raw) ? raw : (raw.articles ?? []);
}

/** 크롬이 한 발화로 무리 없이 읽는 상한(CHUNK_MAX 120 + 병합 여유 40) */
const SANE_MAX = 160;

describe('규정 읽어주기 — 전수 점검', () => {
  it('규정 9종이 모두 조문 파일을 가지고 있다', () => {
    expect(IDS.length).toBe(9);
    for (const id of IDS) {
      expect(fs.existsSync(path.join(DIR, `${id}-search.json`)), id).toBe(true);
      expect(load(id).length, id).toBeGreaterThan(0);
    }
  });

  it.each(IDS)('%s — 모든 조문이 읽을 수 있는 조각으로 쪼개진다', (id) => {
    const arts = load(id);
    const bad: string[] = [];

    for (const a of arts) {
      const chunks = articleToChunks(a);

      if (chunks.length === 0) { bad.push(`제${a.n}조: 읽을 게 하나도 없음`); continue; }
      if (chunks[0].kind !== 'head') bad.push(`제${a.n}조: 조문 머리가 없음`);
      // 표만 있는 조문은 머리 + 안내 두 조각이면 정상
      const isTableOnly = chunks.length === 2 && chunks[1].kind === 'notice';
      if (!isTableOnly && chunks.filter((c) => c.kind === 'body').length === 0) {
        bad.push(`제${a.n}조: 본문 조각이 없음`);
      }

      for (const c of chunks) {
        const t = c.text;
        if (!t.trim()) { bad.push(`제${a.n}조: 빈 조각`); continue; }
        // 소리로 뜻이 없는 조각(기호·숫자만) — "쉼표" 하나만 읽히는 사고
        if (!/[가-힣]/.test(t)) bad.push(`제${a.n}조: 글자 없는 조각 «${t}»`);
        if (t.includes('【표】') || t.includes('【/표】')) bad.push(`제${a.n}조: 표 표시가 남음 «${t.slice(0, 40)}»`);
        if (/[<〈][^>〉]{0,40}[>〉]/.test(t)) bad.push(`제${a.n}조: 개정 이력이 남음 «${t.slice(0, 40)}»`);
        if (/[“”‘’"]/.test(t)) bad.push(`제${a.n}조: 따옴표가 남음 «${t.slice(0, 40)}»`);
        // 도면 문자·화살표는 소리로 뜻이 없다 (제164조 완장 치수선 등)
        if (/[←→⇒⇔↑↓▲▼―─━│]/.test(t)) bad.push(`제${a.n}조: 도면 문자가 남음 «${t.slice(0, 40)}»`);
        // 기호를 걷어낸 자리에 쉼표만 겹쳐 남으면 말이 뚝뚝 끊긴다
        if (/,\s*,|^\s*,|[.?!]\s*,/.test(t)) bad.push(`제${a.n}조: 쉼표가 겹침 «${t.slice(0, 40)}»`);
        if (/\bnull\b/i.test(t)) bad.push(`제${a.n}조: «null» 을 읽는다 «${t.slice(0, 40)}»`);
        if (t.length > SANE_MAX) bad.push(`제${a.n}조: 조각이 너무 김 (${t.length}자)`);
      }
    }

    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('표가 대부분인 조문은 통째로 읽지 않고 안내만 한다', () => {
    let tableOnly = 0;
    for (const id of IDS) {
      for (const a of load(id)) {
        if (!a.hasTable || (a.tableShare ?? 0) < 50) continue;
        const chunks = articleToChunks(a);
        expect(chunks).toHaveLength(2);
        expect(chunks[1].kind).toBe('notice');
        tableOnly++;
      }
    }
    expect(tableOnly).toBeGreaterThan(0);   // 실제로 그런 조문이 있어야 이 검사가 의미 있다
  });

  it('조문 머리는 «제N조. 제목.» 으로 읽는다', () => {
    const [head] = articleToChunks({ n: 3, title: '정의', text: '제3조(정의) 이 규정에서…' });
    expect(head.kind).toBe('head');
    expect(head.text).toContain('제3조');
    expect(head.text).toContain('정의');
  });

  /**
   * 원본 PDF 에 «제15조(null)» 로 인쇄된 조문이 19곳 있다(삭제된 조문).
   * 화면은 원본 그대로 보여 주되, 소리로 «널» 이라고 읽으면 안 된다.
   */
  it('제목이 «null» 인 조문은 번호만 읽는다', () => {
    const [head] = articleToChunks({ n: 15, title: 'null', text: '제15조(null)\n삭제 ’19.2.1.' });
    expect(head.text).toBe('제15조.');
    expect(articleTitle('null')).toBe('');
    expect(articleTitle('  ')).toBe('');
    expect(articleTitle('정의')).toBe('정의');
  });

  it('원본에 «null» 제목이 남아 있는 동안에도 낭독에는 새지 않는다', () => {
    let nullTitles = 0;
    for (const id of IDS) {
      for (const a of load(id)) {
        if (articleTitle(a.title) === '' && (a.title ?? '').trim()) nullTitles++;
        for (const c of articleToChunks(a)) expect(c.text, `${id} 제${a.n}조`).not.toMatch(/\bnull\b/i);
      }
    }
    expect(nullTitles).toBe(19);   // 줄면 원본이 고쳐진 것 — 그때 이 숫자를 내린다
  });
});
