/**
 * 청렴 경진대회 — 대회를 무너뜨리는 세 가지를 막는다.
 *   · 정답이 클라이언트 파일에 섞여 들어가는 것 (보이면 대회가 끝난다)
 *   · 정답표가 보기 범위를 벗어나는 것 (채점이 조용히 전부 오답이 된다)
 *   · 기간 경계가 UTC 로 밀리는 것 (27일 밤 응시가 막히거나 28일 새벽이 열린다)
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  INTEGRITY_QUESTIONS,
  INTEGRITY_TOTAL,
  INTEGRITY_CHOICE_COUNT,
  INTEGRITY_OX_COUNT,
} from '@/data/integrityQuiz';
import { INTEGRITY_ANSWER_KEY, INTEGRITY_ANSWER_BY_NO } from '@/lib/integrityAnswerKey';
import { integrityPhase, kstToday } from '@/lib/integrityWindow';

describe('문제지', () => {
  it('20문제 — 사지선다 15, OX 5', () => {
    expect(INTEGRITY_TOTAL).toBe(20);
    expect(INTEGRITY_CHOICE_COUNT).toBe(15);
    expect(INTEGRITY_OX_COUNT).toBe(5);
  });

  it('문항 번호는 1부터 빠짐없이, 보기 수는 사지선다 4 · OX 2', () => {
    INTEGRITY_QUESTIONS.forEach((q, i) => {
      expect(q.no).toBe(i + 1);
      expect(q.q.length).toBeGreaterThan(5);
      expect(q.options.length).toBe(q.type === 'ox' ? 2 : 4);
      expect(new Set(q.options).size).toBe(q.options.length); // 같은 보기 두 번 금지
    });
  });

  it('클라이언트로 내려가는 문제 파일에 정답이 없다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/data/integrityQuiz.ts'), 'utf8');
    // 정답(answer)·해설(why) «필드» 가 없어야 한다 — 설명하는 주석은 상관없다
    expect(src).not.toMatch(/answer\s*:/);
    expect(src).not.toMatch(/why\s*:/);
    // 정답표를 import 해 오는 순간 같은 번들에 실린다
    expect(src).not.toMatch(/integrityAnswerKey['"]/);
  });
});

describe('정답표', () => {
  it('모든 문항에 정답이 하나씩 있고, 그 번호가 보기 안에 있다', () => {
    expect(INTEGRITY_ANSWER_KEY.length).toBe(INTEGRITY_TOTAL);
    for (const q of INTEGRITY_QUESTIONS) {
      const answer = INTEGRITY_ANSWER_BY_NO.get(q.no);
      expect(answer, `${q.no}번 정답`).toBeDefined();
      expect(answer).toBeGreaterThanOrEqual(1);
      expect(answer).toBeLessThanOrEqual(q.options.length);
    }
  });

  it('해설이 비어 있지 않다 — 시상 뒤 공개할 몫', () => {
    for (const a of INTEGRITY_ANSWER_KEY) {
      expect(a.why.length, `${a.no}번 해설`).toBeGreaterThan(10);
    }
  });
});

describe('응시 기간 — 한국 날짜로 끊는다', () => {
  it('9월 18일에 열리고 27일까지', () => {
    expect(integrityPhase('2026-09-17')).toBe('before');
    expect(integrityPhase('2026-09-18')).toBe('open');
    expect(integrityPhase('2026-09-27')).toBe('open');
    expect(integrityPhase('2026-09-28')).toBe('closed');
  });

  it('27일 밤 11시(한국)는 아직 열려 있다 — UTC 로 세면 막혔을 시각', () => {
    const lateNightKst = new Date('2026-09-27T14:00:00Z'); // KST 23:00
    expect(kstToday(lateNightKst)).toBe('2026-09-27');
    expect(integrityPhase(kstToday(lateNightKst))).toBe('open');
  });

  it('28일 0시(한국)면 닫힌다', () => {
    const midnightKst = new Date('2026-09-27T15:00:00Z'); // KST 09-28 00:00
    expect(kstToday(midnightKst)).toBe('2026-09-28');
    expect(integrityPhase(kstToday(midnightKst))).toBe('closed');
  });
});
