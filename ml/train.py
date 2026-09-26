"""Train the Dera Mandi khajoor grade model (MobileNetV2 transfer learning).

Data: Mendeley "Date Fruit Dataset for Inspection and Grading", CC BY 4.0,
Maitlo et al., Shah Abdul Latif University, DOI 10.17632/s5zfvsw5kv.3.
Only the ORIGINAL photos are used (never the published augmented copies).

Grades: Grade-1 -> A, Grade-2 -> B, Grade-3 -> C.
Training varieties: Gajar and Kupro (the only Mendeley varieties with all three
grades) plus EXTRA_VARIETIES (default "Aseel"; add Dhakki once the team's
photos are in data/raw/Dhakki, see COLLECTING.md). Mendeley varieties left out
of training are used as an unseen-variety check.

Outputs (DERAMANDI_OUT, default ml/out/): model.h5, metrics.json, splits.json.
"""
import json
import os
import random
import time

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
import tf_keras as keras  # noqa: E402
from PIL import Image  # noqa: E402
from sklearn.metrics import classification_report, confusion_matrix  # noqa: E402

from data import CORE_VARIETIES, OUT, RAW, SEED, canonical, collect, split  # noqa: E402
from preprocess import to_square  # noqa: E402

IMG = 224
COLOUR_AUG = os.environ.get("COLOUR_AUG", "strong")
STORE = 256  # images are stored at 256 and randomly cropped/zoomed to 224
LABELS = ["A", "B", "C"]
os.makedirs(OUT, exist_ok=True)

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)


def load(items, size):
    x = np.zeros((len(items), size, size, 3), dtype=np.uint8)
    for i, (f, _, _) in enumerate(items):
        x[i] = np.asarray(to_square(Image.open(f).convert("RGB"), size))
    y = np.array([it[1] for it in items], dtype=np.int32)
    return x, y


# ---- augmentation (train only) --------------------------------------------
def augment(img, label):
    img = tf.image.convert_image_dtype(img, tf.float32)  # 0..1
    # any orientation: a farmer can lay the fruit any way round
    img = tf.image.rot90(img, k=tf.random.uniform([], 0, 4, dtype=tf.int32))
    img = tf.image.random_flip_left_right(img)
    angle = tf.random.uniform([], -0.35, 0.35)
    img = rotate(img, angle)
    # zoom: crop between 78% and 100% of the stored square, then resize
    scale = tf.random.uniform([], 0.78, 1.0)
    crop = tf.cast(scale * STORE, tf.int32)
    img = tf.image.random_crop(img, [crop, crop, 3])
    img = tf.image.resize(img, [IMG, IMG])
    # lighting: phones in daylight vs a ring light
    if COLOUR_AUG == "strong":
        # Varieties differ in colour (Aseel is lighter than Gajar). Strong colour
        # jitter plus some greyscale copies push the model toward wrinkles,
        # damage and shape rather than "lighter = worse".
        img = tf.image.random_brightness(img, 0.3)
        img = tf.image.random_contrast(img, 0.7, 1.3)
        img = tf.image.random_saturation(img, 0.6, 1.4)
        img = tf.image.random_hue(img, 0.06)
        grey = tf.image.grayscale_to_rgb(tf.image.rgb_to_grayscale(img))
        img = tf.cond(tf.random.uniform([]) < 0.2, lambda: grey, lambda: img)
    else:
        img = tf.image.random_brightness(img, 0.18)
        img = tf.image.random_contrast(img, 0.8, 1.2)
        img = tf.image.random_saturation(img, 0.85, 1.15)
        img = tf.image.random_hue(img, 0.02)  # colour is a grade cue: keep hue shifts tiny
    img = tf.clip_by_value(img, 0.0, 1.0)
    return img * 255.0, label


def rotate(img, angle):
    """Small-angle rotation using a projective transform, filled by edge pixels."""
    size = tf.cast(tf.shape(img)[0], tf.float32)
    c, s = tf.cos(angle), tf.sin(angle)
    cx = cy = size / 2.0
    transform = [c, -s, cx - c * cx + s * cy, s, c, cy - s * cx - c * cy, 0.0, 0.0]
    out = tf.raw_ops.ImageProjectiveTransformV3(
        images=img[None], transforms=tf.convert_to_tensor([transform]), output_shape=tf.shape(img)[:2],
        interpolation="BILINEAR", fill_mode="NEAREST", fill_value=0.0,
    )
    return out[0]


def center(img, label):
    img = tf.image.resize(tf.cast(img, tf.float32), [IMG, IMG])
    return img, label


def dataset(x, y, train, batch=32):
    ds = tf.data.Dataset.from_tensor_slices((x, y))
    if train:
        ds = ds.shuffle(len(x), seed=SEED, reshuffle_each_iteration=True).map(augment, num_parallel_calls=tf.data.AUTOTUNE)
    else:
        ds = ds.map(center, num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(batch).prefetch(tf.data.AUTOTUNE)


# ---- model -----------------------------------------------------------------
def build(alpha):
    inp = keras.Input((IMG, IMG, 3), name="image")  # 0..255 RGB
    x = keras.layers.Rescaling(1.0 / 127.5, offset=-1.0, name="to_unit")(inp)  # MobileNetV2 wants -1..1
    base = keras.applications.MobileNetV2(input_shape=(IMG, IMG, 3), include_top=False, weights="imagenet", alpha=alpha)
    base.trainable = False
    x = base(x, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="pool")(x)
    x = keras.layers.Dropout(0.35, name="drop")(x)
    out = keras.layers.Dense(3, activation="softmax", name="grade", kernel_regularizer=keras.regularizers.l2(1e-4))(x)
    return keras.Model(inp, out, name="deramandi_grade"), base


def evaluate(model, x, y, tta=True):
    xs = tf.image.resize(tf.cast(x, tf.float32), [IMG, IMG]).numpy()
    p = model.predict(xs, batch_size=64, verbose=0)
    if tta:  # average with flipped and rotated views, same as the app does
        p = p + model.predict(xs[:, :, ::-1], batch_size=64, verbose=0)
        p = p + model.predict(np.rot90(xs, 2, axes=(1, 2)), batch_size=64, verbose=0)
        p = p / 3.0
    return p


def main():
    alpha = float(os.environ.get("ALPHA", "1.0"))
    t0 = time.time()
    extra = [canonical(v) for v in os.environ.get("EXTRA_VARIETIES", "Aseel").split(",") if v.strip()]
    train_varieties = CORE_VARIETIES + [v for v in extra if v not in CORE_VARIETIES]
    unseen_varieties = [v for v in ["Aseel", "Fasli Toto"] if v not in train_varieties]
    items = collect(train_varieties)
    missing = [v for v in train_varieties if not any(it[2] == v for it in items)]
    if missing:
        raise SystemExit(f"No photos found for {missing} under {RAW}. Check the folder names (see COLLECTING.md).")
    train, val, test = split(items, report=True)
    json.dump(
        {k: [os.path.relpath(f, RAW).replace("\\", "/") for f, _, _ in v] for k, v in (("train", train), ("val", val), ("test", test))},
        open(os.path.join(OUT, "splits.json"), "w"),
        indent=0,
    )
    print(f"train {len(train)}  val {len(val)}  test {len(test)}")

    xtr, ytr = load(train, STORE)
    xva, yva = load(val, STORE)
    xte, yte = load(test, STORE)
    unseen = collect(unseen_varieties)
    xun, yun = load(unseen, STORE) if unseen else (np.zeros((0, STORE, STORE, 3), np.uint8), np.zeros(0, np.int32))
    print(f"loaded in {time.time() - t0:.0f}s")

    counts = np.bincount(ytr, minlength=3)
    class_weight = {i: float(len(ytr) / (3 * c)) for i, c in enumerate(counts)}
    print("class counts", counts.tolist(), "weights", {k: round(v, 2) for k, v in class_weight.items()})

    model, base = build(alpha)
    dtr = dataset(xtr, ytr, True)
    dva = dataset(xva, yva, False)

    # stage 1: train the head on frozen ImageNet features
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(dtr, validation_data=dva, epochs=int(os.environ.get("STAGE1_EPOCHS", "10")), class_weight=class_weight, verbose=2)

    # stage 2: fine-tune the top of the backbone at a low learning rate
    base.trainable = True
    for layer in base.layers[: int(len(base.layers) * 0.6)]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, keras.layers.BatchNormalization):
            layer.trainable = False  # keep BN statistics stable on a small dataset
    model.compile(optimizer=keras.optimizers.Adam(2e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    ckpt = os.path.join(OUT, "best.h5")
    callbacks = [
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=6, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=2e-6),
        keras.callbacks.ModelCheckpoint(ckpt, monitor="val_loss", save_best_only=True),
    ]
    model.fit(dtr, validation_data=dva, epochs=int(os.environ.get("FT_EPOCHS", "30")), class_weight=class_weight, callbacks=callbacks, verbose=2)

    # ---- calibration on VALIDATION only: temperature scaling so "% sure" means something ----
    pv = np.clip(evaluate(model, xva, yva, True), 1e-7, 1.0)
    logp = np.log(pv)

    def nll(T):
        z = logp / T
        z = z - z.max(1, keepdims=True)
        q = np.exp(z) / np.exp(z).sum(1, keepdims=True)
        return float(-np.log(q[np.arange(len(yva)), yva] + 1e-12).mean())

    temps = np.linspace(0.5, 3.0, 51)
    temperature = float(temps[np.argmin([nll(T) for T in temps])])
    print(f"temperature {temperature:.2f} (val NLL {nll(1.0):.3f} -> {nll(temperature):.3f})")

    # ---- honest evaluation on the untouched test split (looked at once) ----
    results = {}
    for name, tta in (("plain", False), ("tta", True)):
        p = evaluate(model, xte, yte, tta)
        pred = p.argmax(1)
        results[name] = {
            "accuracy": float((pred == yte).mean()),
            "within_one_grade": float((np.abs(pred - yte) <= 1).mean()),
            "confusion": confusion_matrix(yte, pred, labels=[0, 1, 2]).tolist(),
            "report": classification_report(yte, pred, target_names=LABELS, output_dict=True, zero_division=0),
        }
        print(f"\n[test, {name}] accuracy {results[name]['accuracy']:.3f}")
        print(classification_report(yte, pred, target_names=LABELS, zero_division=0))
        print("confusion (rows=true A,B,C):", results[name]["confusion"])

    # per-variety test accuracy
    varieties = np.array([v for _, _, v in test])
    p = evaluate(model, xte, yte, True).argmax(1)
    per_variety = {str(v): float((p[varieties == v] == yte[varieties == v]).mean()) for v in sorted(set(varieties))}
    per_variety_n = {str(v): int((varieties == v).sum()) for v in sorted(set(varieties))}
    core = np.isin(varieties, CORE_VARIETIES)
    per_variety["Gajar+Kupro"] = float((p[core] == yte[core]).mean())
    per_variety_n["Gajar+Kupro"] = int(core.sum())
    print("per-variety test accuracy:", per_variety)

    # unseen varieties: every photo is Grade-1, so this is the share predicted A
    pu = evaluate(model, xun, yun, True).argmax(1) if len(xun) else np.zeros(0, int)
    unseen_share = {lab: float((pu == i).mean()) if len(pu) else 0.0 for i, lab in enumerate(LABELS)}
    print("unseen varieties (all true Grade-1): predicted share", unseen_share)

    acc = results["tta"]["accuracy"]
    n = len(yte)
    z = 1.96
    centre = (acc + z * z / (2 * n)) / (1 + z * z / n)
    half = z * np.sqrt(acc * (1 - acc) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    wilson = [float(centre - half), float(centre + half)]
    baseline = float(np.bincount(yte, minlength=3).max() / n)
    print(f"test accuracy {acc:.3f}, 95% CI {wilson[0]:.3f}-{wilson[1]:.3f}, majority baseline {baseline:.3f}")

    metrics = {
        "dataset": "Mendeley Date Fruit Dataset for Inspection and Grading (CC BY 4.0), DOI 10.17632/s5zfvsw5kv.3",
        "backbone": f"MobileNetV2 alpha={alpha}, ImageNet weights, {IMG}px",
        "train_varieties": train_varieties,
        "unseen_varieties": unseen_varieties,
        "colour_aug": COLOUR_AUG,
        "counts": {"train": len(train), "val": len(val), "test": len(test), "unseen": len(unseen)},
        "test": results,
        "test_per_variety_tta": per_variety,
        "test_per_variety_n": per_variety_n,
        "test_accuracy_wilson95": wilson,
        "majority_baseline": baseline,
        "temperature": temperature,
        "unseen_varieties_grade1_predicted_share": unseen_share,
        "seconds": round(time.time() - t0),
    }
    json.dump(metrics, open(os.path.join(OUT, "metrics.json"), "w"), indent=1)
    model.save(os.path.join(OUT, "model.h5"))
    print(f"\nsaved model and metrics in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
