"""
평일행로표 xlsx에서 51다이아 영역을 PNG로 추출.
Excel COM(win32com)로 셀 범위를 클립보드 → 이미지로 변환.

대상: 시트 '41-51', 다이아 51 영역 (col 39~75, row 35~65 근방)
출력: public/images/route/p_ord_51.png
"""
import os, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import win32com.client
from PIL import ImageGrab

PROJECT_ROOT = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
XLSX_PATH = os.path.join(PROJECT_ROOT, ".wr_temp.xlsx")
OUT_PATH = os.path.join(PROJECT_ROOT, "public/images/route/p_ord_51.png")

SHEET_NAME = "41-51"
# 다이아 51 영역 (수기로 확인): col 39 ~ col 75, row 35 ~ row 65
COL_START, COL_END = 39, 75
ROW_START, ROW_END = 35, 65


def col_letter(n):
    """1=A, 26=Z, 27=AA …"""
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def main():
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    wb = excel.Workbooks.Open(XLSX_PATH)
    try:
        ws = wb.Worksheets(SHEET_NAME)
        rng_addr = f"{col_letter(COL_START)}{ROW_START}:{col_letter(COL_END)}{ROW_END}"
        print("range:", rng_addr)
        rng = ws.Range(rng_addr)

        # CopyPicture: xlScreen=1, xlPicture=-4147 (bitmap)
        rng.CopyPicture(Appearance=1, Format=2)  # 2 = xlBitmap
        time.sleep(0.5)

        img = ImageGrab.grabclipboard()
        if img is None:
            raise RuntimeError("clipboard is empty after CopyPicture")
        img.save(OUT_PATH, "PNG")
        print(f"OK saved: {OUT_PATH} ({img.size})")
    finally:
        wb.Close(SaveChanges=False)
        excel.Quit()


if __name__ == "__main__":
    main()
