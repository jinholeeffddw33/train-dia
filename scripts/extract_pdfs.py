"""Extract text from the two handbook PDFs for merger analysis."""
import fitz
import os

PDFS = {
    "2025_handbook": r"D:\업로드용\신규기관사핸드북(2025.07.24).pdf",
    "2026_manual": r"D:\5. 신규직원\2026신규양성교육 현장실습 매뉴얼(답십리승무사업소) (1).pdf",
}

OUT_DIR = r"c:\Users\smrt2\Documents\GitHub\train-dia\.tmp_handbook_merge"
os.makedirs(OUT_DIR, exist_ok=True)

for name, path in PDFS.items():
    doc = fitz.open(path)
    print(f"\n=== {name}: {len(doc)} pages ===")
    out_path = os.path.join(OUT_DIR, f"{name}.txt")
    toc = doc.get_toc()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# {name}\n")
        f.write(f"# Pages: {len(doc)}\n")
        f.write(f"# Source: {path}\n\n")
        f.write("## TOC (PDF bookmarks)\n")
        if toc:
            for lvl, title, page in toc:
                f.write(f"{'  '*(lvl-1)}- p{page}: {title}\n")
        else:
            f.write("(no bookmarks)\n")
        f.write("\n## Full text\n")
        for i, page in enumerate(doc, 1):
            f.write(f"\n----- PAGE {i} -----\n")
            f.write(page.get_text())
    print(f"saved: {out_path}")
    doc.close()
