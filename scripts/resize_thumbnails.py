"""영상 가이드 썸네일 리사이즈 — 다운로드 폴더 → public/data/edu/thumbnails/"""
from PIL import Image
from pathlib import Path

SRC = Path(r'C:\Users\smrt2\Downloads')
DST = Path(r'c:\Users\smrt2\Documents\GitHub\train-dia\public\data\edu\thumbnails')

# (파일 hash 부분, 영상 id)
MAPPING = [
    ('h598sh598sh598sh', 'office-tour'),
    ('p7k32np7k32np7k3', 'crew-office-day'),
    ('ihh4jaihh4jaihh4', 'attendance-roll-call'),
    ('ouo93nouo93nouo9', 'shift-handover-checklist'),
    ('zens6zens6zens6z', 'depot-in-out-guide'),
    ('zbglegzbglegzbgl', 'depot-out-inspection'),
    ('dkt838dkt838dkt8', 'manual-driving-tips'),
    ('7tzxd17tzxd17tzx', 'overnight-parking-guide'),
    ('drs7svdrs7svdrs7', 'newcomer-vacation-guide'),
    ('jafm8ajafm8ajafm', 'promotion-guide'),
]

TARGET_W = 480  # 16:9 → 480x270 (retina용 충분, 실 표시 84x48)
QUALITY = 82

DST.mkdir(parents=True, exist_ok=True)

for hash_part, vid_id in MAPPING:
    src_file = SRC / f'Gemini_Generated_Image_{hash_part}.png'
    if not src_file.exists():
        print(f'MISSING: {src_file.name}')
        continue
    img = Image.open(src_file)
    # convert palette / RGBA → RGB
    if img.mode in ('RGBA', 'P', 'LA'):
        img = img.convert('RGB')
    # resize keeping aspect
    w, h = img.size
    new_h = int(TARGET_W * h / w)
    img = img.resize((TARGET_W, new_h), Image.LANCZOS)
    out = DST / f'{vid_id}.jpg'
    img.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    size_kb = out.stat().st_size / 1024
    print(f'OK {vid_id}.jpg  ({TARGET_W}x{new_h}, {size_kb:.0f}KB)')

print('Done.')
