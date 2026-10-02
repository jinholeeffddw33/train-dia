"""
규정 낭독 MP3 생성 — Microsoft Azure Neural TTS(edge-tts) → Supabase Storage.

왜 브라우저 음성이 아닌가
  기기 내장 한국어 음성은 딱딱하다. 안내방송(scripts/gen_broadcast_mp3.py)이 이미
  같은 목소리(ko-KR-SunHiNeural)로 훨씬 자연스럽게 들리는 이유가 여기 있다.
  규정도 같은 방식으로 미리 합성해 둔다.

왜 저장소가 아니라 Supabase Storage 인가
  운전취급규정 하나가 90K자 = 약 93MB 다. 안내방송 14MB 와 달리 git 에 넣으면
  배포가 무거워진다. 이미 쓰고 있는 Storage(hazard-photos 등)에 올리고 CDN 으로 받는다.

무엇을 합성하는가
  gen-regulation-audio-manifest.ts 가 뽑아 둔 문장 목록. 앱이 실제로 읽는 문장을
  articleToChunks() 로 그대로 만든 것이라 화면과 소리가 어긋나지 않는다.
  파일 이름은 문장 내용의 SHA-1 12자다 — 규정이 개정되면 바뀐 문장만 다시 합성된다.

이미 올라간 것은 건너뛴다. 중간에 끊겨도 다시 실행하면 이어서 한다.

사용:
  npx tsx scripts/gen-regulation-audio-manifest.ts      # 먼저 문장 목록
  python scripts/gen_regulation_mp3.py [--limit N] [--dry-run]
"""
import asyncio
import io
import json
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import edge_tts
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")

VOICE = "ko-KR-SunHiNeural"
RATE = "-5%"                       # 규정은 안내방송(-8%)보다 조금 빠르게 — 분량이 길다
BUCKET = "regulation-audio"
PREFIX = "sunhi"                   # 목소리를 바꾸면 폴더가 갈려 섞이지 않는다
TMP = ".tmp_regulation_audio"
CONCURRENCY = 6                    # MS 엔드포인트 rate limit 회피

DRY = "--dry-run" in sys.argv
LIMIT = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--limit=")), None)
REG = next((a.split("=")[1] for a in sys.argv if a.startswith("--reg=")), "operation-rules")

sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def ensure_bucket():
    names = [b.name for b in sb.storage.list_buckets()]
    if BUCKET in names:
        return
    if DRY:
        print(f"  (dry-run) 버킷 {BUCKET} 생성 예정")
        return
    # 공개 버킷 — 로그인 없이도 CDN 에서 바로 받아야 재생이 끊기지 않는다.
    # 규정 원문은 이미 앱에 공개돼 있어 음성만 감출 이유가 없다.
    sb.storage.create_bucket(BUCKET, options={"public": True})
    print(f"  버킷 {BUCKET} 생성(공개)")


def already_uploaded() -> set:
    """이미 올라간 파일 이름 — 페이지네이션으로 전부 훑는다(기본 100개 제한)."""
    have, offset = set(), 0
    while True:
        page = sb.storage.from_(BUCKET).list(PREFIX, {"limit": 1000, "offset": offset})
        if not page:
            break
        have.update(f["name"] for f in page)
        if len(page) < 1000:
            break
        offset += len(page)
    return have


async def main():
    manifest_path = os.path.join(TMP, f"{REG}-manifest.json")
    if not os.path.exists(manifest_path):
        print(f"문장 목록이 없다: {manifest_path}\n  먼저: npx tsx scripts/gen-regulation-audio-manifest.ts {REG}")
        return
    items = json.load(open(manifest_path, encoding="utf-8"))

    ensure_bucket()
    have = set() if DRY else already_uploaded()
    todo = [it for it in items if f"{it['h']}.mp3" not in have]
    if LIMIT:
        todo = todo[:LIMIT]

    chars = sum(len(it["text"]) for it in todo)
    print(f"{REG} · 문장 {len(items):,}개 중 {len(todo):,}개 합성 "
          f"({chars:,}자 · 예상 {chars * 1084 / 1024 / 1024:.0f}MB) · 음성 {VOICE} {RATE}")
    if DRY or not todo:
        print("  (dry-run)" if DRY else "  올릴 것이 없다 — 이미 전부 있다")
        return

    os.makedirs(os.path.join(TMP, "mp3"), exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    done = {"n": 0, "bytes": 0, "fail": 0}
    t0 = time.time()

    async def one(it):
        h, text = it["h"], it["text"]
        local = os.path.join(TMP, "mp3", f"{h}.mp3")
        async with sem:
            try:
                if not os.path.exists(local) or os.path.getsize(local) == 0:
                    await edge_tts.Communicate(text, VOICE, rate=RATE).save(local)
                data = open(local, "rb").read()
                if not data:
                    raise RuntimeError("빈 파일")
                # 업로드는 동기 API 라 스레드로 넘긴다(이벤트 루프를 막지 않게)
                await asyncio.to_thread(
                    sb.storage.from_(BUCKET).upload,
                    f"{PREFIX}/{h}.mp3", data,
                    {"content-type": "audio/mpeg", "cache-control": "31536000", "upsert": "true"},
                )
                done["n"] += 1
                done["bytes"] += len(data)
            except Exception as e:
                done["fail"] += 1
                print(f"  ✗ {h} {type(e).__name__}: {str(e)[:70]}  «{text[:24]}…»")
            n = done["n"] + done["fail"]
            if n % 50 == 0 or n == len(todo):
                el = time.time() - t0
                print(f"  {n:>5}/{len(todo)}  {done['bytes']/1024/1024:6.1f}MB  "
                      f"{el:5.0f}s  (남은 예상 {el / max(n, 1) * (len(todo) - n) / 60:.0f}분)")

    await asyncio.gather(*(one(it) for it in todo))

    print(f"\n완료 — 성공 {done['n']:,} · 실패 {done['fail']} · {done['bytes']/1024/1024:.1f}MB "
          f"· {time.time() - t0:.0f}초")
    if done["fail"]:
        print("  실패분은 다시 실행하면 이어서 처리된다.")


if __name__ == "__main__":
    asyncio.run(main())
