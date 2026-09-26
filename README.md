# Dera Mandi · ڈیرہ منڈی

A bilingual (Urdu first, with English) web app for crop growers in Dera Ismail Khan. A grower photographs the crop and gets a quality grade (A, B or C), the fair price band buyers pay for that grade, and matched buyers, storage and transport. Then they send a request.

Built for **Imaginathon by Banao** by The Four Musketeers.

## The problem

D.I. Khan grows export-grade Dhakki dates and Kulachi melons, plus wheat and sugarcane. Growers still lose most of that value, for three linked reasons:

- **Price is opaque.** Growers sell to the commission agent at the price he names.
- **Fruit spoils.** Cold storage is scarce and the roads to Multan and Karachi are long.
- **Small lots cannot reach export.**

Dera Mandi treats these as one problem: a trusted grade, a reference price, and a route to buyers and cold storage.

## The loop

1. **List:** pick the crop, quantity (with a maund conversion) and village.
2. **Photograph:** 1 to 3 photos, from the camera or the gallery.
3. **Grade:** A, B or C, stamped on the grower's own photo.
   - Khajoor: from a trained image model, with its probability for each grade and each photo's own grade.
   - Other crops: a rule-based estimate with its reasons (size, colour, marks).
4. **Price:** the fair band for that grade, the value of the whole lot, and a chart of all three grades.
5. **Match:**
   - Buyers who take that crop, grade and quantity.
   - Storage and transport nearest the village, with cold storage first for fruit.
   - When a lot is too small for an exporter, a note says it can be combined with nearby lots.
6. **Request:** pick a buyer and, optionally, a store or truck, then send.
7. **History:** My listings shows every listing with its grade, price and status, and each one can be deleted.

## What is real and what is sample

| Real | Sample |
|---|---|
| The full flow in Urdu (RTL, Nastaliq) and English | Every buyer, store and transporter (invented) |
| A trained khajoor grade model, run on the device | Reference prices (illustrative, not live mandi rates) |
| Photo checks (dark, washed out, no crop, unfamiliar) | |
| Matching by crop, grade, quantity and distance | Request delivery: saved on the phone, never sent |
| Listings and photos saved on the phone; installable and works offline | |

**How the grade works:**

- **Khajoor (the main crop): a trained image model.**
  - It is MobileNetV2, fine-tuned on a public dataset of graded Pakistani khajoor photos (Mendeley, CC BY 4.0), and it runs in the browser with TensorFlow.js.
  - **Measured on 311 held-out photos:** it gives the right grade (1/2/3 = A/B/C) **72.0%** of the time. The 95% interval is 66.8–76.7%, and always guessing the most common grade would score 42.8%.
  - On a variety it never trained on (Fasli Toto), it called 66% of the Grade 1 fruit A.
  - Its "% sure" is calibrated on validation data.
  - Full method, the duplicate-removal fix, and the browser-vs-Python parity check are in [`ml/README.md`](ml/README.md).
- **Limits:**
  - The dataset has no Dhakki, and its photos are lab shots of one fruit each on a light background.
  - Expect lower accuracy on field photos and piles, and treat the grade as a strong starting reference. The crop is checked in person before shipment.
  - The next step is retraining with 100 to 300 graded Dhakki photos from D.I. Khan growers.
- **Other crops: rule-based.** Melon, wheat, sugarcane and anything else get a rule-based colour, size and defect estimate, because no graded photo set exists for them. The app labels this as an estimate.
- **Photo checks first.** A photo that is too dark, washed out, or has no crop in it gets a retake prompt, never a grade. Khajoor photos whose colours fall far outside the dataset's range are graded, but flagged as unfamiliar.

**Sample photos:**

- For khajoor, the photos step offers six real held-out test photos from the dataset, two per grade. The model never trained on them.
- For other crops it offers labelled drawings.

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, react-router, react-i18next, TensorFlow.js (loaded lazily, only when a khajoor listing is graded), vite-plugin-pwa and Vitest. The model is trained in Python with TensorFlow/Keras (`ml/`). Fonts are self-hosted: Archivo and Noto Nastaliq Urdu. There is no backend, no database, no accounts and no external API calls. The whole app is one static build, and the 4.5 MB model is cached for offline use after its first run.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests: translations, seed data, matching, photo scoring, model card
npm run build      # type-check + production build into dist/
npm start          # serve dist/ on $PORT (default 3000), with SPA fallback
```

To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the network address it prints.

## Deploy

The build is a static site. Every route falls back to `index.html`, so deep links like `/listing/abc` work after a refresh.

- **Vercel:** import the GitHub repo. `vercel.json` sets the Vite build, the `dist` output and the SPA rewrite. No environment variables are needed.
- **Netlify:** set the build command to `npm run build` and the publish directory to `dist`. `public/_redirects` handles the SPA fallback.
- **Railway:** set the build command to `npm run build` and the start command to `npm start`. `serve` reads Railway's `$PORT` automatically.

## Where things live

```
src/
  pages/        Home, ListDetails, ListPhotos, Result, Sent, MyListings, About
  components/   GradeStamp, PriceLadder, CropGlyph, Price, Layout, LanguageToggle
  lib/grader.ts gradeCrop(images, crop): the single grading seam
  lib/model.ts  khajoor model: preprocessing (mirrors ml/preprocess.py), TTA, calibration
  data/modelCard.json  measured accuracy the app displays (written by ml/export.py)
  lib/match.ts  price bands, buyer matching, logistics ranking
  lib/samples.ts drawn sample photos (non-khajoor crops)
public/model/   the TF.js khajoor model;  public/samples/  held-out khajoor test photos
ml/             training pipeline, metrics.json, splits.json, README
  data/         seeded buyers, logistics, reference prices, D.I. Khan locations
  i18n/         en.json and ur.json (every user-facing string)
```

**Retraining:** run `ml/` (see its README), then `python export.py`. That rewrites `public/model/`, the model card the app shows, and the samples. Every screen only calls `gradeCrop(images, crop)`, so nothing else changes.

## Notes for the judges

This is a farmer-first MVP. Everything the grower touches works end to end in Urdu and English, offline after the first visit, and nothing leaves the phone.

**The khajoor grade is real.** It comes from a MobileNetV2 model we trained on a public graded Pakistani khajoor dataset, and it runs in the browser. On 311 held-out photos it scored 72% (95% interval 67–77%; the always-guess-most-common baseline is 43%). We found and removed train/test duplicates in the dataset before measuring.

**Limits:**
- The dataset has no Dhakki.
- Its photos are lab shots of one fruit each.
- Other crops use a labelled rule-based estimate.

Buyers, storage, transport and prices are seeded sample data.

## Credits

Khajoor training data: Maitlo, A. K. et al., *Date Fruit Dataset for Inspection and Grading*, Mendeley Data, V3 (2023), doi:10.17632/s5zfvsw5kv.3, licensed CC BY 4.0. We used only the original photos, removed duplicates, and cropped and resized photos for training and for the six in-app samples.
