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
3. **Grade:** A, B or C, with a confidence and the reasons (size, colour, marks). The grade is stamped on the grower's own photo.
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
| Photo checks and grading, on the device | Reference prices (illustrative, not live mandi rates) |
| Matching by crop, grade, quantity and distance | Request delivery: saved on the phone, never sent |
| Listings and photos saved on the phone (localStorage) | |

**How the grade works:**

- It is a rule-based analysis of each photo, done in the browser. It looks at how much of the frame the crop fills, how close the colour is to ripe for that crop and how even it is, and how much shows dark spots, mould or unripe green.
- Before grading, each photo is checked. A photo that is too dark, washed out, or has no crop in it gets a retake prompt, never a grade.
- **This is not a trained model, and it has not been measured against graded lots.** It is a starting reference. The grade is confirmed by inspection in person before shipment.

The photos step also offers **drawn sample photos**, labelled as drawings, so the flow can be tried without real crop photos. A grade from a drawing proves nothing about real crops.

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, react-router, react-i18next and Vitest. Fonts are self-hosted: Archivo and Noto Nastaliq Urdu. There is no backend, no database, no accounts and no external API calls, and the whole app is one static build.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 27 tests: translations, seed data, matching, photo scoring
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
  lib/match.ts  price bands, buyer matching, logistics ranking
  lib/samples.ts drawn sample photos
  data/         seeded buyers, logistics, reference prices, D.I. Khan locations
  i18n/         en.json and ur.json (every user-facing string)
```

**Swapping in a trained model:**

- Every screen calls only `gradeCrop(images, crop)`, which returns `{ grade, confidence, factors }`.
- A MobileNetV2 classifier converted to TensorFlow.js can replace the internals of that one function. Keep the photo checks in front of it.
- It needs a labelled set of graded Dhakki date photos, which this prototype does not have yet.

## Notes for the judges

This is a farmer-first MVP. Everything the grower touches is real and works end to end, in Urdu and English, and nothing leaves the phone. Buyers, storage, transport and prices are seeded sample data, labelled as such in the app. The grade comes from rule-based colour, size and defect analysis in the browser, not a trained AI model, and no accuracy figure is claimed. Photos that are too dark or show no crop are refused instead of guessed at. A trained image model is the next step, and it plugs into the same `gradeCrop` function.
