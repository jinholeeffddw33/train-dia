"""PDF -> JPG 변환 (개인별 임무카드 12장). 여백 자동 크롭."""
import fitz
from PIL import Image
import io
import os
import sys

PDF = r"C:\Users\smrt2\Downloads\1. 개인별 임무카드.pdf"
OUT_DIR = r"c:\Users\smrt2\Documents\GitHub\train-dia\public\notice\mission-cards"

# (PDF 페이지 1-based, 출력 파일명, 라벨)
PAGES = [
    (1,  "so-jang.jpg",                   "소장(안성숙)"),
    (2,  "bu-so-jang.jpg",                "부소장(이태원)"),
    (3,  "jido-bujang-lee-hyungoo.jpg",   "지도부장(이현구)"),
    (4,  "jido-bujang-lee-seongil.jpg",   "지도부장(이선길)"),
    (5,  "anjeon-gwanrija.jpg",           "안전관리자(신승헌)"),
    (6,  "jido-gigwansa.jpg",             "지도기관사(강병우)"),
    (7,  "samu-jikwon.jpg",               "사무직원(김민정)"),
    (8,  "unyong-bujang.jpg",             "운용부장"),
    (9,  "jiwon-gigwansa.jpg",            "지원기관사"),
    (10, "kiji-gwanjewon.jpg",            "기지관제원"),
    (11, "guni-gigwansa.jpg",             "구내기관사"),
    (12, "gigwansa.jpg",                  "기관사"),
]

DPI = 300
JPG_QUALITY = 92
WHITE_THRESHOLD = 248  # 이 값 이상 밝기는 여백으로 간주
PAD = 8  # 크롭 후 최소 안전 여백 px

def autocrop(img: Image.Image, threshold: int, pad: int) -> Image.Image:
    """RGB 이미지에서 흰 여백 자동 제거. threshold 이하 픽셀이 있는 최소 사각형으로 크롭."""
    gray = img.convert("L")
    # 임계값 적용: 임계 이하 픽셀(=내용)만 검은색으로
    bbox = gray.point(lambda p: 0 if p < threshold else 255).getbbox()
    # getbbox는 비검은(=비0) 영역의 박스를 돌려주므로 invert 트릭 사용
    inv = gray.point(lambda p: 255 if p < threshold else 0)
    bbox = inv.getbbox()
    if bbox is None:
        return img
    l, t, r, b = bbox
    W, H = img.size
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(W, r + pad)
    b = min(H, b + pad)
    return img.crop((l, t, r, b))

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF)
    print(f"PDF 페이지 수: {len(doc)}")
    for page_no, fname, label in PAGES:
        if page_no > len(doc):
            print(f"  ! 페이지 {page_no} 없음 — {label} 건너뜀")
            continue
        page = doc[page_no - 1]
        mat = fitz.Matrix(DPI / 72, DPI / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        cropped = autocrop(img, WHITE_THRESHOLD, PAD)
        out_path = os.path.join(OUT_DIR, fname)
        cropped.save(out_path, "JPEG", quality=JPG_QUALITY, optimize=True)
        sz_kb = os.path.getsize(out_path) // 1024
        print(f"  ok p{page_no:2d} -> {fname}  ({cropped.size[0]}x{cropped.size[1]}, {sz_kb} KB)  [{label}]")
    doc.close()

if __name__ == "__main__":
    main()
