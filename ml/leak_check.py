"""Train/test leakage check: are test photos near-duplicates of training photos
(same fruit shot twice, or the same file saved twice)?

Uses a perceptual difference hash on the preprocessed square crop, and compares
each test photo's nearest TRAIN neighbour against typical test-to-test
distances. Also builds a contact sheet of consecutive files for a visual check.
"""
import os

import numpy as np
from PIL import Image

from data import CORE_VARIETIES, OUT, available_varieties, canonical, collect, split
from preprocess import to_square

HERE = os.path.dirname(os.path.abspath(__file__))


def dhash(img, size=16):
    g = np.asarray(img.convert("L").resize((size + 1, size), Image.BILINEAR), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


# Check the same varieties train.py will use.
extra = [canonical(v) for v in os.environ.get("EXTRA_VARIETIES", "Aseel").split(",") if v.strip()]
items = collect(CORE_VARIETIES + [v for v in extra if v not in CORE_VARIETIES])
train, val, test = split(items)
H = {f: dhash(to_square(Image.open(f).convert("RGB"), 128)) for f, _, _ in items}

tr = np.array([H[f] for f, _, _ in train])
te = np.array([H[f] for f, _, _ in test])
d_tt = (te[:, None, :] != tr[None, :, :]).sum(-1)  # test x train hamming
nearest = d_tt.min(1)
d_ee = (te[:, None, :] != te[None, :, :]).sum(-1)
np.fill_diagonal(d_ee, 999)
nearest_te = d_ee.min(1)

print("bits per hash:", te.shape[1])
print("test->nearest TRAIN distance: min %d, p5 %.0f, median %.0f" % (nearest.min(), np.percentile(nearest, 5), np.median(nearest)))
print("test->nearest TEST distance:  min %d, p5 %.0f, median %.0f" % (nearest_te.min(), np.percentile(nearest_te, 5), np.median(nearest_te)))
for thr in (0, 5, 10, 20):
    print(f"test photos with a train photo within {thr} bits: {(nearest <= thr).sum()} / {len(test)}")

# exact byte duplicates across the whole dataset
import hashlib

seen = {}
dups = 0
for f, _, _ in collect([canonical(v) for v in available_varieties()]):
    h = hashlib.md5(open(f, "rb").read()).hexdigest()
    if h in seen:
        dups += 1
    seen[h] = f
print("exact duplicate files in dataset:", dups)

# contact sheet of consecutive files 1..12 in two folders
rows = []
for variety in sorted({v for _, _, v in items})[:3]:
    files = sorted(f for f, _, v in items if v == variety)[:12]
    rows.append([Image.open(p).convert("RGB").resize((90, 150)) for p in files])
sheet = Image.new("RGB", (90 * 12, 150 * len(rows)), "white")
for r, ims in enumerate(rows):
    for c, im in enumerate(ims):
        sheet.paste(im, (c * 90, r * 150))
sheet.save(os.path.join(OUT, "consecutive_contact.jpg"), quality=85)
print("contact sheet written")
