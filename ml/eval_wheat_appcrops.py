"""Score the wheat model on held-out kernels in the app's own crop style.

  python eval_wheat_appcrops.py     # after train_crop.py wheat and SPLIT=test make_wheat_appcrops.py

Adds app_* fields to DERAMANDI_OUT/wheat/metrics.json: accuracy, 95% range,
quality-group accuracy, per-class report and confusion matrix. export_crop.py
then headlines these (they match what the app actually sees) and gives the
confusion matrix to the app's lot-share correction. The scanner-view numbers
are kept as scanner_*.
"""
import glob
import json
import os

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tf_keras as keras  # noqa: E402
from PIL import Image  # noqa: E402
from sklearn.metrics import classification_report, confusion_matrix  # noqa: E402

from train_crop import WHEAT_CLASSES, predict_tta, wilson  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
OUT = os.path.join(os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out")), "wheat")
GROUP = np.array([0, 2, 1, 2, 1, 1, 2, 2])


def main():
    model = keras.models.load_model(os.path.join(OUT, "model.h5"))
    size = int(model.input_shape[1])
    items = [(f, ci) for ci, c in enumerate(WHEAT_CLASSES) for f in sorted(glob.glob(os.path.join(DATA, "wheat_appcrops", "test", c, "*.png")))]
    x = np.stack([np.asarray(Image.open(f).convert("RGB").resize((size, size), Image.BILINEAR), np.uint8) for f, _ in items])
    y = np.array([c for _, c in items])
    pred = predict_tta(model, x).argmax(1)
    m = json.load(open(os.path.join(OUT, "metrics.json")))
    labels = m["labels"]
    acc = float((pred == y).mean())
    g_acc = float((GROUP[pred] == GROUP[y]).mean())
    for k in ("test_accuracy", "test_accuracy_wilson95", "majority_baseline", "confusion", "report", "kernel_group_accuracy", "kernel_group_wilson95"):
        if k in m and f"scanner_{k}" not in m:
            m[f"scanner_{k}"] = m[k]
    m.update(
        {
            "app_count": len(y),
            "app_accuracy": acc,
            "app_wilson95": wilson(acc, len(y)),
            "app_majority_baseline": float(np.bincount(y, minlength=8).max() / len(y)),
            "app_group_accuracy": g_acc,
            "app_group_wilson95": wilson(g_acc, len(y)),
            "app_confusion": confusion_matrix(y, pred, labels=list(range(8))).tolist(),
            "app_report": classification_report(y, pred, labels=list(range(8)), target_names=labels, output_dict=True, zero_division=0),
        }
    )
    json.dump(m, open(os.path.join(OUT, "metrics.json"), "w"), indent=1)
    print(json.dumps({"app_accuracy": acc, "app_wilson95": m["app_wilson95"], "app_group_accuracy": g_acc, "n": len(y)}))
    print(classification_report(y, pred, labels=list(range(8)), target_names=labels, zero_division=0))


if __name__ == "__main__":
    main()
