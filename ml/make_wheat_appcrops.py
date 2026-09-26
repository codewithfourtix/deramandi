"""Make wheat training crops that look like the app's kernel crops.

  python make_wheat_appcrops.py          # data/wheat_views/{train} -> data/wheat_appcrops/train

The app finds each kernel on the grower's cloth and cuts it out with a margin,
padded with the cloth colour (src/lib/kernels.ts). GrainSet kernels sit on a
scanner's black background instead, and a model trained only on those drops
sharply when the background changes. So every training view is also pasted on
a random cloth (colour, weave, noise), at a random phone-like size, JPEG
compressed, and cut out with the same rule as the app: distance from the
border colour >= 44, largest object, 18% margin, padded square.

Only the training split is used; test kernels stay untouched.
"""
import glob
import io
import os
import random

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

from make_wheat_handfuls import cutout

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
SRC = os.path.join(DATA, "wheat_views", "train")
DST = os.path.join(DATA, "wheat_appcrops", "train")
THRESHOLD, MARGIN, OUT = 44, 0.18, 184
rng = random.Random(21)
nrng = np.random.default_rng(21)


def cloth(w, h):
    # dark to mid cloths in any colour, the way the tip asks ("plain dark cloth")
    hue = rng.random()
    sat = rng.uniform(0.05, 0.6)
    val = rng.uniform(0.03, 0.36)
    rgb = np.array(Image.new("HSV", (1, 1), (int(hue * 255), int(sat * 255), int(val * 255))).convert("RGB").getpixel((0, 0)), np.float32)
    img = np.zeros((h, w, 3), np.float32) + rgb
    if rng.random() < 0.5:  # weave
        yy, xx = np.mgrid[0:h, 0:w]
        period = rng.uniform(2.5, 6)
        img += (np.sin(xx * 2 * np.pi / period) * np.sin(yy * 2 * np.pi / period))[..., None] * rng.uniform(2, 8)
    img += nrng.normal(0, rng.uniform(2, 9), (h, w, 1))
    # uneven light across the cloth
    grad = np.linspace(-1, 1, w)[None, :, None] * rng.uniform(0, 12)
    return Image.fromarray(np.clip(img + grad, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.2)))


def app_crop(img, expected):
    """Same rule as src/lib/kernels.ts findObjects + cropBox."""
    a = np.asarray(img, np.float32)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)]).mean(0)
    lab, n = ndimage.label(np.linalg.norm(a - border, axis=2) >= THRESHOLD)
    if n == 0:
        return None
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    sl = ndimage.find_objects(lab)[int(np.argmax(sizes))]
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    # the cloth was too close to the kernel's colour and the object ran into the edge: the app
    # would also fail here, but such a crop is not a clean example of its label, so skip it
    if sl[0].start == 0 or sl[1].start == 0 or sl[0].stop >= a.shape[0] or sl[1].stop >= a.shape[1]:
        return None
    if max(sizes) < 0.6 * expected:
        return None
    my, mx = h * MARGIN, w * MARGIN
    x0, y0 = max(0, sl[1].start - mx), max(0, sl[0].start - my)
    x1, y1 = min(img.width, sl[1].stop + mx), min(img.height, sl[0].stop + my)
    c = img.crop((int(x0), int(y0), int(x1), int(y1)))
    side = max(c.size)
    sq = Image.new("RGB", (side, side), tuple(int(v) for v in border))
    sq.paste(c, ((side - c.width) // 2, (side - c.height) // 2))
    return sq.resize((OUT, OUT), Image.BILINEAR)


def main():
    n = 0
    for f in sorted(glob.glob(os.path.join(SRC, "*", "*.png"))):
        cls = os.path.basename(os.path.dirname(f))
        out_dir = os.path.join(DST, cls)
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, os.path.basename(f).replace(".png", "_c.png"))
        if os.path.exists(out):
            continue
        got = cutout(f, rng.randint(45, 150))
        if not got:
            continue
        k, alpha = got
        if rng.random() < 0.5:  # kernels lie at any angle on a cloth
            angle = rng.uniform(-35, 35)
            k, alpha = k.rotate(angle, expand=True, resample=Image.BICUBIC), alpha.rotate(angle, expand=True, resample=Image.BICUBIC)
        pad = int(max(k.size) * rng.uniform(0.6, 1.2))
        bg = cloth(k.width + 2 * pad, k.height + 2 * pad)
        bg.paste(k, (pad, pad), alpha)
        buf = io.BytesIO()
        bg.save(buf, "JPEG", quality=rng.randint(70, 92))
        crop = app_crop(Image.open(buf).convert("RGB"), float(np.asarray(alpha).astype(bool).sum()))
        if crop is None:
            continue
        crop.save(out)
        n += 1
    print(f"made {n} app-style crops in {DST}")


if __name__ == "__main__":
    main()
