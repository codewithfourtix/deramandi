"""Browser-vs-Python parity for a crop model (run after export_crop.py).

  python parity_crop.py sugarcane|melon|wheat

Copies N held-out test photos into public/__parity_<crop>/ (gitignored) with
the Keras model's probabilities (same 3-view TTA as the app). Then run
parity_crop.browser.js in the dev app's console to grade the same files
through the real upload path and compare.
"""
import json
import os
import random
import shutil
import sys

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tf_keras as keras  # noqa: E402
from PIL import Image  # noqa: E402

from preprocess import to_square  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
OUT_ROOT = os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out"))
N = int(os.environ.get("N", "60"))

crop = sys.argv[1]
out = os.path.join(OUT_ROOT, crop)
model = keras.models.load_model(os.path.join(out, "model.h5"))
size = int(model.input_shape[1])
test = json.load(open(os.path.join(out, "splits.json")))["test"]
rows = random.Random(11).sample(test, min(N, len(test)))
dest = os.path.join(HERE, "..", "public", f"__parity_{crop}")
if os.path.isdir(dest):
    shutil.rmtree(dest)
os.makedirs(dest)
res = []
for i, (rel, label) in enumerate(rows):
    src = os.path.join(DATA, rel)
    name = f"{i:03d}{os.path.splitext(src)[1].lower()}"
    shutil.copy(src, os.path.join(dest, name))
    im = Image.open(src).convert("RGB")
    im.thumbnail((900, 900))
    x = np.asarray(to_square(im, size), dtype=np.float32)[None]
    views = [x, x[:, :, ::-1], np.rot90(x, 2, axes=(1, 2))]
    p = np.mean([model.predict(np.ascontiguousarray(v), verbose=0)[0] for v in views], axis=0)
    res.append({"file": name, "label": int(label), "python": [float(a) for a in p]})
json.dump(res, open(os.path.join(dest, "expected.json"), "w"))
acc = np.mean([np.argmax(r["python"]) == r["label"] for r in res])
print(f"wrote {len(res)} parity images for {crop}; python accuracy on them {acc:.3f}")
