"""Shared preprocessing. The browser (src/lib/model.ts) mirrors this exactly:
find the fruit against the border colour, crop to it with a margin, pad to a
square with the border colour, resize.
"""
import numpy as np
from PIL import Image


def border_colour(a: np.ndarray, ring: int = 4) -> np.ndarray:
    top, bottom = a[:ring].reshape(-1, 3), a[-ring:].reshape(-1, 3)
    left, right = a[:, :ring].reshape(-1, 3), a[:, -ring:].reshape(-1, 3)
    return np.concatenate([top, bottom, left, right]).mean(0)


def to_square(img: Image.Image, size: int, margin: float = 0.06, threshold: float = 48.0) -> Image.Image:
    a = np.asarray(img, dtype=np.float32)
    bg = border_colour(a)
    mask = np.sqrt(((a - bg) ** 2).sum(-1)) >= threshold
    h, w = mask.shape
    if mask.mean() > 0.02:
        ys, xs = np.where(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        my, mx = int((y1 - y0) * margin), int((x1 - x0) * margin)
        y0, y1 = max(0, y0 - my), min(h, y1 + my)
        x0, x1 = max(0, x0 - mx), min(w, x1 + mx)
        img = img.crop((x0, y0, x1, y1))
    cw, ch = img.size
    side = max(cw, ch)
    canvas = Image.new("RGB", (side, side), tuple(int(c) for c in bg))
    canvas.paste(img, ((side - cw) // 2, (side - ch) // 2))
    return canvas.resize((size, size), Image.BILINEAR)
