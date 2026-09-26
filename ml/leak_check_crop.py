"""Near-duplicate check for a crop model's split (same dHash as the khajoor pipeline).

  python leak_check_crop.py melon|sugarcane|wheat

For every validation and test photo, finds the closest training photo by dHash
(256 bits, after cropping to the object). A distance of 10 bits or less counts
as a near duplicate, the same threshold data.py uses to group khajoor photos.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

from preprocess import to_square

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
OUT_ROOT = os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out"))
NEAR = 10


def dhash(path):
    g = np.asarray(to_square(Image.open(path).convert("RGB"), 128).convert("L").resize((17, 16), Image.BILINEAR), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


def main(crop):
    splits = json.load(open(os.path.join(OUT_ROOT, crop, "splits.json")))
    hashes = {}
    for part in ("train", "val", "test"):
        for rel, _ in splits[part]:
            hashes[rel] = dhash(os.path.join(DATA, rel))
    train = np.array([hashes[r] for r, _ in splits["train"]])
    train_names = [r for r, _ in splits["train"]]
    report = {}
    for part in ("val", "test"):
        near = []
        for rel, _ in splits[part]:
            d = (train != hashes[rel]).sum(1)
            j = int(d.argmin())
            if d[j] <= NEAR:
                near.append((rel, train_names[j], int(d[j])))
        report[part] = near
        print(f"{crop} {part}: {len(near)} of {len(splits[part])} within {NEAR} bits of a training photo")
        for rel, tr, d in near[:8]:
            print(f"   {d:>2} bits  {rel}  ~  {tr}")
    json.dump(report, open(os.path.join(OUT_ROOT, crop, "leak_report.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
