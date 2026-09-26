"""Colour range of the fruit the model was trained on (fruit pixels only).

export.py writes the result into the model card, and the app flags a photo as
"unfamiliar" when its fruit colour falls well outside this range (fresh doka
fruit, a different crop). Retraining with Dhakki therefore moves the guard to
Dhakki's real colours automatically.

Run directly for a report:  python colour_stats.py [Variety ...]
"""
import colorsys
import sys

import numpy as np
from PIL import Image

from data import collect
from preprocess import border_colour

# Margins beyond the 99.5th percentile before a photo counts as unfamiliar.
# With the shipped training set these give hue 38 and brightness 0.72, the
# values the app used before the guard was data-driven.
HUE_MARGIN = 12.0
VAL_MARGIN = 0.21


def per_photo_medians(items):
    rows = []
    for f, _, _ in items:
        a = np.asarray(Image.open(f).convert("RGB").resize((96, 96)), dtype=np.float32)
        bg = border_colour(a)
        mask = np.sqrt(((a - bg) ** 2).sum(-1)) >= 48
        px = a[mask] / 255.0
        if len(px) < 50:
            continue
        hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[:: max(1, len(px) // 800)]])
        h = hsv[:, 0] * 360
        h = np.where(h > 180, h - 360, h)  # khajoor sits near red, so use -180..180
        rows.append((np.median(h), np.median(hsv[:, 1]), np.median(hsv[:, 2])))
    return np.array(rows)


def colour_guard(items):
    """Thresholds for the app: a photo whose median fruit hue is above hueMax or
    whose median brightness is above valMax is flagged as unfamiliar."""
    r = per_photo_medians(items)
    hue995 = float(np.percentile(r[:, 0], 99.5))
    val995 = float(np.percentile(r[:, 2], 99.5))
    return {
        "hueMax": round(hue995 + HUE_MARGIN, 1),
        "valMax": round(val995 + VAL_MARGIN, 3),
        "photos": int(len(r)),
        "hueP995": round(hue995, 2),
        "valP995": round(val995, 3),
    }


if __name__ == "__main__":
    varieties = sys.argv[1:] or ["Gajar", "Kupro", "Aseel"]
    print(varieties, colour_guard(collect(varieties)))
