"""Prepare a browser-vs-Python parity check (run after export.py).

Copies N held-out test photos into deramandi/public/__parity/ (gitignored) with
the Keras model's probabilities for each (same TTA as the app), so the browser
can run src/lib/model.ts on the same files and we can compare grades.
"""
import json
import os
import random
import shutil

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tf_keras as keras  # noqa: E402
from PIL import Image  # noqa: E402

from data import OUT, RAW, parse_rel  # noqa: E402
from preprocess import to_square  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "..", "public", "__parity")
N = int(os.environ.get("N", "90"))

model = keras.models.load_model(os.path.join(OUT, "model.h5"))
splits = json.load(open(os.path.join(OUT, "splits.json")))
# Same photos the app's headline number is about (Dhakki once it is trained in).
card = json.load(open(os.path.join(HERE, "..", "src", "data", "modelCard.json")))
headline = card["headlineVarieties"]
test = [(os.path.join(RAW, r), *reversed(parse_rel(r))) for r in splits["test"] if parse_rel(r)[0] in headline]
rows = random.Random(11).sample(test, min(N, len(test)))

if os.path.isdir(DEST):
    shutil.rmtree(DEST)
os.makedirs(DEST)
out = []
for i, (f, g, v) in enumerate(rows):
    name = f"{i:03d}.jpg"
    shutil.copy(f, os.path.join(DEST, name))
    x = np.asarray(to_square(Image.open(f).convert("RGB"), 224), dtype=np.float32)[None]
    views = [x, x[:, :, ::-1], np.rot90(x, 2, axes=(1, 2))]
    p = np.mean([model.predict(np.ascontiguousarray(vw), verbose=0)[0] for vw in views], axis=0)
    out.append({"file": name, "label": int(g), "variety": v, "python": [float(a) for a in p]})
json.dump(out, open(os.path.join(DEST, "expected.json"), "w"))
acc = np.mean([np.argmax(r["python"]) == r["label"] for r in out])
print(f"wrote {len(out)} parity images; python accuracy on them {acc:.3f}")
