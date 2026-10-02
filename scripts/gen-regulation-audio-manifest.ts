/**
 * 규정 낭독 조각 목록(매니페스트) 생성 — MP3 합성의 입력이 된다.
 *
 * 왜 별도 스크립트인가
 *   합성할 문장은 앱이 실제로 읽는 문장과 한 글자도 달라선 안 된다. 다르면 화면에
 *   보이는 문장과 들리는 소리가 어긋난다. 그래서 문장을 여기서 다시 만들지 않고
 *   앱이 쓰는 articleToChunks() 를 그대로 불러 쓴다.
 *
 *   출력  public/data/edu/regulations/{id}-audio.json
 *           { voice, chunks: { "조문번호": ["해시", …] } }
 *         .tmp_regulation_audio/{id}-manifest.json   (합성 스크립트용 — 해시 + 원문)
 *
 * 해시는 문장 내용에서 뽑는다(SHA-1 12자). 규정이 개정돼 문장이 바뀐 것만 다시
 * 합성되고 나머지는 그대로 재사용된다 — 안내방송 MP3 와 같은 방식이다.
 *
 * 사용: npx tsx scripts/gen-regulation-audio-manifest.ts [규정id …]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { articleToChunks, type ReaderArticle } from '../src/features/edu/hooks/useRegulationReader';

const DIR = 'public/data/edu/regulations';
const TMP = '.tmp_regulation_audio';
const VOICE = 'ko-KR-SunHiNeural';

/** 안내방송(gen_broadcast_mp3.py)과 같은 규칙 — 공백 정규화 후 SHA-1 앞 12자 */
function audioId(text: string): string {
  return crypto.createHash('sha1').update(text.split(/\s+/).join(' ')).digest('hex').slice(0, 12);
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (ids.length === 0) ids.push('operation-rules');

fs.mkdirSync(TMP, { recursive: true });

for (const id of ids) {
  const articles: ReaderArticle[] = JSON.parse(
    fs.readFileSync(path.join(DIR, `${id}-articles.json`), 'utf-8'),
  );

  const chunksByArticle: Record<string, string[]> = {};
  const texts = new Map<string, string>();   // 해시 → 문장 (중복 문장은 한 번만 합성)

  for (const a of articles) {
    const hashes: string[] = [];
    for (const c of articleToChunks(a)) {
      const h = audioId(c.text);
      hashes.push(h);
      if (!texts.has(h)) texts.set(h, c.text);
    }
    chunksByArticle[String(a.n)] = hashes;
  }

  const totalChunks = Object.values(chunksByArticle).reduce((s, v) => s + v.length, 0);
  const chars = [...texts.values()].reduce((s, t) => s + t.length, 0);

  fs.writeFileSync(
    path.join(DIR, `${id}-audio.json`),
    JSON.stringify({ voice: VOICE, chunks: chunksByArticle }),
  );
  fs.writeFileSync(
    path.join(TMP, `${id}-manifest.json`),
    JSON.stringify([...texts].map(([h, text]) => ({ h, text })), null, 1),
  );

  console.log(
    `${id.padEnd(24)} 조문 ${String(articles.length).padStart(4)} · 조각 ${String(totalChunks).padStart(5)}` +
    ` (고유 ${String(texts.size).padStart(5)}) · ${(chars / 1000).toFixed(0)}K자` +
    ` · 예상 ${(chars * 1084 / 1024 / 1024).toFixed(0)}MB`,
  );
}
