# Collecting graded photos

The khajoor model was trained on public photos of Gajar, Kupro and Aseel. It has never seen Dhakki, the D.I. Khan variety the app is for. Melon, wheat and sugarcane have no trained model at all, and use a rule-based estimate that has never been measured.

The only way to fix both is graded photos from D.I. Khan. This guide says what to shoot, how to label it, and where to put it.

> **The grade definitions below for melon, wheat and sugarcane are DRAFTS.** Nobody has checked them against how D.I. Khan buyers actually grade. Confirm each one with a local buyer, commission agent or mandi grader before collecting. None of this wording is in the app.

## For every crop

- **One photo per unit:** one fruit, one stalk section, or one handful of grain.
- **Camera position:** straight down from about 25–30 cm.
- **Background:** plain, light-coloured cloth or paper that fills the whole background. The app finds the fruit by contrast against the edge of the photo, so avoid patterned cloth.
- **Light:** daylight, in shade, not direct sun. No flash.
- **Phone:** any phone camera works. Don't use filters, "beauty" modes or zoom.
- **Grades:** Grade 1, 2 and 3. The app shows these as A, B and C.
- **How many:** at least 100 photos in total, and at least 30 per grade. 300 is much better. Don't let one grade be most of the set, because a model that always says "A" would then look accurate.
- **Who grades:** a person who buys or sells that crop assigns the grade, not the photographer. Write down who it was. If two graders disagree on a photo, keep it out of the set and note it in `labels.csv`.
- **Extra check photos:** also take 20–30 field photos (piles, crates, stalls, harsh light). Keep them separate as a check set. They are not used for training, but they show how the model does in the real world.

### Folder layout

Put the photos under `ml/data/raw/`, which is not committed to git:

```
ml/data/raw/
  Dhakki/
    Grade-1/   *.jpg
    Grade-2/   *.jpg
    Grade-3/   *.jpg
  Dhakki-field-check/        (real-world shots, not used for training)
```

- **Folder names:** the variety folder can be `Dhakki` or `dhakki`, because the loader ignores case. Use `Dhakki` to match the code.
- **Size level:** an extra level such as `Dhakki/Large/Grade-1/` also works, which is the Mendeley layout.
- **File types:** `.jpg`, `.jpeg` and `.png`.

### labels.csv

Keep one `labels.csv` next to the grade folders:

```
file,grade,graded_by,date,place,notes
Dhakki/Grade-1/IMG_0012.jpg,1,Haji Rehmat (commission agent),2026-10-02,D.I. Khan fruit mandi,
Dhakki/Grade-3/IMG_0107.jpg,3,Haji Rehmat (commission agent),2026-10-02,D.I. Khan fruit mandi,insect holes
```

The training script reads the grade from the folder name. The CSV records who graded each photo, so we can trace disagreements.

## Dhakki dates (highest priority)

These photos go straight into the existing model. No new code is needed.

- **What to shoot:** single dried or semi-dried Dhakki fruit, top-down, one per photo, the same framing as the Mendeley set.
- **Fresh doka:** fresh doka fruit is a different look. Collect it in a separate `Dhakki-doka/` folder only if doka will be graded too.
- **How grades are defined:** use whatever criteria local buyers already use. Typical signals are size, even dark colour, skin intact and not torn, no insect damage, no mould, and no dry or hard fruit. Ask the grader what separates 1 from 2 from 3, and write it down here once confirmed.

### Then retrain

The scripts live in the repo's `ml/` folder. The dataset, venv and outputs can live anywhere you point `DERAMANDI_RAW` and `DERAMANDI_OUT` at.

```bash
cd ml
python download_raw.py                         # Mendeley originals, if not already there
EXTRA_VARIETIES=Aseel,Dhakki python leak_check.py
EXTRA_VARIETIES=Aseel,Dhakki python train.py   # ~10 min on CPU
python export.py                               # writes the model, model card and samples into the app
python parity_prep.py                          # optional browser-vs-Python check
cd .. && npm test && npm run build
```

**What updates automatically**, because `export.py` reads it all from the training run:

- **Headline accuracy:** it becomes Dhakki's own held-out accuracy, with its photo count and 95% range. Gajar + Kupro becomes the secondary figure.
- **Dhakki wording:** the "not trained on Dhakki yet" text on the result screen and the About page switches to the Dhakki version.
- **Colour guard:** the "unfamiliar photo" guard is recomputed from the training photos, Dhakki included, so real Dhakki is not flagged as unfamiliar.
- **Samples:** the in-app sample photos come from the Dhakki test photos.

**What to do by hand:**

- Copy `out/metrics.json` and `out/splits.json` into `ml/`.
- Update the numbers in `ml/README.md` and the README judge notes.
- Commit and push. Vercel redeploys.

**Small test sets have wide ranges.** With 100–300 Dhakki photos, only 15–45 end up in the test split, and the 95% range can be ±15–25 points. The app and About page show that range, and nobody should quote a single lucky number without it.

## Melon, wheat and sugarcane

These need both photos and some new code (see the end of this file). Settle the grade definitions with a local buyer first.

### Kulachi melon: DRAFT criteria

- **What to shoot:** one whole melon, top-down or side-on, always the same way. Add a second photo of the underside ("ground spot") if the grader uses it.
- **Grade 1:** full size for the variety, even netting, ripe colour, no cracks, soft spots or sunburn.
- **Grade 2:** smaller or uneven netting, minor surface marks, a small healed crack.
- **Grade 3:** undersized, bruised or soft spots, open cracks, sunburn, or signs of rot.

### Wheat: DRAFT criteria

- **What to shoot:** one handful of grain spread in a single layer on a dark cloth (wheat is light, so a dark background gives contrast), top-down.
- **How it's graded:** wheat is traded on the share of damaged, broken and shrivelled kernels and on foreign matter. Grade by that share, and ask the buyer which limits separate the grades.
- **Grade 1:** plump, even golden kernels, almost no damaged or broken kernels, no foreign matter.
- **Grade 2:** some shrivelled or broken kernels, a little foreign matter.
- **Grade 3:** many damaged, insect-bored or discoloured kernels, or clear foreign matter.
- **Public data:** there is one public set with grains labelled healthy or sunn-pest-damaged (Mendeley, doi:10.17632/gmw48bvxdz.1, CC BY 4.0, 170 tray photos of six Turkish varieties). It has no grades and covers one pest, so it could help only as extra training data, never as the whole set. Using it is Ali's call.

### Sugarcane: DRAFT criteria

- **What to shoot:** a 30–40 cm section of cut stalk on a plain cloth, side-on. Add a second photo of the cut end, because red rot shows there.
- **Grade 1:** thick, straight stalk, even colour, no splits, borer holes or red discolouration in the cut.
- **Grade 2:** thinner stalk, minor surface damage, a few borer marks.
- **Grade 3:** thin or dried stalk, splits, many borer holes, or red rot in the cut end.
- **Public data:** the public sugarcane sets are leaf-disease photos, not stalk quality. Don't train on them.

## Code needed before a second crop can have a model

Right now the app has exactly one model (khajoor) at `public/model/`. A second crop needs:

1. **Training:** `train.py` and `export.py` take a crop name and write to `public/model/<crop>/`, with one model card per crop. The khajoor path should keep working unchanged.
2. **App:** `src/lib/model.ts` loads the model for the listing's crop, and `gradeCrop` sends a crop to its model when one exists, otherwise to the rules. Keep the rules for any crop without a model.
3. **Offline:** `vite.config.ts` already precaches every `.json` and `.bin` under `public/`. Check the total offline download size stays reasonable, since each model is about 4.5 MB.
4. **Wording:** per-crop wording on the result screen and About page, switching from "rule-based estimate" to that crop's own model, dataset and measured accuracy.
5. **Tests and docs:**
   - Extend `src/__tests__/model.test.ts` to check every shipped model and card.
   - Add a section per crop to `ml/README.md` covering the data source, grade definitions and known gaps.

Build this once the first non-khajoor photo set exists. Without a real second model, the plumbing can't be tested.
