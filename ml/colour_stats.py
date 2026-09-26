"""Colour range of khajoor in the dataset (fruit pixels only), per image.
Used by the app to warn when a "khajoor" photo is plainly something else."""
import colorsys
import json
import os

import numpy as np
from PIL import Image

from data import collect
from preprocess import border_colour

rows = []
for f, g, v in collect(["Gajar", "Kupro", "Aseel", "Fasli Toto"]):
    a = np.asarray(Image.open(f).convert("RGB").resize((96, 96)), dtype=np.float32)
    bg = border_colour(a)
    mask = np.sqrt(((a - bg) ** 2).sum(-1)) >= 48
    px = a[mask] / 255.0
    if len(px) < 50:
        continue
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[:: max(1, len(px) // 800)]])
    h = hsv[:, 0] * 360
    # hue is circular; khajoor sits around red-brown, so shift to -180..180
    h = np.where(h > 180, h - 360, h)
    rows.append((np.median(h), np.median(hsv[:, 1]), np.median(hsv[:, 2])))

r = np.array(rows)
stats = {name: {"p0.5": float(np.percentile(r[:, i], 0.5)), "p1": float(np.percentile(r[:, i], 1)), "p50": float(np.percentile(r[:, i], 50)), "p99": float(np.percentile(r[:, i], 99)), "p99.5": float(np.percentile(r[:, i], 99.5))} for i, name in enumerate(["hue", "sat", "val"])}
print(len(rows), "images")
print(json.dumps(stats, indent=1))
json.dump(stats, open(os.path.join(os.path.dirname(__file__), "out", "colour_stats.json"), "w"), indent=1)
