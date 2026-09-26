"""Dataset listing and the fixed, leakage-safe train/val/test split.

The dataset contains exact duplicate files and near-duplicate shots of the same
fruit. A naive random split put 12 test photos byte-identical to training
photos. So images are grouped by perceptual hash (dHash within 10 bits, joined
with union-find), a group is kept together in one split, and groups whose
copies carry different grade labels are dropped as label noise.
"""
import glob
import json
import os
import random

import numpy as np
from PIL import Image

SEED = 1337
GRADES = ["Grade-1", "Grade-2", "Grade-3"]
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
HASHES = os.path.join(HERE, "out", "dhash.json")
NEAR = 10  # bits out of 256


def collect(varieties):
    items = []
    for v in varieties:
        for gi, g in enumerate(GRADES):
            for f in sorted(glob.glob(os.path.join(RAW, v, "*", g, "*.jpg"))):
                items.append((f, gi, v))
    return items


def _dhash(path):
    from preprocess import to_square

    g = np.asarray(to_square(Image.open(path).convert("RGB"), 128).convert("L").resize((17, 16), Image.BILINEAR), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()


def _hashes(items):
    cache = json.load(open(HASHES)) if os.path.exists(HASHES) else {}
    changed = False
    out = {}
    for f, _, _ in items:
        key = os.path.relpath(f, RAW).replace("\\", "/")
        if key not in cache:
            cache[key] = "".join("1" if b else "0" for b in _dhash(f))
            changed = True
        out[f] = np.array([c == "1" for c in cache[key]])
    if changed:
        os.makedirs(os.path.dirname(HASHES), exist_ok=True)
        json.dump(cache, open(HASHES, "w"))
    return out


def groups(items):
    """Union-find over near-duplicate images. Returns list of index lists."""
    h = _hashes(items)
    arr = np.array([h[f] for f, _, _ in items])
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(items)):
        d = (arr[i + 1 :] != arr[i]).sum(1)
        for j in np.nonzero(d <= NEAR)[0]:
            a, b = find(i), find(i + 1 + j)
            if a != b:
                parent[b] = a
    by = {}
    for i in range(len(items)):
        by.setdefault(find(i), []).append(i)
    return list(by.values())


def split(items, report=False):
    """Stratified ~70/15/15 split of duplicate-groups per (variety, grade)."""
    gs = groups(items)
    dropped = 0
    buckets = {}
    for g in gs:
        labels = {items[i][1] for i in g}
        if len(labels) > 1:  # same fruit filed under two grades: label noise
            dropped += len(g)
            continue
        # one representative per exact/near duplicate group for val/test
        # (all copies stay in training if the group lands in train)
        key = (items[g[0]][2], items[g[0]][1])
        buckets.setdefault(key, []).append(g)
    train, val, test = [], [], []
    for key in sorted(buckets):
        bucket = buckets[key][:]
        random.Random(SEED).shuffle(bucket)
        n = sum(len(g) for g in bucket)
        target_test, target_val = n * 0.15, n * 0.15
        t = v = 0
        for g in bucket:
            if t < target_test:
                test.append(items[g[0]])
                t += len(g)
            elif v < target_val:
                val.append(items[g[0]])
                v += len(g)
            else:
                train += [items[i] for i in g]
    if report:
        sizes = [len(g) for g in gs]
        print(f"{len(items)} images, {len(gs)} groups, {sum(s > 1 for s in sizes)} groups with duplicates, {dropped} images dropped for conflicting labels")
    return train, val, test
