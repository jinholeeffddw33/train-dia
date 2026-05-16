"""
handbook.json의 안내방송 callout(따옴표 시작)을 추출 → Google TTS(gTTS) MP3 생성.

출력:
  - public/audio/announce/<hash>.mp3
  - public/data/edu/announce-manifest.json  (raw text → /audio/announce/...mp3 매핑)
"""
import hashlib, io, json, os, re, sys, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from gtts import gTTS

ROOT = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
HANDBOOK = os.path.join(ROOT, "public/data/edu/handbook.json")
AUDIO_DIR = os.path.join(ROOT, "public/audio/announce")
MANIFEST = os.path.join(ROOT, "public/data/edu/announce-manifest.json")

os.makedirs(AUDIO_DIR, exist_ok=True)


def is_announcement(text: str) -> bool:
    t = text.strip()
    return any(t.startswith(c) for c in ['"', "'", "“", "「"])


def clean_for_speech(text: str) -> str:
    t = text.strip()
    t = re.sub(r'^["\'“「]+|["\'”」]+$', "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def hash_id(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def walk_announcements(data):
    for ch in data.get("chapters", []):
        if ch.get("id") not in ("ch8", "ch9", "ch10"):
            continue
        for sec in ch.get("sections", []):
            content = sec.get("content", "")
            if isinstance(content, list):
                for item in content:
                    if not isinstance(item, dict):
                        continue
                    if item.get("type") == "callout" and isinstance(item.get("text"), str):
                        if is_announcement(item["text"]):
                            yield item["text"]


def main():
    with open(HANDBOOK, encoding="utf-8") as f:
        data = json.load(f)

    texts = list(dict.fromkeys(walk_announcements(data)))
    print(f"총 안내방송 callout: {len(texts)}")

    manifest = {}  # raw text → url

    generated = 0
    skipped = 0
    failed = 0

    for raw in texts:
        speech = clean_for_speech(raw)
        if not speech:
            continue
        h = hash_id(raw)
        mp3_path = os.path.join(AUDIO_DIR, f"{h}.mp3")
        public_url = f"/audio/announce/{h}.mp3"

        if os.path.exists(mp3_path):
            manifest[raw] = public_url
            skipped += 1
            continue

        try:
            tts = gTTS(text=speech, lang="ko", slow=False)
            tts.save(mp3_path)
            manifest[raw] = public_url
            generated += 1
            print(f"  ✓ {h} ({speech[:30]}...)")
            time.sleep(0.4)
        except Exception as e:
            failed += 1
            print(f"  ✗ {h} 실패: {e}")

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"\n신규 생성: {generated} / 기존 재사용: {skipped} / 실패: {failed}")
    print(f"매니페스트 항목: {len(manifest)}")


if __name__ == "__main__":
    main()
