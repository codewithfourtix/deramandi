# Khajoor grade model

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
