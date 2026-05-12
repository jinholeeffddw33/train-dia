"""
51 다이아 행로표 이미지 생성 (p_ord_51.png).
기존 p_ord_52~54.png 의 시각 스타일을 모사한다.

다이아 51 데이터:
  s=08:48, e=17:20, m="답방마답,답하답", w=8:32
  g[0]: 09:18~12:36 trains=[5072, 5589, 5582]
  g[1]: 15:31~16:50 trains=[5111, 5144]
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from PIL import Image, ImageDraw, ImageFont

# 캔버스
W, H = 800, 584
BG = (255, 255, 255, 255)
INK = (60, 60, 60, 255)
GREY = (180, 180, 180, 255)
LIGHT = (220, 220, 220, 255)
RED = (220, 60, 60, 255)

# 폰트
F_REG = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 14)
F_SM = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 12)
F_HDR = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 13)
F_KM = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 15)
F_OV = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 13)

# 22개 컬럼 역명 (좌→우)
STATIONS = [
    "방화기지", "방화", "화곡", "까치산", "영등포구청", "여의도", "마포",
    "애오개", "광화문", "왕십리", "답십리", "군자", "강동", "둔촌동", "마천",
    "강동", "길동", "상일동", "고덕기지", "강일", "미사", "하남검단산",
]
N = len(STATIONS)
LEFT_PAD = 65       # 좌측 시각 라벨 영역
RIGHT_PAD = 65      # 우측 시각 라벨 영역
HDR_H = 110         # 헤더 영역 높이
USABLE_W = W - LEFT_PAD - RIGHT_PAD
COL_W = USABLE_W / (N - 1)  # 컬럼 간격

# 인덱스 매핑
IDX = {name: i for i, name in enumerate(STATIONS)}


def x_of(idx: int) -> int:
    return int(LEFT_PAD + COL_W * idx)


def draw_vertical_text(draw, x, y_top, y_bottom, text):
    """세로쓰기 한 글자씩 위→아래로 출력."""
    chars = list(text)
    if not chars:
        return
    step = (y_bottom - y_top) / max(len(chars), 1)
    for i, ch in enumerate(chars):
        bbox = draw.textbbox((0, 0), ch, font=F_HDR)
        cw = bbox[2] - bbox[0]
        draw.text((x - cw / 2, y_top + i * step), ch, font=F_HDR, fill=INK)


def draw_header(draw):
    # 상단 경계선
    draw.line([(LEFT_PAD - 5, HDR_H), (W - RIGHT_PAD + 5, HDR_H)], fill=GREY, width=1)
    # 각 역명 세로쓰기
    for i, name in enumerate(STATIONS):
        x = x_of(i)
        draw_vertical_text(draw, x, 8, HDR_H - 12, name)


def draw_grid(draw, y_top, y_bot):
    """수직 점선 그리드."""
    for i in range(N):
        x = x_of(i)
        # 점선 효과
        for yy in range(y_top, y_bot, 6):
            draw.line([(x, yy), (x, yy + 3)], fill=LIGHT, width=1)


def draw_oval_label(draw, cx, cy, text, w=40, h=18):
    """둥근 모서리 사각형(타원형) 라벨."""
    x0, y0 = cx - w / 2, cy - h / 2
    x1, y1 = cx + w / 2, cy + h / 2
    draw.rounded_rectangle([x0, y0, x1, y1], radius=h / 2,
                           outline=INK, width=1, fill=(245, 245, 245, 255))
    bbox = draw.textbbox((0, 0), text, font=F_OV)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - 1), text, font=F_OV, fill=INK)


def draw_time(draw, x, y, text, align="right"):
    bbox = draw.textbbox((0, 0), text, font=F_REG)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    if align == "right":
        draw.text((x - tw - 4, y - th / 2), text, font=F_REG, fill=INK)
    else:
        draw.text((x + 4, y - th / 2), text, font=F_REG, fill=INK)


def draw_segment(draw, y, x_left, x_right, time_left, time_right, ovals):
    """수평 한 줄 + 시각·열차번호 표시.
    ovals: list of (x, train_no)
    """
    draw.line([(x_left, y), (x_right, y)], fill=INK, width=2)
    draw_time(draw, x_left, y, time_left, "right")
    draw_time(draw, x_right, y, time_right, "left")
    for ox, train in ovals:
        draw_oval_label(draw, ox, y, str(train))


def main():
    img = Image.new("RGBA", (W, H), BG)
    draw = ImageDraw.Draw(img)

    draw_header(draw)

    # ── 1구간 (오전): 09:18 ~ 12:36, trains 5072, 5589, 5582 ──
    sec1_top = HDR_H + 20
    sec1_bot = HDR_H + 200
    draw_grid(draw, sec1_top, sec1_bot)
    # 좌·우 라벨
    draw.text((8, sec1_top - 8), "39.5km", font=F_KM, fill=RED)
    draw.text((W - RIGHT_PAD + 8, sec1_top - 8), "22", font=F_KM, fill=RED)

    # 답방마답 = 답십리(10) → 방화(1) → 답십리(10) → 마천(14) → 답십리(10)
    x_dap = x_of(IDX["답십리"])
    x_bang = x_of(IDX["방화"])
    x_machen = x_of(IDX["마천"])

    # Row A: 답십리 → 방화 (5072)
    yA = sec1_top + 28
    draw_segment(draw, yA, x_bang, x_dap, "09:48", "09:18",
                 [((x_bang + x_dap) / 2, 5072)])

    # Row B: 방화 → 답십리 (5589)
    yB = yA + 28
    draw_segment(draw, yB, x_bang, x_dap, "10:25", "10:55",
                 [((x_bang + x_dap) / 2, 5589)])

    # Row C: 답십리 → 마천 (5582 시작 부분)
    yC = yB + 28
    draw_segment(draw, yC, x_dap, x_machen, "11:30", "11:55",
                 [((x_dap + x_machen) / 2, 5582)])

    # Row D: 마천 → 답십리 (returning)
    yD = yC + 28
    draw_segment(draw, yD, x_dap, x_machen, "12:36", "12:05",
                 [((x_dap + x_machen) / 2, 5582)])

    # ── 2구간 (오후): 15:31 ~ 16:50, trains 5111, 5144 ──
    sec2_top = HDR_H + 230
    sec2_bot = HDR_H + 410
    draw_grid(draw, sec2_top, sec2_bot)
    draw.text((8, sec2_top - 8), "65km", font=F_KM, fill=RED)
    draw.text((W - RIGHT_PAD + 8, sec2_top - 8), "32", font=F_KM, fill=RED)

    # 답하답 = 답십리 → 하남검단산 → 답십리
    x_hanam = x_of(IDX["하남검단산"])

    yE = sec2_top + 28
    draw_segment(draw, yE, x_dap, x_hanam, "15:31", "16:42",
                 [((x_dap + x_hanam) / 2, 5111)])

    yF = yE + 28
    draw_segment(draw, yF, x_dap, x_hanam, "16:50", "15:50",
                 [((x_dap + x_hanam) / 2, 5144)])

    out_path = "public/images/route/p_ord_51.png"
    img.save(out_path, "PNG")
    print(f"OK saved: {out_path} ({img.size})")


if __name__ == "__main__":
    main()
