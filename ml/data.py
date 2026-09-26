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
# Both folders can live outside the repo (the dataset is not committed).
RAW = os.environ.get("DERAMANDI_RAW", os.path.join(HERE, "data", "raw"))
OUT = os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out"))
HASHES = os.path.join(OUT, "dhash.json")
NEAR = 10  # bits out of 256

# The two Mendeley varieties that have all three grades.
CORE_VARIETIES = ["Gajar", "Kupro"]
# Khajoor from D.I. Khan itself, collected by the team (see COLLECTING.md).
# When present in the test split, its accuracy becomes the headline number.
LOCAL_VARIETIES = ["Dhakki"]
IMAGE_EXT = (".jpg", ".jpeg", ".png")


def _folder(name):
    """Find a variety folder regardless of letter case, so dhakki/ and Dhakki/
    both work on Linux as well as Windows. Returns the real folder name or None."""
    if not os.path.isdir(RAW):
        return None
    for entry in os.listdir(RAW):
        if entry.lower() == name.lower() and os.path.isdir(os.path.join(RAW, entry)):
            return entry
    return None


def available_varieties():
    return sorted(e for e in os.listdir(RAW) if os.path.isdir(os.path.join(RAW, e))) if os.path.isdir(RAW) else []


def collect(varieties):
    """(path, grade index, canonical variety name) for every photo.

    Layout: RAW/<Variety>/<Size>/<Grade-N>/*.jpg (Mendeley), or the shorter
    RAW/<Variety>/<Grade-N>/*.jpg for photos collected without size sorting.
    """
    items = []
    for v in varieties:
        folder = _folder(v)
        if folder is None:
            continue
        for gi, g in enumerate(GRADES):
            files = set()
            for pattern in (os.path.join(RAW, folder, "*", g, "*"), os.path.join(RAW, folder, g, "*")):
                files.update(f for f in glob.glob(pattern) if f.lower().endswith(IMAGE_EXT))
            for f in sorted(files):
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


def canonical(name):
    """Canonical spelling for a variety name typed in any case."""
    known = {v.lower(): v for v in CORE_VARIETIES + LOCAL_VARIETIES + ["Aseel", "Fasli Toto"]}
    return known.get(name.strip().lower(), name.strip())


def parse_rel(rel):
    """'Gajar/Large/Grade-2/1.jpg' or 'Dhakki/Grade-2/1.jpg' -> ('Gajar', 1).
    The variety comes back in the canonical spelling used by the scripts."""
    parts = rel.replace("\\", "/").split("/")
    grade = next(GRADES.index(p) for p in parts if p in GRADES)
    return canonical(parts[0]), grade
