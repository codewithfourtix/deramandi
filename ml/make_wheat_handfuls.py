"""Build synthetic "handful on a cloth" photos from held-out wheat kernels.

  python make_wheat_handfuls.py         # -> public/__parity_wheat_lots/ (gitignored)

Each photo places 25 to 40 single-kernel test views (never seen in training)
on a dark cloth texture at phone-like size, not touching, with a known mix of
kernel classes. The browser check (parity_wheat_lots.browser.js) runs the
app's full pipeline on them: find kernels, classify each, grade the lot, and
compares with the truth. This tests the pipeline, not real phone photos.
"""
import json
import os
import random

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
OUT_ROOT = os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out"))
DEST = os.path.join(HERE, "..", "public", "__parity_wheat_lots")
GROUP = [0, 2, 1, 2, 1, 1, 2, 2]
W, H = 1600, 1200
rng = random.Random(7)


def lot_grade(shares):
    sound, _, serious = shares
    if sound >= 0.9 and serious <= 0.02:
        return "A"
    if sound >= 0.75 and serious <= 0.08:
        return "B"
    return "C"


def cloth():
    base = np.array([38, 34, 31], dtype=np.float32)
    noise = np.random.default_rng(rng.randint(0, 9999)).normal(0, 6, (H, W, 1)).astype(np.float32)
    img = np.clip(base + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(img).filter(ImageFilter.GaussianBlur(1.2))


def cutout(path, height):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    lum = a.mean(2)
    mask = lum > 38
    # keep the largest blob (the kernel), drop bits of neighbours at the edges
    from scipy import ndimage

    lab, n = ndimage.label(mask)
    if n == 0:
        return None
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = lab == (int(np.argmax(sizes)) + 1)
    keep = ndimage.binary_fill_holes(keep)
    ys, xs = np.where(keep)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    alpha = Image.fromarray((keep * 255).astype(np.uint8)).crop(box).filter(ImageFilter.GaussianBlur(0.8))
    k = im.crop(box)
    s = height / k.height
    size = (max(8, int(k.width * s)), max(8, int(height)))
    return k.resize(size, Image.LANCZOS), alpha.resize(size, Image.LANCZOS)


def main():
    splits = json.load(open(os.path.join(OUT_ROOT, "wheat", "splits.json")))
    by_class = {}
    for rel, y in splits["test"]:
        by_class.setdefault(y, []).append(os.path.join(DATA, rel))
    os.makedirs(DEST, exist_ok=True)
    # mixes: share of sound kernels, rest spread over defects
    mixes = [0.96, 0.95, 0.93, 0.85, 0.82, 0.8, 0.7, 0.6, 0.5, 0.4, 0.97, 0.78]
    truth = []
    for i, sound in enumerate(mixes):
        n = rng.randint(25, 40)
        n_sound = round(n * sound)
        labels = [0] * n_sound + [rng.randint(1, 7) for _ in range(n - n_sound)]
        rng.shuffle(labels)
        canvas = cloth()
        placed = []
        kept = []
        for y in labels:
            got = cutout(rng.choice(by_class[y]), rng.randint(60, 95))
            if not got:
                continue
            k, alpha = got
            for _ in range(200):  # find a free spot: kernels must not touch
                x0 = rng.randint(60, W - k.width - 60)
                y0 = rng.randint(60, H - k.height - 60)
                box = (x0 - 14, y0 - 14, x0 + k.width + 14, y0 + k.height + 14)
                if all(box[2] < b[0] or box[0] > b[2] or box[3] < b[1] or box[1] > b[3] for b in placed):
                    placed.append(box)
                    canvas.paste(k, (x0, y0), alpha)
                    kept.append(y)
                    break
        name = f"lot{i:02d}.jpg"
        canvas.save(os.path.join(DEST, name), quality=88)
        groups = [sum(GROUP[y] == g for y in kept) / len(kept) for g in range(3)]
        truth.append({"file": name, "kernels": len(kept), "classes": kept, "groupShares": groups, "grade": lot_grade(groups)})
    json.dump(truth, open(os.path.join(DEST, "truth.json"), "w"))
    print(f"wrote {len(truth)} handfuls; grades {[t['grade'] for t in truth]}")


if __name__ == "__main__":
    main()
