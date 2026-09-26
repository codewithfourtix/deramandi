"""Fast Python replica of the app's wheat handful pipeline, to screen a model before the browser check.

  python gate_wheat_handfuls.py <model dir with model.h5 + metrics.json> [handful dir]

Cuts kernels out the way src/lib/kernels.ts does, classifies them with 3-view
averaging, and reports raw and confusion-corrected sound shares and lot grades
against the truth. For v2 its errors were within 0.02 of the browser's. The
official gate is still parity_wheat_lots.browser.js in the app.
"""
import json, os, sys
os.environ["TF_USE_LEGACY_KERAS"] = "1"; os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import numpy as np, tf_keras as keras
from PIL import Image
from scipy import ndimage

OUT = sys.argv[1]  # e.g. C:/Professional/DERAMANDI/ml/out_v3/wheat
m = keras.models.load_model(os.path.join(OUT, 'model.h5'))
size = int(m.input_shape[1])
metrics = json.load(open(os.path.join(OUT, 'metrics.json')))
conf = np.array(metrics.get('app_confusion') or metrics['confusion'], float)
GROUP = np.array([0, 2, 1, 2, 1, 1, 2, 2])
D = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', '__parity_wheat_lots')
truth = json.load(open(os.path.join(D, 'truth.json')))

M = np.zeros((3, 3))
for i in range(8):
    for j in range(8):
        M[GROUP[i], GROUP[j]] += conf[i, j]
M /= M.sum(1, keepdims=True)


def proj(v):
    u = np.sort(v)[::-1]; css = np.cumsum(u); k = np.arange(1, len(v) + 1)
    t = (css - 1) / k; rho = np.where(u - t > 0)[0][-1]
    return np.maximum(v - t[rho], 0)


def adjust(q):
    p = q.copy()
    for _ in range(2000):
        r = M.T @ p - q
        p = proj(p - 0.5 * 2 * (M @ r))
    return p


def grade(s):
    return 'A' if s[0] >= .9 and s[2] <= .02 else 'B' if s[0] >= .75 and s[2] <= .08 else 'C'


def crops(im):
    a = np.asarray(im).astype(np.float32)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)]).mean(0)
    lab, n = ndimage.label(np.linalg.norm(a - border, axis=2) >= 44)
    out = []
    for sl in ndimage.find_objects(lab):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if h * w < 200: continue
        my, mx = int(h * .18), int(w * .18)
        c = a[max(0, sl[0].start - my):min(a.shape[0], sl[0].stop + my), max(0, sl[1].start - mx):min(a.shape[1], sl[1].stop + mx)]
        side = max(c.shape[:2]); sq = np.zeros((side, side, 3), np.float32) + border
        oy, ox = (side - c.shape[0]) // 2, (side - c.shape[1]) // 2
        sq[oy:oy + c.shape[0], ox:ox + c.shape[1]] = c
        out.append(np.asarray(Image.fromarray(sq.astype(np.uint8)).resize((size, size), Image.BILINEAR), np.float32))
    return np.stack(out)


T = float(metrics.get('temperature', 1.0))
rows = []
for t in truth:
    x = crops(Image.open(os.path.join(D, t['file'])).convert('RGB'))
    p = (m.predict(x, verbose=0) + m.predict(x[:, :, ::-1], verbose=0) + m.predict(np.rot90(x, 2, axes=(1, 2)), verbose=0)) / 3
    q = np.bincount(GROUP[p.argmax(1)], minlength=3) / len(p)
    a = adjust(q)
    rows.append((t['file'], round(t['groupShares'][0], 2), round(q[0], 2), round(a[0], 2), t['grade'], grade(q), grade(a)))
for r in rows: print(r)
print('raw right', sum(r[4] == r[5] for r in rows), 'adj right', sum(r[4] == r[6] for r in rows),
      'MAE raw', round(np.mean([abs(r[1] - r[2]) for r in rows]), 3), 'MAE adj', round(np.mean([abs(r[1] - r[3]) for r in rows]), 3))
