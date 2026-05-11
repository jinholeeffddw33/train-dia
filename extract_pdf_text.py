import fitz
import json
import re
from pathlib import Path

PDF_PATH = Path("public/data/edu/regulations/operation-rules.pdf")
OUT_PATH = Path("public/data/edu/regulations/operation-rules-search.json")


def normalize(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main() -> None:
    doc = fitz.open(PDF_PATH)
    pages = []
    for i, page in enumerate(doc, start=1):
        raw = page.get_text("text") or ""
        text = normalize(raw)
        if not text:
            continue
        pages.append({"page": i, "text": text})
    OUT_PATH.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    total_chars = sum(len(p["text"]) for p in pages)
    print(f"OK {len(pages)} pages, {total_chars:,} chars -> {OUT_PATH}")


if __name__ == "__main__":
    main()
