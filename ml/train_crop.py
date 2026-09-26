"""Train the grade models for crops other than khajoor.

  python train_crop.py wheat       # GrainSet wheat kernels, 8 kernel classes
  python train_crop.py sugarcane   # SugarcaneDeepLearning billets, good / damaged
  python train_crop.py melon       # AFruitDB graded fruit (6 fruits), stand-in for melon

Same recipe as the khajoor model (train.py): MobileNetV2 transfer learning,
frozen-backbone stage then fine-tuning, strong augmentation, temperature
calibration on validation, and ONE evaluation on an untouched test split.
Smaller backbone (alpha 0.5, 160 px) so all four models stay light on phones.

Data folders (not committed) are read from DERAMANDI_DATA (default ../../data):
  wheat_views/{train,test}/<class>/*_{a,b}.png  (GrainSet's own split, cut into single views by split_wheat_views.py)
  sugarcane/<variety>/{good,damaged}/*.png      (split by billet, so no billet is in two splits)
  afruit/Fruits Grade/Fruit grade/<fruit>/<1st|2nd|3rd grade>/*   (Banana left out: 2 third-grade photos)

Outputs: DERAMANDI_OUT/<crop>/model.h5, metrics.json, splits.json
"""
import glob
import json
import os
import random
import re
import sys
import time

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
import tf_keras as keras  # noqa: E402
from PIL import Image  # noqa: E402
from sklearn.metrics import classification_report, confusion_matrix  # noqa: E402

from preprocess import to_square  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DERAMANDI_DATA", os.path.join(HERE, "..", "..", "data"))
OUT_ROOT = os.environ.get("DERAMANDI_OUT", os.path.join(HERE, "out"))
SEED = 1337
IMG = int(os.environ.get("IMG", "160"))
STORE = int(IMG * 1.15)
ALPHA = float(os.environ.get("ALPHA", "0.5"))
LOWRES = os.environ.get("LOWRES", "0") == "1"
APPCROPS = os.environ.get("APPCROPS", "0") == "1"
UNFREEZE = float(os.environ.get("UNFREEZE", "0.45"))  # top share of backbone layers fine-tuned
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".bmp")

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)


# ---- per-crop data ------------------------------------------------------------
WHEAT_CLASSES = ["0_NOR", "1_F&S", "2_SD", "3_MY", "4_AP", "5_BN", "6_BP", "7_IM"]


def wheat():
    # single-kernel views made by split_wheat_views.py; both views of one kernel stay in the same split
    root = os.path.join(DATA, "wheat_views")
    def items(split):
        out = []
        for ci, c in enumerate(WHEAT_CLASSES):
            out += [(f, ci) for f in sorted(glob.glob(os.path.join(root, split, c, "*"))) if f.lower().endswith(IMAGE_EXT)]
        return out
    train_all, test = items("train"), items("test")
    # plus app-style crops of the same training kernels (make_wheat_appcrops.py): same kernel key, same split
    if APPCROPS:
        aroot = os.path.join(DATA, "wheat_appcrops", "train")
        for ci, c in enumerate(WHEAT_CLASSES):
            train_all += [(f, ci) for f in sorted(glob.glob(os.path.join(aroot, c, "*.png")))]
    # validation from the training split, stratified by class
    rng = random.Random(SEED)
    train, val = [], []
    for ci in range(len(WHEAT_CLASSES)):
        kernels = {}
        for it in train_all:
            if it[1] == ci:
                kernels.setdefault(re.sub(r"_[ab](_c)?\.png$", "", os.path.basename(it[0])), []).append(it)
        keys = sorted(kernels)
        rng.shuffle(keys)
        k = round(len(keys) * 0.15)
        val += [it for key in keys[:k] for it in kernels[key]]
        train += [it for key in keys[k:] for it in kernels[key]]
    labels = ["normal", "fusarium_shrivelled", "sprouted", "mouldy", "pest_attacked", "broken", "black_point", "impurity"]
    info = {
        "task": "wheat_kernel_class",
        "labels": labels,
        "dataset": "GrainSet wheat (Fan et al., Figshare 22992317, CC BY 4.0): balanced subset of GrainSet's own train/test split, each image cut into its two single-kernel views, plus the same training kernels pasted on varied cloths and cut out the way the app does",
    }
    return train, val, test, info


def sugarcane():
    root = os.path.join(DATA, "sugarcane")
    labels = ["good", "damaged"]
    groups = {}
    for li, lab in enumerate(labels):
        for f in glob.glob(os.path.join(root, "*", lab, "*")):
            if not f.lower().endswith(IMAGE_EXT):
                continue
            variety = os.path.basename(os.path.dirname(os.path.dirname(f)))
            # files are <session>-<billet>-<view>.png, e.g. 6-bc001-3.png: group all views of one billet
            m = re.match(r"(\d+-b[a-z]?\d+)", os.path.basename(f).lower())
            billet = m.group(1) if m else os.path.basename(f)
            groups.setdefault((variety, lab, billet), []).append((f, li))
    rng = random.Random(SEED)
    train, val, test = [], [], []
    by_label = {}
    for key, items in groups.items():
        by_label.setdefault((key[0], key[1]), []).append(items)
    for key in sorted(by_label):
        gs = by_label[key][:]
        rng.shuffle(gs)
        n = sum(len(g) for g in gs)
        t = v = 0
        for g in gs:  # whole billets go to one split
            if t < n * 0.15:
                test += g
                t += len(g)
            elif v < n * 0.15:
                val += g
                v += len(g)
            else:
                train += g
    info = {
        "task": "binary_good_damaged",
        "labels": labels,
        "dataset": "SugarcaneDeepLearning billet images (The77Lab, LSU AgCenter, github.com/The77Lab/SugarcaneDeepLearning). No licence file is published: used for a non-commercial prototype with attribution; license or replace before commercial use.",
    }
    return train, val, test, info


def melon():
    root = os.path.join(DATA, "afruit", "Fruits Grade", "Fruit grade")
    grades = ["1st grade", "2nd grade", "3rd grade"]
    rng = random.Random(SEED)
    train, val, test = [], [], []
    for fruit in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        if fruit.lower().startswith("banana"):
            continue  # only 2 third-grade photos; would teach "banana = good"
        for gi, g in enumerate(grades):
            files = sorted(f for f in glob.glob(os.path.join(root, fruit, g, "*")) if f.lower().endswith(IMAGE_EXT))
            rng.shuffle(files)
            k = round(len(files) * 0.15)
            test += [(f, gi) for f in files[:k]]
            val += [(f, gi) for f in files[k : 2 * k]]
            train += [(f, gi) for f in files[2 * k :]]
    info = {
        "task": "grade3_proxy",
        "labels": ["A", "B", "C"],
        "dataset": "AFruitDB: A Dataset of Common Asian Fruits for Quality Grading (Mendeley Data bz65dz2pbj, CC BY 4.0): apple, Burmese grape, mango, papaya, tomato graded 1st/2nd/3rd. No melon photos exist in any public graded dataset, so this is a stand-in.",
    }
    return train, val, test, info


CROPS = {"wheat": wheat, "sugarcane": sugarcane, "melon": melon}


# ---- training ---------------------------------------------------------------
def load(items):
    x = np.zeros((len(items), STORE, STORE, 3), dtype=np.uint8)
    for i, (f, _) in enumerate(items):
        im = Image.open(f).convert("RGB")
        im.thumbnail((900, 900))
        x[i] = np.asarray(to_square(im, STORE))
    return x, np.array([it[1] for it in items], dtype=np.int32)


def augment(img, label):
    img = tf.image.convert_image_dtype(img, tf.float32)
    img = tf.image.rot90(img, k=tf.random.uniform([], 0, 4, dtype=tf.int32))
    img = tf.image.random_flip_left_right(img)
    scale = tf.random.uniform([], 0.8, 1.0)
    crop = tf.cast(scale * STORE, tf.int32)
    img = tf.image.random_crop(img, [crop, crop, 3])
    img = tf.image.resize(img, [IMG, IMG])
    if LOWRES:  # a kernel in a phone photo is often only 40 to 100 pixels across
        side = tf.random.uniform([], 40, IMG, dtype=tf.int32)
        small = tf.image.resize(img, [side, side])
        img = tf.cond(tf.random.uniform([]) < 0.6, lambda: tf.image.resize(small, [IMG, IMG]), lambda: img)
    img = tf.image.random_brightness(img, 0.25)
    img = tf.image.random_contrast(img, 0.75, 1.25)
    img = tf.image.random_saturation(img, 0.75, 1.25)
    img = tf.image.random_hue(img, 0.03)
    return tf.clip_by_value(img, 0.0, 1.0) * 255.0, label


def center(img, label):
    return tf.image.resize(tf.cast(img, tf.float32), [IMG, IMG]), label


def dataset(x, y, train):
    ds = tf.data.Dataset.from_tensor_slices((x, y))
    ds = ds.shuffle(len(x), seed=SEED).map(augment, num_parallel_calls=tf.data.AUTOTUNE) if train else ds.map(center, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(32).prefetch(tf.data.AUTOTUNE)


def build(n):
    inp = keras.Input((IMG, IMG, 3), name="image")
    x = keras.layers.Rescaling(1.0 / 127.5, offset=-1.0, name="to_unit")(inp)
    base = keras.applications.MobileNetV2(input_shape=(IMG, IMG, 3), include_top=False, weights="imagenet", alpha=ALPHA)
    base.trainable = False
    x = base(x, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="pool")(x)
    x = keras.layers.Dropout(0.3, name="drop")(x)
    out = keras.layers.Dense(n, activation="softmax", name="grade", kernel_regularizer=keras.regularizers.l2(1e-4))(x)
    return keras.Model(inp, out), base


def predict_tta(model, x):
    xs = tf.image.resize(tf.cast(x, tf.float32), [IMG, IMG]).numpy()
    p = model.predict(xs, batch_size=64, verbose=0)
    p = p + model.predict(xs[:, :, ::-1], batch_size=64, verbose=0)
    p = p + model.predict(np.rot90(xs, 2, axes=(1, 2)), batch_size=64, verbose=0)
    return p / 3.0


def wilson(acc, n, z=1.96):
    c = (acc + z * z / (2 * n)) / (1 + z * z / n)
    h = z * np.sqrt(acc * (1 - acc) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return [float(c - h), float(c + h)]


def main(crop):
    t0 = time.time()
    train, val, test, info = CROPS[crop]()
    labels = info["labels"]
    out = os.path.join(OUT_ROOT, crop)
    os.makedirs(out, exist_ok=True)
    rel = lambda items: [(os.path.relpath(f, DATA).replace("\\", "/"), int(y)) for f, y in items]  # noqa: E731
    json.dump({"train": rel(train), "val": rel(val), "test": rel(test)}, open(os.path.join(out, "splits.json"), "w"))
    print(f"[{crop}] train {len(train)}  val {len(val)}  test {len(test)}", flush=True)
    xtr, ytr = load(train)
    xva, yva = load(val)
    xte, yte = load(test)
    print(f"loaded in {time.time() - t0:.0f}s", flush=True)

    counts = np.bincount(ytr, minlength=len(labels))
    cw = {i: float(len(ytr) / (len(labels) * max(c, 1))) for i, c in enumerate(counts)}
    model, base = build(len(labels))
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(dataset(xtr, ytr, True), validation_data=dataset(xva, yva, False), epochs=int(os.environ.get("STAGE1_EPOCHS", "8")), class_weight=cw, verbose=2)
    base.trainable = True
    for layer in base.layers[: int(len(base.layers) * (1 - UNFREEZE))]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, keras.layers.BatchNormalization):
            layer.trainable = False
    model.compile(optimizer=keras.optimizers.Adam(3e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(
        dataset(xtr, ytr, True),
        validation_data=dataset(xva, yva, False),
        epochs=int(os.environ.get("FT_EPOCHS", "25")),
        class_weight=cw,
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=3e-6),
        ],
        verbose=2,
    )

    # calibration on validation only
    logp = np.log(np.clip(predict_tta(model, xva), 1e-7, 1))
    def nll(T):
        z = logp / T
        z = z - z.max(1, keepdims=True)
        q = np.exp(z) / np.exp(z).sum(1, keepdims=True)
        return float(-np.log(q[np.arange(len(yva)), yva] + 1e-12).mean())
    temps = np.linspace(0.5, 3.0, 51)
    temperature = float(temps[np.argmin([nll(T) for T in temps])])

    # one honest test evaluation
    p = predict_tta(model, xte)
    pred = p.argmax(1)
    acc = float((pred == yte).mean())
    metrics = {
        "crop": crop,
        "task": info["task"],
        "labels": labels,
        "dataset": info["dataset"],
        "backbone": f"MobileNetV2 alpha={ALPHA}, ImageNet weights, {IMG}px",
        "counts": {"train": len(train), "val": len(val), "test": len(test)},
        "test_accuracy": acc,
        "test_accuracy_wilson95": wilson(acc, len(yte)),
        "majority_baseline": float(np.bincount(yte, minlength=len(labels)).max() / len(yte)),
        "confusion": confusion_matrix(yte, pred, labels=list(range(len(labels)))).tolist(),
        "report": classification_report(yte, pred, labels=list(range(len(labels))), target_names=labels, output_dict=True, zero_division=0),
        "temperature": temperature,
        "seconds": round(time.time() - t0),
    }
    if crop == "wheat":  # accuracy of the 3-way quality group each kernel falls in
        group = np.array([0, 2, 1, 2, 1, 1, 2, 2])  # A normal; B sprouted/pest/broken; C fusarium-shrivelled/mouldy/black point/impurity
        g_acc = float((group[pred] == group[yte]).mean())
        metrics["kernel_group_accuracy"] = g_acc
        metrics["kernel_group_wilson95"] = wilson(g_acc, len(yte))
        metrics["kernel_group_map"] = group.tolist()
    if crop == "sugarcane":  # a farmer photographs one billet several times: average its views
        keys = [re.match(r"(\d+-b[a-z]?\d+)", os.path.basename(f).lower()) for f, _ in test]
        billet = {}
        for i, (f, y) in enumerate(test):
            k = (os.path.dirname(f), keys[i].group(1) if keys[i] else f)
            billet.setdefault(k, []).append(i)
        bp = np.array([p[idx].mean(0).argmax() for idx in billet.values()])
        by = np.array([yte[idx[0]] for idx in billet.values()])
        b_acc = float((bp == by).mean())
        metrics["billet_accuracy"] = b_acc
        metrics["billet_count"] = int(len(by))
        metrics["billet_wilson95"] = wilson(b_acc, len(by))
    print(json.dumps({k: metrics[k] for k in ("test_accuracy", "test_accuracy_wilson95", "majority_baseline", "temperature")}), flush=True)
    print(classification_report(yte, pred, labels=list(range(len(labels))), target_names=labels, zero_division=0), flush=True)
    json.dump(metrics, open(os.path.join(out, "metrics.json"), "w"), indent=1)
    model.save(os.path.join(out, "model.h5"))
    print(f"saved {crop} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
