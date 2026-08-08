import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 저장 계약 회귀 테스트 (STORE-PERSIST-001)
 *
 * 왜 이 테스트가 있나 —
 *   train-dia 는 기관사 175명의 교번·메모·바로가기·퀴즈 진도를 **localStorage 에** 들고 있다.
 *   서버 백업이 없는 데이터가 대부분이라, 아래 두 가지가 벌어지면 **전 사용자 데이터가
 *   조용히 사라진다**. 화면은 멀쩡히 뜨고 에러도 안 나서 배포 후에야 안다.
 *
 *   1. **persist 키 이름 변경** — `name: 'diaMemos'` 를 `'dia-memos'` 로 "정리"하는 순간
 *      기존 저장분을 못 찾는다. 사용자에겐 "메모가 다 없어졌다"로 보인다.
 *   2. **version 을 올렸는데 migrate 가 없음** — zustand persist 는 버전이 다르고 migrate 가
 *      없으면 저장된 상태를 **버린다**(기본 동작). 진도·설정이 초기화된다.
 *
 *   그래서 이 파일은 "키 이름과 버전을 **계약**으로 고정"한다.
 *   의도적으로 바꿔야 한다면 아래 표를 고치면서 **마이그레이션을 함께 넣는지** 자문하게 된다.
 *
 * ⚠️ 이 테스트가 깨졌다면 먼저 물어라: "기존 사용자의 저장분은 어떻게 되나?"
 */

const STORES_DIR = join(process.cwd(), 'src', 'stores');

/** 실측 고정 (2026-08-09). 키를 바꾸려면 마이그레이션 경로를 함께 준비할 것. */
const CONTRACT: Record<string, { key: string; version: number | null }> = {
  'alarm.ts': { key: 'dia-alarm', version: null },
  'auth.ts': { key: 'traindia-auth', version: null },
  'bonsai.ts': { key: 'train-dia-bonsai', version: 2 },
  'compare.ts': { key: 'dia-compare', version: 3 },
  'driver.ts': { key: 'dp', version: 3 },
  'exchange.ts': { key: 'exchange-posts', version: null },
  'fontSize.ts': { key: 'dia-font-size', version: null },
  'healingCard.ts': { key: 'dia-healing-card', version: null },
  'memo.ts': { key: 'diaMemos', version: null },
  'office.ts': { key: 'officeDash', version: 4 },
  'quiz.ts': { key: 'quizState', version: null },
  'quizProgress.ts': { key: 'regQuizProgress', version: null },
  'shortcuts.ts': { key: 'diaShortcuts', version: 1 },
  'swap.ts': { key: 'diaSwaps', version: null },
};

interface Parsed {
  file: string;
  key: string | null;
  version: number | null;
  hasMigrate: boolean;
}

function parseStores(): Parsed[] {
  const out: Parsed[] = [];
  for (const f of readdirSync(STORES_DIR)) {
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(join(STORES_DIR, f), 'utf8');
    if (!/persist\s*\(/.test(src)) continue;
    const key = src.match(/name:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
    const vRaw = src.match(/version:\s*(\d+)/)?.[1];
    out.push({
      file: f,
      key,
      version: vRaw === undefined ? null : Number(vRaw),
      hasMigrate: /migrate\s*:/.test(src),
    });
  }
  return out;
}

const parsed = parseStores();

describe('저장 계약 — persist 키 이름 (바뀌면 전 사용자 데이터 유실)', () => {
  it('persist 를 쓰는 store 목록이 계약과 일치한다', () => {
    const found = parsed.map((p) => p.file).sort();
    expect(found).toEqual(Object.keys(CONTRACT).sort());
  });

  for (const [file, expected] of Object.entries(CONTRACT)) {
    it(`${file} 의 저장 키는 '${expected.key}' 여야 한다`, () => {
      const p = parsed.find((x) => x.file === file);
      expect(p, `${file} 이 persist store 목록에서 사라졌다`).toBeDefined();
      expect(p!.key).toBe(expected.key);
    });
  }

  it('저장 키가 서로 겹치지 않는다', () => {
    const keys = parsed.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('저장 계약 — version 과 migrate (버전만 올리면 저장분이 버려진다)', () => {
  for (const [file, expected] of Object.entries(CONTRACT)) {
    it(`${file} 의 version 이 ${expected.version ?? '없음'} 에서 안 바뀌었다`, () => {
      const p = parsed.find((x) => x.file === file)!;
      expect(p.version).toBe(expected.version);
    });
  }

  it('version 을 올린 store 는 migrate 를 갖는다 — 없으면 저장분이 버려진다', () => {
    const risky = parsed.filter((p) => p.version !== null && p.version > 0 && !p.hasMigrate);
    // ⚠️ 아래 2개는 이미 migrate 없이 version 이 올라간 상태다(부채).
    //    지금 migrate 를 소급해 넣을 수는 없지만(이미 버려진 뒤), **다음 bump 때는 반드시 넣어야 한다**.
    //    새 store 가 이 목록에 들어오면 테스트가 깨져서 알아차리게 된다.
    const KNOWN_DEBT = ['bonsai.ts', 'shortcuts.ts'];
    const unexpected = risky.map((p) => p.file).filter((f) => !KNOWN_DEBT.includes(f));
    expect(unexpected, `version 을 올렸는데 migrate 가 없다 → 저장분이 버려진다: ${unexpected.join(', ')}`).toEqual([]);
  });
});

describe('저장 계약 — 스토리지가 없어도 앱이 죽지 않는다', () => {
  it('localStorage 가 던져도 store import 가 실패하지 않는다', async () => {
    // 사파리 프라이빗 모드 / 용량 초과에서 실제로 일어나는 상황.
    // zustand persist 는 경고만 남기고 메모리 상태로 계속 동작해야 한다.
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      await expect(import('../memo')).resolves.toBeDefined();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
  });
});
