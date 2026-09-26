# Grade models

Three trained models ship in the app: khajoor (the main crop), sugarcane and a melon stand-in. A wheat kernel model was trained too but is not shipped (see Wheat). Every number below comes from one evaluation on an untouched test split, and the app shows the same numbers from the model cards the export scripts write.

| Crop | Shipped | Held-out result |
|---|---|---|
| Khajoor | yes, `public/model/` | 72.0% on 311 photos (CI 66.8–76.7%), baseline 42.8% |
| Sugarcane | yes, `public/models/sugarcane/` | 82.3% per photo on 452 (CI 78.5–85.5%), 92.7% per billet on 96 (CI 85.7–96.4%), baseline 61.1% |
| Melon (stand-in) | yes, `public/models/melon/` | 85.9% on 326 photos of other fruit (CI 81.7–89.3%), baseline 37.4%; never tested on melon |
| Wheat kernels | no | 82.9% on 2,003 app-style held-out kernels (CI 81.2–84.5%); failed the handful test |

# Khajoor

The model behind the khajoor grade in the app: MobileNetV2 (ImageNet weights), fine-tuned to tell Grade 1 / 2 / 3 dried khajoor apart. The app shows these as A / B / C. It runs in the browser with TensorFlow.js from `public/model/`.

## Data

The data is the *Date Fruit Dataset for Inspection and Grading*: Maitlo, A. K. et al., Shah Abdul Latif University, Khairpur. It is on Mendeley Data, V3 (2023), [doi:10.17632/s5zfvsw5kv.3](https://data.mendeley.com/datasets/s5zfvsw5kv/3), licensed CC BY 4.0.

The photos show single dried khajoor fruits, shot from above under a ring light. The varieties are Aseel, Fasli Toto, Gajar and Kupro. There is no Dhakki.

**What we used, and why:**

- **Only the 3,004 original photos.** The dataset also publishes augmented copies. Mixing those into a split would leak test images into training.
- **Training varieties: Gajar, Kupro and Aseel. Fasli Toto is never seen**, and serves as an unseen-variety check.
  - Gajar and Kupro are the only varieties with all three grades.
  - The first version trained on those two alone. It learned "lighter colour means worse grade" and called 95% of the Grade 1 Aseel and Fasli Toto fruit C.
  - The shipped version adds Aseel (Grade 1 only) and uses strong colour augmentation, including 20% greyscale copies, so the model has to rely on wrinkles, damage and shape.
- **Duplicates removed before splitting.** The dataset contains 45 byte-identical files and other near-identical shots of the same fruit. A naive random split put 12 test photos that were byte-identical to training photos.
  - Images are grouped by perceptual hash (dHash, ≤10 of 256 bits apart, joined with union-find).
  - Each group stays in one split, and only one image per group is used for validation and test.
  - Groups whose copies were filed under different grades (45 images) are dropped as label noise.
  - The split is stratified by variety and grade, about 70/15/15, with seed 1337. No validation or test photo is within 10 bits of any training photo.

**Changes made to the data:** duplicates were removed, and photos were cropped to the fruit and resized. The in-app samples (`public/samples/`) are six held-out test photos, resized.

## Results

These are from the shipped model. Test photos were used once, and TTA means each photo is scored as three views, as the app does.

| Measure | Result |
|---|---|
| **Gajar + Kupro test accuracy** (three grades, 311 photos) | **72.0%**, 95% Wilson interval 66.8–76.7% |
| Always guessing the most common grade on that test set | 42.8% |
| Per variety | Gajar 73.9%, Kupro 69.1% |
| All test photos including Aseel (Grade 1 only, easy) | 77.1% of 384 |
| **Unseen variety, Fasli Toto** (all Grade 1): share called A | **66%** (the rest were called C) |
| Browser vs Python on 90 held-out photos, through the real upload path | same grade on 87/90. Browser accuracy 72% |
| Old rule-based grader on the same 90 photos | 24% |

**Confusion on all 384 test photos** (rows are the true grade, columns the predicted grade A, B, C):

- A: 190, 14, 2
- B: 43, 41, 15
- C: 7, 7, 65

Grade B is the hard one. It gets confused with both neighbours, and the dataset itself files 45 photos of the same fruit under two different grades.

**How the shipped version was chosen:**

- The first version (`metrics_v2_rejected.json`) scored 75.9% on Gajar + Kupro, but called 99.5% of unseen-variety Grade 1 fruit C.
- The shipped version was preferred because Dhakki is also a variety the model has never seen.
- This choice was made after looking at the unseen-variety numbers, so treat the Fasli Toto figure as indicative rather than a clean held-out measure.
- Early stopping, the learning-rate schedule and the calibration temperature (T = 0.70) were chosen on validation only.

`metrics.json` holds everything from the shipped run. `splits.json` lists exactly which files went where.

## Reproduce

Run these from this folder with Python 3.12:

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
python list_files.py       # dataset file list (metadata only)
python download_raw.py     # original photos only, ~184 MB, into data/raw
python leak_check.py       # duplicate and near-duplicate report
python train.py            # ~10 min on an 8-core laptop CPU (defaults = shipped config); writes out/model.h5 + out/metrics.json
python export.py           # TF.js model into ../public/model, model card, sample photos
python parity_prep.py      # optional: files for the browser-vs-Python parity check
```

| Setting | Default | What it does |
|---|---|---|
| `EXTRA_VARIETIES` | `Aseel` | Varieties trained on top of Gajar and Kupro. Use `Aseel,Dhakki` once Dhakki photos exist. |
| `COLOUR_AUG` | `strong` | `mild` gives the rejected first version. |
| `STAGE1_EPOCHS`, `FT_EPOCHS` | `10`, `30` | Frozen-backbone and fine-tune epochs. Early stopping usually ends fine-tuning sooner. |
| `ALPHA` | `1.0` | MobileNetV2 width. |
| `DERAMANDI_RAW` | `ml/data/raw` | Where the photos are. |
| `DERAMANDI_OUT` | `ml/out` | Where `model.h5`, `metrics.json` and `splits.json` go. |
| `DERAMANDI_APP` | the repo | Where `export.py` writes. Point it at a scratch folder for a dry run. |

## Adding Dhakki (and other crops)

See [`COLLECTING.md`](COLLECTING.md). It covers the photo protocol, draft grade definitions, the folder layout, `labels.csv`, the retrain steps, and the code a second crop will need.

Nothing about the training set is hard-coded in `export.py`. The headline accuracy, the "trained on Dhakki" flag in the app and the colour thresholds of the unfamiliar-photo guard are all read from the training run. Retraining with Dhakki therefore updates what the app claims.

**Verified with a dry run:** a stand-in `dhakki/` folder (lowercase, no size level) in a scratch copy of the data was found, trained and exported, and the card switched to a Dhakki headline with its own test count. The stand-in photos were Kupro, so those numbers meant nothing and were not shipped.

**Preprocessing:** `preprocess.py` and `src/lib/model.ts` do the same thing:

1. Find the fruit against the photo's border colour.
2. Crop to it with a 6% margin.
3. Pad it to a square with the border colour.
4. Resize to 224.

The app averages three views of each photo (as is, mirrored, upside down), the same as the reported test numbers.

## Limits

- **No Dhakki.** The model has never seen the D.I. Khan variety.
- **Lab photos only.** They are one fruit each, on a light background, under a ring light. Accuracy on field photos, piles, or fresh (doka) fruit will be lower.
- **Guard in the app.** If a photo's colours fall well outside the dataset's dried-khajoor range (`colour_stats.py`), the app warns that the photos look unfamiliar.
- **Next step:** 100 to 300 graded Dhakki photos from D.I. Khan growers, added to training.

# Sugarcane

**Data:** SugarcaneDeepLearning billet images (The77Lab, LSU AgCenter, [github.com/The77Lab/SugarcaneDeepLearning](https://github.com/The77Lab/SugarcaneDeepLearning)). There are 2,874 photos of cut billets from three Louisiana varieties (HoCP09-804, HoCP96-540, L01-299), each photographed from several sides on a dark background and labelled good or damaged. No licence file is published, so it is used here for a non-commercial prototype with attribution; license it or replace it before commercial use.

**Split:** by billet. Files are named `<session>-<billet>-<view>.png`, and all views of one billet stay in one split, about 70/15/15 per variety and label, seed 1337.

**Model:** MobileNetV2 α 1.0 at 224 px. The frozen backbone trains for 8 epochs, then the top 50% is fine-tuned with early stopping. Temperature is 0.75, fitted on validation.

**Results:**

| Measure | Result |
|---|---|
| Per photo, 452 test photos | **82.3%**, CI 78.5–85.5% |
| Always guessing "damaged" | 61.1% |
| Per billet, all its photos averaged (what the app does with several photos), 96 billets | **92.7%**, CI 85.7–96.4% |
| Recall: good / damaged | 72% / 89% |
| Browser vs Python, 60 test photos through the upload path | same grade on 58/60; browser 51/60 correct = Python |

**Leak check** (`leak_check_sugarcane.py`): the usual 16×16 dHash can't separate thin billets, so the check hashes the strip along the cane. Test photos are no closer to training photos (median 74 bits, minimum 34) than training photos are to other billets in training (median 75, minimum 32). No billet crossed splits.

The first run (160 px, α 0.5) scored 76.3%. The shipped 224 px run is the second of two runs, both reported.

**In the app:** two levels only, so good is A and damaged is C, never B. The photo tip asks for 2 or 3 lengthways photos of one piece on a dark cloth, turning it between shots, to match the data.

# Melon (stand-in)

No public dataset of graded melons exists. The melon grade comes from a model trained on **AFruitDB** (*A Dataset of Common Asian Fruits for Quality Grading*, Mendeley Data bz65dz2pbj, CC BY 4.0), which covers apple, Burmese grape, mango, papaya and tomato, each graded 1st/2nd/3rd (A/B/C). Banana was left out because it has only 2 third-grade photos.

**Split:** photos are named `IMG_<date>_<time>[_n]`, and shots taken seconds apart are often the same fruit turned over. Shots within 15 s of each other in a folder are chained into one group, and each group stays in one split. A first run with a plain random split scored 92.5% on 227 photos. That figure was inflated: 215 of those test photos were taken in the same minute as a training photo. It is kept in `out/melon_random_split` and was not shipped.

**Results (grouped split):** **85.9%** on 326 held-out photos of those fruits (CI 81.7–89.3%; baseline 37.4%). Recall is A 83%, B 81%, C 94%. Browser vs Python on 60: same grade on 59; browser 55 correct, Python 56.

**It has never been tested on a melon.** The app says so under every melon grade and on the "How sure are we?" page. Retrain with Kulachi melon photos (see `COLLECTING.md`).

# Wheat (trained, not shipped)

**Data:** GrainSet wheat (Fan et al., Figshare 22992317, CC BY 4.0). We took a balanced subset of its own train/test split: 450 training and 150 test images per class, over 8 classes (sound, fusarium/shrivelled, sprouted, mouldy, pest-attacked, broken, black point, impurity). Each image shows one kernel twice, front and back, on a scanner's black background, so `split_wheat_views.py` cuts it into two single views.

**App design:** the grower photographs a handful spread on a dark cloth.
- `src/lib/kernels.ts` finds each kernel: distance from the cloth colour, connected components, clumps skipped, and an 18% margin crop.
- The model classifies every kernel.
- The lot grade uses a stated rule: A needs at least 90% sound kernels and at most 2% seriously damaged; B needs at least 75% sound and at most 8% seriously damaged; anything else is C.
- Counted shares are corrected with the model's test confusion matrix (adjusted classify-and-count), because the test set is balanced while real lots are mostly sound.

**What happened:**

| Run | Scanner views (2,400) | App-style held-out kernels (2,003) | Synthetic handfuls (12 photos, 385 kernels) |
|---|---|---|---|
| v1: views only, low-res augmentation | 89.1% | 63.7% (sound recall 24%) | clean lots read ~15% sound; every lot C |
| v2: + the same training kernels pasted on random cloths and cut out the app's way (`make_wheat_appcrops.py`) | 90.8% | **82.9%** (sound recall 75%), quality group 87.0% | kernels found 358/385; sound-share error 0.32 raw, 0.20 corrected; clean lots still read 50–90% sound, every lot C |

Grade-A and grade-C handfuls overlap in the estimated sound share, so no threshold separates them, and the model is not shipped: wheat uses the labelled rule estimate. The handfuls are composites of held-out kernels (`make_wheat_handfuls.py`), not real phone photos, so even a pass would only have proved the pipeline. The next step is real photos of graded wheat handfuls from D.I. Khan.

# Commands for the other crops

```bash
# data (subsets only; the scripts read just the needed members of big zips with HTTP ranges)
python fetch_zip_subset.py <zip url> <out dir> <per-folder cap> <folder prefix>
python fetch_github_files.py <tree.json> The77Lab/SugarcaneDeepLearning master <out dir>

python train_crop.py sugarcane      # IMG=224 ALPHA=1.0 UNFREEZE=0.5 for the shipped run
python train_crop.py melon          # same settings
python export_crop.py sugarcane     # -> public/models/<crop>/ and src/data/models/<crop>.json
python parity_crop.py sugarcane     # then run the browser check (see the file header)

# wheat
python split_wheat_views.py
python make_wheat_appcrops.py                  # training crops, app style (COPY=2 for a second set)
SPLIT=test python make_wheat_appcrops.py       # held-out app-style test crops
APPCROPS=1 LOWRES=1 python train_crop.py wheat
python eval_wheat_appcrops.py                  # adds app_* metrics; export_crop headlines them
python make_wheat_handfuls.py                  # synthetic handfuls for the end-to-end check
```

Data goes in `DERAMANDI_DATA` (default `../../data`), outputs in `DERAMANDI_OUT`.
