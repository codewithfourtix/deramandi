# Khajoor grade model

The model behind the khajoor grade in the app: MobileNetV2 (ImageNet weights), fine-tuned to tell Grade 1 / 2 / 3 dried khajoor apart. The app shows these as A / B / C. It runs in the browser with TensorFlow.js from `public/model/`.

## Data

The data is the *Date Fruit Dataset for Inspection and Grading*: Maitlo, A. K. et al., Shah Abdul Latif University, Khairpur. It is on Mendeley Data, V3 (2023), [doi:10.17632/s5zfvsw5kv.3](https://data.mendeley.com/datasets/s5zfvsw5kv/3), licensed CC BY 4.0.

The photos show single dried khajoor fruits, shot from above under a ring light. The varieties are Aseel, Fasli Toto, Gajar and Kupro. There is no Dhakki.

**What we used, and why:**

- **Only the 3,004 original photos.** The dataset also publishes augmented copies. Mixing those into a split would leak test images into training.
- **Training varieties: Gajar and Kupro.** These are the only two with all three grades. Aseel and Fasli Toto are Grade 1 only. Training on them would teach "this variety means Grade A", so they are held out as an unseen-variety check.
- **Duplicates removed before splitting.** The dataset contains 45 byte-identical files and other near-identical shots of the same fruit. A naive random split put 12 test photos that were byte-identical to training photos.
  - Images are grouped by perceptual hash (dHash, ≤10 of 256 bits apart, joined with union-find).
  - Each group stays in one split, and only one image per group is used for validation and test.
  - Groups whose copies were filed under different grades (45 images) are dropped as label noise.
  - The split is stratified by variety and grade, about 70/15/15, with seed 1337. No validation or test photo is within 10 bits of any training photo.

**Changes made to the data:** duplicates were removed, and photos were cropped to the fruit and resized. The in-app samples (`public/samples/`) are six held-out test photos, resized.

## Results

`metrics.json` holds the full numbers from the last run: per-grade precision and recall, the confusion matrix, per-variety accuracy, the unseen-variety check and the calibration temperature. `splits.json` lists exactly which files went where.

- The test split was used once, for the final report.
- The early stopping, learning-rate schedule and calibration temperature were all chosen on validation only.

## Reproduce

Run these from this folder with Python 3.12:

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
python list_files.py       # dataset file list (metadata only)
python download_raw.py     # original photos only, ~184 MB, into data/raw
python leak_check.py       # duplicate and near-duplicate report
python train.py            # ~20 min on an 8-core laptop CPU; writes out/model.h5 + out/metrics.json
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
