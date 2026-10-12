"""Vytiahne fotku jedla pre každý recept: python3 images.py kucharka.src.json out_dir"""
import json, sys, os, subprocess, tempfile, re
from PIL import Image

def size_bytes(s):
    m = re.match(r'([\d\.]+)([KMG]?)B?', s)
    return float(m.group(1)) * {'': 1, 'K': 1e3, 'M': 1e6, 'G': 1e9}[m.group(2)] if m else 0

def best_photo(pdf, page):
    lst = subprocess.run(['pdfimages', '-list', '-f', str(page), '-l', str(page), pdf], capture_output=True, text=True).stdout.splitlines()[2:]
    rows = [l.split() for l in lst if l.strip()]
    best = None
    for i, r in enumerate(rows):
        if r[2] != 'image': continue
        w, h, sz = int(r[3]), int(r[4]), size_bytes(r[-2])
        if w * h < 300 * 200 or sz < 8000: continue
        mask = rows[i + 1][1] if i + 1 < len(rows) and rows[i + 1][2] == 'smask' else None
        if not best or w * h > best[1]: best = (r[1], w * h, mask)
    return best

def extract(pdf, page, num, mask, out):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(['pdfimages', '-png', '-f', str(page), '-l', str(page), pdf, d + '/x'], check=True)
        files = sorted(os.listdir(d))
        # pdfimages čísluje obrázky na strane od 0 v poradí výpisu -> nájdi podľa poradia
        lst = subprocess.run(['pdfimages', '-list', '-f', str(page), '-l', str(page), pdf], capture_output=True, text=True).stdout.splitlines()[2:]
        nums = [l.split()[1] for l in lst if l.strip()]
        img = Image.open(os.path.join(d, files[nums.index(num)])).convert('RGB')
        if mask is not None:
            a = Image.open(os.path.join(d, files[nums.index(mask)])).convert('L').resize(img.size)
            img.putalpha(a)
            bbox = a.point(lambda v: 255 if v > 16 else 0).getbbox()
            if bbox: img = img.crop(bbox)
        img.thumbnail((640, 640))
        img.save(out, 'WEBP', quality=70, method=6)

src = json.load(open(sys.argv[1]))
os.makedirs(sys.argv[2], exist_ok=True)
missing = []
for rid, pages in src.items():
    found = None
    for pdf, page in pages:
        b = best_photo(pdf, page)
        if b: found = (pdf, page, b); break
    if not found: missing.append(rid); continue
    pdf, page, (num, _, mask) = found
    extract(pdf, page, num, mask, os.path.join(sys.argv[2], f'{rid}.webp'))
print('chýba fotka:', len(missing), missing[:30])
