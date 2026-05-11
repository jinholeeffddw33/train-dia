import fitz
import json
import re
from pathlib import Path

REG_DIR = Path("public/data/edu/regulations")

TARGETS = [
    "operation-rules",
    "crew-management-rules",
    "operating-staff-rules",
    "safety-record-rules",
    "depot-operation-rules",
]


def normalize(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_one(slug: str) -> None:
    pdf_path = REG_DIR / f"{slug}.pdf"
    out_path = REG_DIR / f"{slug}-search.json"
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc, start=1):
        raw = page.get_text("text") or ""
        text = normalize(raw)
        if not text:
            continue
        pages.append({"page": i, "text": text})
    out_path.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    total = sum(len(p["text"]) for p in pages)
    print(f"OK {slug}: {len(pages)} pages, {total:,} chars")


def main() -> None:
    for slug in TARGETS:
        extract_one(slug)


if __name__ == "__main__":
    main()
