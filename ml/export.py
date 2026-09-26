"""Export the trained model to TensorFlow.js, write the model card the app
shows, and copy a few held-out test photos to use as in-app samples.

Writes into ../deramandi:
  public/model/model.json + weight shards (float16-quantised layers model)
  src/data/modelCard.json
  public/samples/khajoor-g{1,2,3}-{1,2}.jpg
"""
import json
import math
import os
import random
import shutil

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tf_keras as keras  # noqa: E402
from PIL import Image  # noqa: E402

from data import RAW  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
APP = os.path.join(HERE, "..")
MODEL_DIR = os.path.join(APP, "public", "model")
SAMPLES = os.path.join(APP, "public", "samples")


TRAINING_ONLY = ("kernel_regularizer", "bias_regularizer", "activity_regularizer", "depthwise_regularizer", "pointwise_regularizer", "beta_regularizer", "gamma_regularizer")


def sanitize(node):
    """Drop training-only config that TF.js cannot deserialize (regularizers)."""
    if isinstance(node, dict):
        return {k: (None if k in TRAINING_ONLY else sanitize(v)) for k, v in node.items()}
    if isinstance(node, list):
        return [sanitize(v) for v in node]
    return node


def write_tfjs(model, out_dir, shard_bytes=4 * 1024 * 1024):
    """Write a TF.js layers model with float16 weights (the documented
    model.json + binary shard format), without needing the tensorflowjs pip
    package and its heavy dependency tree."""
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    topology = sanitize(json.loads(model.to_json()))
    weights = []
    blob = bytearray()
    for w in model.weights:
        arr = w.numpy().astype(np.float32)
        name = w.name.split(":")[0]
        weights.append(
            {"name": name, "shape": list(arr.shape), "dtype": "float32", "quantization": {"dtype": "float16", "original_dtype": "float32"}}
        )
        blob += arr.astype(np.float16).tobytes()
    paths = []
    for i in range(0, len(blob), shard_bytes):
        paths.append(f"group1-shard{i // shard_bytes + 1}of{(len(blob) + shard_bytes - 1) // shard_bytes}.bin")
        with open(os.path.join(out_dir, paths[-1]), "wb") as fh:
            fh.write(blob[i : i + shard_bytes])
    manifest = {
        "format": "layers-model",
        "generatedBy": f"keras v{keras.__version__}",
        "convertedBy": "Dera Mandi ml/export.py",
        "modelTopology": topology,
        "weightsManifest": [{"paths": paths, "weights": weights}],
    }
    with open(os.path.join(out_dir, "model.json"), "w") as fh:
        json.dump(manifest, fh)
    return len(blob)


def main():
    model = keras.models.load_model(os.path.join(OUT, "model.h5"))
    size = write_tfjs(model, MODEL_DIR)
    print(f"model weights: {size / 1e6:.2f} MB (float16)")

    m = json.load(open(os.path.join(OUT, "metrics.json")))
    splits = json.load(open(os.path.join(OUT, "splits.json")))
    tta = m["test"]["tta"]
    # Headline = the three-grade varieties only (Gajar + Kupro). Aseel is in
    # training but only has Grade 1, which would flatter an overall number.
    core_test = [p for p in splits["test"] if p.split("/")[0] in ("Gajar", "Kupro")]
    n = len(core_test)
    acc = m["test_per_variety_tta"]["Gajar+Kupro"]
    z = 1.96
    centre = (acc + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(acc * (1 - acc) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    grade_counts = [sum(1 for p in core_test if p.split("/")[2] == g) for g in ("Grade-1", "Grade-2", "Grade-3")]
    card = {
        "trainImages": m["counts"]["train"],
        "valImages": m["counts"]["val"],
        "testImages": n,
        "testAccuracy": round(acc, 4),
        "testAccuracyWilson95": [round(centre - half, 4), round(centre + half, 4)],
        "majorityBaseline": round(max(grade_counts) / n, 4),
        "overallTestAccuracyInclAseel": round(tta["accuracy"], 4),
        "overallTestImagesInclAseel": m["counts"]["test"],
        "temperature": m["temperature"],
        "perGradeAllTest": {k: {"precision": round(tta["report"][k]["precision"], 3), "recall": round(tta["report"][k]["recall"], 3)} for k in ("A", "B", "C")},
        "confusionAllTest": tta["confusion"],
        "unseenVariety": ", ".join(m.get("unseen_varieties", [])),
        "unseenVarietiesPredictedShare": {k: round(v, 4) for k, v in m["unseen_varieties_grade1_predicted_share"].items()},
        "testPerVariety": {k: round(v, 4) for k, v in m["test_per_variety_tta"].items()},
        "trainVarieties": m["train_varieties"],
        "backbone": m["backbone"],
        "dataset": m["dataset"],
    }
    with open(os.path.join(APP, "src", "data", "modelCard.json"), "w", newline="\n") as fh:
        json.dump(card, fh, indent=2)
        fh.write("\n")
    print("model card:", json.dumps(card, indent=1))

    # samples: random held-out TEST photos (never trained on), 2 per grade,
    # three-grade varieties only
    rng = random.Random(7)
    os.makedirs(SAMPLES, exist_ok=True)
    raw = os.path.join(HERE, os.path.relpath(RAW, HERE))
    for gi, g in enumerate(("Grade-1", "Grade-2", "Grade-3")):
        pool = sorted(p for p in core_test if p.split("/")[2] == g)
        for k, rel in enumerate(rng.sample(pool, 2), start=1):
            im = Image.open(os.path.join(raw, rel)).convert("RGB")
            im.thumbnail((480, 480))
            dest = os.path.join(SAMPLES, f"khajoor-g{gi + 1}-{k}.jpg")
            im.save(dest, quality=85)
            print("sample", dest, "<-", rel)


if __name__ == "__main__":
    main()
