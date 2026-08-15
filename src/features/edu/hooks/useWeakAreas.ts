'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEduStore } from './useEduStore';

/**
 * 취약 영역 분석 — 미해결 오답을 문제은행의 영역(area)별로 묶는다.
 *
 * 오답 기록(WrongAnswer)에는 area 가 없고 questionId 만 있다. 그래서 문제은행에서
 * questionId → area 역인덱스를 만들어 되찾는다. 덕분에 **이미 쌓여 있던 오답도
 * 그대로 분석된다** — 새 기록을 기다릴 필요가 없다.
 *
 * '정답률'이 아니라 '영역 문항 수 대비 미해결 오답 비율'을 쓰는 이유:
 *   지금 스토어는 틀린 문제만 저장하고 푼 문제 수는 영역별로 남기지 않는다.
 *   따라서 진짜 정답률은 계산할 수 없다. 비율은 "이 영역에서 아직 못 잡은 문제가
 *   얼마나 되는가" 를 뜻하며, 있는 데이터로 정직하게 낼 수 있는 값이다.
 */

export interface AreaDef {
  id: string;
  name: string;
  chapters: string[];
  level: number;
}

export interface WeakArea {
  id: string;
  name: string;
  level: number;
  /** 이 영역의 전체 문항 수 */
  total: number;
  /** 미해결 오답 수 */
  wrong: number;
  /** wrong / total (0~1) */
  ratio: number;
  /** 대표 챕터 — 교재로 넘어갈 때 쓴다 */
  chapters: string[];
}

interface QuizBank {
  areas?: AreaDef[];
  questions?: { id: string; area: string }[];
}

export function useWeakAreas() {
  const { unresolvedWrongs } = useEduStore();
  const [bank, setBank] = useState<QuizBank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/data/edu/handbook-quiz.json')
      .then((r) => r.json())
      .then((d: QuizBank) => { if (alive) { setBank(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const areas = useMemo<WeakArea[]>(() => {
    if (!bank?.areas || !bank.questions) return [];

    const areaOf = new Map<string, string>();   // questionId → areaId
    const totalOf = new Map<string, number>();  // areaId → 문항 수
    for (const q of bank.questions) {
      areaOf.set(q.id, q.area);
      totalOf.set(q.area, (totalOf.get(q.area) ?? 0) + 1);
    }

    const wrongOf = new Map<string, number>();
    for (const w of unresolvedWrongs) {
      const a = areaOf.get(w.questionId);
      // 규정 퀴즈 오답은 문제은행에 없다 → 영역 분석 대상 아님
      if (!a) continue;
      wrongOf.set(a, (wrongOf.get(a) ?? 0) + 1);
    }

    return bank.areas
      .map((a) => {
        const total = totalOf.get(a.id) ?? 0;
        const wrong = wrongOf.get(a.id) ?? 0;
        return {
          id: a.id, name: a.name, level: a.level,
          total, wrong,
          ratio: total > 0 ? wrong / total : 0,
          chapters: a.chapters ?? [],
        };
      })
      .filter((a) => a.wrong > 0)
      .sort((a, b) => b.ratio - a.ratio || b.wrong - a.wrong);
  }, [bank, unresolvedWrongs]);

  /** 분석 대상이 된 오답 수 (규정 퀴즈 오답은 빠진다) */
  const analyzed = useMemo(
    () => areas.reduce((s, a) => s + a.wrong, 0),
    [areas],
  );

  return { areas, analyzed, loading };
}
