"""Export a crop model from train_crop.py into the app.

  python export_crop.py wheat|sugarcane|melon

Writes public/models/<crop>/model.json + float16 shards and
src/data/models/<crop>.json (the model card the app shows). Every number in the
card comes from metrics.json; nothing is typed in by hand.
"""
import json
import math
import os
import sys

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import tf_keras as keras  # noqa: E402

from export import write_tfjs  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.environ.get("DERAMANDI_APP", os.path.join(HERE, ".."))
OUT_ROOT = os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out"))

CITATIONS = {
    "wheat": {
        "citation": "Fan, L. et al., GrainSet: a large-scale grain image dataset (wheat), Figshare 22992317, v2",
        "licence": "CC BY 4.0",
        "cropFor": "wheat",
    },
    "sugarcane": {
        "citation": "The77Lab (LSU AgCenter), SugarcaneDeepLearning billet images, github.com/The77Lab/SugarcaneDeepLearning",
        "licence": "No licence published (used for a non-commercial prototype with attribution)",
        "cropFor": "sugarcane",
    },
    "melon": {
        "citation": "AFruitDB: A Dataset of Common Asian Fruits for Quality Grading and Biodiversity Research, Mendeley Data bz65dz2pbj, v1",
        "licence": "CC BY 4.0",
        "cropFor": "kulachi_melon",
    },
}


def main(crop):
    out = os.path.join(OUT_ROOT, crop)
    model = keras.models.load_model(os.path.join(out, "model.h5"))
    size = write_tfjs(model, os.path.join(APP, "public", "models", crop))
    m = json.load(open(os.path.join(out, "metrics.json")))
    card = {
        "crop": CITATIONS[crop]["cropFor"],
        "task": m["task"],
        "labels": m["labels"],
        "inputSize": int(model.input_shape[1]),
        "trainImages": m["counts"]["train"],
        "valImages": m["counts"]["val"],
        "testImages": m["counts"]["test"],
        "testAccuracy": round(m["test_accuracy"], 4),
        "testAccuracyWilson95": [round(x, 4) for x in m["test_accuracy_wilson95"]],
        "majorityBaseline": round(m["majority_baseline"], 4),
        "temperature": m["temperature"],
        "perClass": {k: {"precision": round(v["precision"], 3), "recall": round(v["recall"], 3), "n": int(v["support"])} for k, v in m["report"].items() if k in m["labels"]},
        "confusion": m["confusion"],
        "backbone": m["backbone"],
        "dataset": m["dataset"],
        "citation": CITATIONS[crop]["citation"],
        "licence": CITATIONS[crop]["licence"],
        "weightsMB": round(size / 1e6, 2),
    }
    if "kernel_group_accuracy" in m:
        card["kernelGroupAccuracy"] = round(m["kernel_group_accuracy"], 4)
        card["kernelGroupWilson95"] = [round(x, 4) for x in m["kernel_group_wilson95"]]
        card["kernelGroupMap"] = m["kernel_group_map"]
    if "billet_accuracy" in m:  # all photos of one billet averaged, as the app does
        card["groupAccuracy"] = round(m["billet_accuracy"], 4)
        card["groupWilson95"] = [round(x, 4) for x in m["billet_wilson95"]]
        card["groupCount"] = m["billet_count"]
    os.makedirs(os.path.join(APP, "src", "data", "models"), exist_ok=True)
    with open(os.path.join(APP, "src", "data", "models", f"{crop}.json"), "w", newline="\n") as fh:
        json.dump(card, fh, indent=2)
        fh.write("\n")
    print(json.dumps({k: card[k] for k in ("testAccuracy", "testAccuracyWilson95", "majorityBaseline", "weightsMB")}))
    assert math.isfinite(card["testAccuracy"])


if __name__ == "__main__":
    main(sys.argv[1])
