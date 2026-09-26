"""Split GrainSet wheat images into single-kernel views.

Each GrainSet image shows one kernel twice, side by side (front and back) on a
black background. A phone photo of grain on a cloth shows each kernel once, so
the model is trained and tested on single views: the cut is made at the
darkest column near the middle.

  python split_wheat_views.py            # data/wheat/wheat -> data/wheat_views
"""
import glob
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
SRC = os.path.join(DATA, "wheat", "wheat")
DST = os.path.join(DATA, "wheat_views")


def cut(im):
    a = np.asarray(im.convert("L"), dtype=np.float32)
    w = a.shape[1]
    lo, hi = int(w * 0.3), int(w * 0.7)
    cols = a[:, lo:hi].mean(0)
    # smooth, then take the darkest column: the black gap between the two views
    cols = np.convolve(cols, np.ones(5) / 5, mode="same")
    x = lo + int(cols.argmin())
    return im.crop((0, 0, x, im.height)), im.crop((x, 0, w, im.height))


def main():
    n = 0
    for split in ("train", "test"):
        for f in sorted(glob.glob(os.path.join(SRC, split, "*", "*"))):
            if not f.lower().endswith((".png", ".jpg", ".jpeg", ".bmp")):
                continue
            cls = os.path.basename(os.path.dirname(f))
            out = os.path.join(DST, split, cls)
            os.makedirs(out, exist_ok=True)
            stem = os.path.splitext(os.path.basename(f))[0]
            if os.path.exists(os.path.join(out, f"{stem}_b.png")):
                continue
            im = Image.open(f).convert("RGB")
            for side, part in zip("ab", cut(im)):
                part.save(os.path.join(out, f"{stem}_{side}.png"))
            n += 1
    print(f"split {n} images into {DST}")


if __name__ == "__main__":
    main()
