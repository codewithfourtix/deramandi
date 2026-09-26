"""Export the trained model to TensorFlow.js, write the model card the app
shows, and copy a few held-out test photos to use as in-app samples.

Writes into the app (the folder above ml/):
  public/model/model.json + weight shards (float16-quantised layers model)
  src/data/modelCard.json   (every number and flag the app shows about the model)
  public/samples/khajoor-g{1,2,3}-{1,2}.jpg

Nothing about the training set is hard-coded here: the headline accuracy, the
"trained on Dhakki?" flag and the colour guard all come from metrics.json and
splits.json, so a retrain with Dhakki photos updates the app's claims too.
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

from colour_stats import colour_guard  # noqa: E402
from data import CORE_VARIETIES, LOCAL_VARIETIES, OUT, RAW, collect, parse_rel  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.environ.get("DERAMANDI_APP", os.path.join(HERE, ".."))  # override for dry runs
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
    card = build_card(m, splits)
    with open(os.path.join(APP, "src", "data", "modelCard.json"), "w", newline="\n") as fh:
        json.dump(card, fh, indent=2)
        fh.write("\n")
    print("model card:", json.dumps(card, indent=1))
    write_samples(splits, card["headlineVarieties"])


def wilson(acc, n, z=1.96):
    centre = (acc + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(acc * (1 - acc) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return [round(centre - half, 4), round(centre + half, 4)]


def group_stats(test_rels, varieties, per_variety):
    """Accuracy, n, interval and majority baseline for one group of varieties."""
    rows = [parse_rel(r) for r in test_rels]
    chosen = [g for v, g in rows if v in varieties]
    n = len(chosen)
    if n == 0:
        return None
    key = varieties[0] if len(varieties) == 1 else "+".join(varieties)
    acc = per_variety[key]
    counts = [chosen.count(i) for i in range(3)]
    return {"varieties": varieties, "n": n, "accuracy": round(acc, 4), "wilson95": wilson(acc, n), "majorityBaseline": round(max(counts) / n, 4)}


def build_card(m, splits):
    tta = m["test"]["tta"]
    per_variety = m["test_per_variety_tta"]
    train_varieties = m["train_varieties"]
    local = [v for v in LOCAL_VARIETIES if v in train_varieties]
    core = group_stats(splits["test"], CORE_VARIETIES, per_variety)
    local_stats = group_stats(splits["test"], local, per_variety) if local else None
    # Headline: the local variety when it is in the test split, else the
    # three-grade Mendeley varieties (Aseel is Grade 1 only and would flatter).
    head = local_stats or core
    guard_varieties = train_varieties
    guard = colour_guard(collect(guard_varieties))
    return {
        "includesDhakki": bool(local_stats),
        "headlineVarieties": head["varieties"],
        "trainImages": m["counts"]["train"],
        "valImages": m["counts"]["val"],
        "testImages": head["n"],
        "testAccuracy": head["accuracy"],
        "testAccuracyWilson95": head["wilson95"],
        "majorityBaseline": head["majorityBaseline"],
        "coreVarieties": core,
        "localVarieties": local_stats,
        "overallTestAccuracy": round(tta["accuracy"], 4),
        "overallTestImages": m["counts"]["test"],
        "temperature": m["temperature"],
        "colourGuard": {**guard, "varieties": guard_varieties},
        "perGradeAllTest": {k: {"precision": round(tta["report"][k]["precision"], 3), "recall": round(tta["report"][k]["recall"], 3)} for k in ("A", "B", "C")},
        "confusionAllTest": tta["confusion"],
        "unseenVariety": ", ".join(m.get("unseen_varieties", [])),
        "unseenVarietiesPredictedShare": {k: round(v, 4) for k, v in m["unseen_varieties_grade1_predicted_share"].items()},
        "testPerVariety": {k: round(v, 4) for k, v in per_variety.items()},
        "trainVarieties": train_varieties,
        "backbone": m["backbone"],
        "dataset": m["dataset"] + (" plus graded Dhakki photos collected in D.I. Khan by the team" if local_stats else ""),
    }


def write_samples(splits, varieties):
    """Random held-out TEST photos (never trained on), 2 per grade, from the
    headline varieties, so the in-app samples show what the headline measures."""
    rng = random.Random(7)
    os.makedirs(SAMPLES, exist_ok=True)
    test = [r for r in splits["test"] if parse_rel(r)[0] in varieties]
    for gi in range(3):
        pool = sorted(r for r in test if parse_rel(r)[1] == gi)
        if len(pool) < 2:
            print(f"only {len(pool)} held-out Grade-{gi + 1} photos; keeping the existing samples for that grade")
            continue
        for k, rel in enumerate(rng.sample(pool, 2), start=1):
            im = Image.open(os.path.join(RAW, rel)).convert("RGB")
            im.thumbnail((480, 480))
            dest = os.path.join(SAMPLES, f"khajoor-g{gi + 1}-{k}.jpg")
            im.save(dest, quality=85)
            print("sample", dest, "<-", rel)


if __name__ == "__main__":
    main()
