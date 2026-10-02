import { describe, it, expect } from 'vitest';
import { readVersion, nextVersion, formatVersion, writeVersion, touchesApp } from '../lib/app-version.mjs';

const SRC = "// head\r\nexport const APP_VERSION = 'v4.0.2';\r\n\r\nexport const BUILD_ID = 'x';\r\n";

describe('앱 버전 자동 올림', () => {
  it('버전 줄을 읽는다', () => {
    expect(readVersion(SRC)).toEqual([4, 0, 2]);
    expect(readVersion('no version here')).toBeNull();
  });

  it('끝자리를 하나 올린다', () => {
    expect(formatVersion(nextVersion([4, 0, 2], null))).toBe('v4.0.3');
  });

  it('원격이 더 앞서 있으면 원격에서 올린다 — 같은 번호가 두 번 나가지 않게', () => {
    expect(formatVersion(nextVersion([4, 0, 2], [4, 0, 7]))).toBe('v4.0.8');
    expect(formatVersion(nextVersion([4, 1, 0], [4, 0, 9]))).toBe('v4.1.1');
  });

  it('끝자리는 9 까지 — 그다음은 앞자리가 오른다', () => {
    expect(formatVersion(nextVersion([4, 0, 9], null))).toBe('v4.1.0');
    expect(formatVersion(nextVersion([4, 1, 1], null))).toBe('v4.1.2');
    expect(formatVersion(nextVersion([4, 9, 9], null))).toBe('v5.0.0');
  });

  it('예전 규칙으로 두 자리가 된 번호도 맞춰서 올린다 (v4.0.12 = v4.1.2)', () => {
    expect(formatVersion(nextVersion([4, 0, 12], null))).toBe('v4.1.3');
    expect(formatVersion(nextVersion([4, 1, 2], [4, 0, 12]))).toBe('v4.1.3');
  });

  it('버전 번호만 바꾸고 줄바꿈과 다른 줄은 그대로 둔다', () => {
    const out = writeVersion(SRC, [4, 0, 3]);
    expect(out).toBe(SRC.replace("'v4.0.2'", "'v4.0.3'"));
    expect(out.split('\r\n').length).toBe(SRC.split('\r\n').length);
  });

  it('앱 파일이 바뀐 커밋만 올린다', () => {
    expect(touchesApp(['src/features/edu/styles/edu.module.css'])).toBe(true);
    expect(touchesApp(['public/sw.js'])).toBe(true);
    expect(touchesApp(['docs/PROCESS_RULES.md', 'scripts/x.mjs'])).toBe(false);
    expect(touchesApp(['src/lib/constants.ts'])).toBe(false);
  });
});
