"""
ch11 표준 안내방송 — Microsoft Azure Neural TTS(edge-tts)로 MP3 일괄 생성.

각 broadcast 블록의 text (단일 또는 versions[].text)에 대해:
  - SHA-1 12자 → audioId
  - public/audio/broadcasts/{audioId}.mp3 저장
  - handbook.json 의 해당 블록에 audioId 필드 추가

음성: ko-KR-SunHiNeural (여성, 안내방송 톤)
속도: -8% (또렷·신뢰감)

이미 같은 audioId의 MP3가 있으면 스킵 (변경된 텍스트만 재생성).
"""
import asyncio, hashlib, json, os, sys, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import edge_tts

HANDBOOK = "public/data/edu/handbook.json"
OUT_DIR = "public/audio/broadcasts"
VOICE = "ko-KR-SunHiNeural"
RATE = "-8%"  # 약간 천천히

os.makedirs(OUT_DIR, exist_ok=True)


def audio_id(text: str) -> str:
    """텍스트 정규화 → SHA-1 12자."""
    norm = " ".join(text.split())  # 공백 정규화
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()[:12]


async def synth(text: str, out_path: str):
    comm = edge_tts.Communicate(text, VOICE, rate=RATE)
    await comm.save(out_path)


async def main():
    data = json.load(open(HANDBOOK, encoding="utf-8"))
    ch11 = next((c for c in data["chapters"] if c["id"] == "ch11"), None)
    if not ch11:
        sys.stdout.write("ch11 없음\n")
        return

    QUOTE_CHARS = ('"', "'", "“", "「")  # 따옴표 시작 = 안내방송

    tasks = []  # (text, out_path, block_ref, key)
    for ch in data["chapters"]:
        for sec in ch.get("sections", []):
            for block in sec.get("content", []):
                btype = block.get("type")
                if btype == "broadcast":
                    if "versions" in block:
                        for v in block["versions"]:
                            aid = audio_id(v["text"])
                            v["audioId"] = aid
                            out = f"{OUT_DIR}/{aid}.mp3"
                            if not os.path.exists(out):
                                tasks.append((v["text"], out, aid))
                    elif "text" in block:
                        aid = audio_id(block["text"])
                        block["audioId"] = aid
                        out = f"{OUT_DIR}/{aid}.mp3"
                        if not os.path.exists(out):
                            tasks.append((block["text"], out, aid))
                elif btype == "callout" and isinstance(block.get("text"), str):
                    txt = block["text"].strip()
                    if txt.startswith(QUOTE_CHARS):
                        # 따옴표 제거하고 합성
                        clean = txt.lstrip('"\'“”「」').rstrip('"\'“”「」')
                        aid = audio_id(clean)
                        block["audioId"] = aid
                        out = f"{OUT_DIR}/{aid}.mp3"
                        if not os.path.exists(out):
                            tasks.append((clean, out, aid))
                elif btype == "list":
                    for item in block.get("items", []):
                        desc = item.get("desc", "")
                        if isinstance(desc, str) and desc.strip().startswith(QUOTE_CHARS):
                            clean = desc.strip().lstrip('"\'“”「」').rstrip('"\'“”「」')
                            aid = audio_id(clean)
                            item["audioId"] = aid
                            out = f"{OUT_DIR}/{aid}.mp3"
                            if not os.path.exists(out):
                                tasks.append((clean, out, aid))

    sys.stdout.write(f"생성 대상: {len(tasks)}건 / 음성: {VOICE} / 속도: {RATE}\n")

    # 동시 호출 제한 (API rate limit 우회)
    sem = asyncio.Semaphore(4)

    async def bounded(text, out, aid):
        async with sem:
            t0 = time.time()
            try:
                await synth(text, out)
                size = os.path.getsize(out)
                dt = time.time() - t0
                sys.stdout.write(f"  ✓ {aid}  {size//1024:>4}KB  {dt:4.1f}s  {text[:30]}...\n")
            except Exception as e:
                sys.stdout.write(f"  ✗ {aid}  실패: {e}\n")

    if tasks:
        await asyncio.gather(*(bounded(t, o, a) for t, o, a in tasks))

    # handbook.json 저장 (audioId 필드 추가됨)
    with open(HANDBOOK, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    sys.stdout.write(f"\n완료 — handbook.json 갱신 (audioId 필드 삽입)\n")
    sys.stdout.write(f"전체 MP3: {len([f for f in os.listdir(OUT_DIR) if f.endswith('.mp3')])}개\n")
    total = sum(os.path.getsize(f"{OUT_DIR}/{f}") for f in os.listdir(OUT_DIR) if f.endswith(".mp3"))
    sys.stdout.write(f"전체 용량: {total/1024/1024:.1f} MB\n")


if __name__ == "__main__":
    asyncio.run(main())
