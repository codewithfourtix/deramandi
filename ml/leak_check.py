"""Train/test leakage check: are test photos near-duplicates of training photos
(same fruit shot twice, or the same file saved twice)?

Uses a perceptual difference hash on the preprocessed square crop, and compares
each test photo's nearest TRAIN neighbour against typical test-to-test
distances. Also builds a contact sheet of consecutive files for a visual check.
"""
import os

import numpy as np
from PIL import Image

from data import collect, split
from preprocess import to_square

HERE = os.path.dirname(os.path.abspath(__file__))


def dhash(img, size=16):
    g = np.asarray(img.convert("L").resize((size + 1, size), Image.BILINEAR), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


items = collect(["Gajar", "Kupro"])
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
for f, _, _ in collect(["Gajar", "Kupro", "Aseel", "Fasli Toto"]):
    h = hashlib.md5(open(f, "rb").read()).hexdigest()
    if h in seen:
        dups += 1
    seen[h] = f
print("exact duplicate files in dataset:", dups)

# contact sheet of consecutive files 1..12 in two folders
rows = []
for folder in ("Gajar/Large/Grade-1", "Kupro/Large/Grade-2"):
    ims = []
    for i in range(1, 13):
        p = os.path.join(HERE, "data", "raw", folder, f"{i}.jpg")
        if os.path.exists(p):
            ims.append(Image.open(p).convert("RGB").resize((90, 150)))
    rows.append(ims)
sheet = Image.new("RGB", (90 * 12, 150 * len(rows)), "white")
for r, ims in enumerate(rows):
    for c, im in enumerate(ims):
        sheet.paste(im, (c * 90, r * 150))
sheet.save(os.path.join(HERE, "data", "consecutive_contact.jpg"), quality=85)
print("contact sheet written")
