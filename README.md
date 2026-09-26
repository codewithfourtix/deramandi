# Dera Mandi · ڈیرہ منڈی

A bilingual (Urdu first, with English) web app for crop growers in Dera Ismail Khan. A grower photographs the crop and gets a quality grade (A, B or C), the fair price for that grade from today's public mandi rates, and the best way to sell. It also shows matched buyers, storage and transport, and a grade certificate. Then they send a request on WhatsApp.

Built for **Imaginathon by Banao** by The Four Musketeers.

**Live:** https://deramandi.vercel.app

## The problem

D.I. Khan grows export-grade Dhakki dates and Kulachi melons, plus wheat and sugarcane. Growers still lose most of that value, for three linked reasons:

- **Price is opaque.** Growers sell to the commission agent at the price he names.
- **Fruit spoils.** Cold storage is scarce and the roads to Multan and Karachi are long.
- **Small lots cannot reach export.**

Dera Mandi treats these as one problem: a trusted grade, a reference price, and a route to buyers and cold storage.

## The loop

1. **List:** crop, quantity (with maund conversion; the weight can be spoken), village. In helper mode, also whose crop it is.
2. **Photograph:** a live camera guide with a crop-shaped frame and light and blur warnings, or the gallery.
   - One sample (up to 3 photos) or a whole lot (up to 10 photos, one fruit each, graded one by one).
3. **Grade:** A, B or C, stamped on the grower's own photo, with the evidence behind it:
   - the model's certainty;
   - its measured accuracy;
   - what was measured from the photo;
   - one selling tip.
4. **Price:** today's public mandi rate for the crop (AMIS Punjab), split into thirds for C, B and A. The grower can type their own mandi's rate instead.
5. **Decide:** sell now, send to Multan, or store and sell later, each with the take-home after commission, transport, storage and losses. Every assumption can be edited.
6. **Show:** a PDF grade certificate (photo, grade, price, how the grade was made, dataset citation, QR check link) and a WhatsApp Status image.
7. **Request:** pick a buyer and, optionally, storage or transport. In demo mode the request opens WhatsApp to the demo number.
8. **History:** search, filter by status or grower, spreadsheet export, backup and restore.

**Voice guide.** On first open the app offers, out loud, to speak each step.
- A double tap anywhere on the screen, or the speaker button, turns it on or off.
- Lines are recorded Urdu clips (numbers are joined from number clips), so it works offline and on phones with no Urdu voice.

## How each crop is graded

| Crop | Grader | Held-out result | What it has not seen |
|---|---|---|---|
| Khajoor (Dhakki dates) | MobileNetV2, 224 px, trained on graded Pakistani khajoor photos | **72.0%** on 311 photos (95% CI 66.8–76.7%; always guessing the commonest grade: 42.8%) | No Dhakki in any public dataset |
| Sugarcane | MobileNetV2, 224 px, good vs damaged billets | **82.3%** per photo on 452 photos (CI 78.5–85.5%; baseline 61.1%). **92.7%** per billet with its photos averaged, as the app does (96 billets, CI 85.7–96.4%) | Louisiana varieties on a dark background. Only good or damaged, so A or C. |
| Kulachi melon | MobileNetV2, 224 px, trained on graded mango, papaya, apple, tomato and Burmese grape | **85.9%** on 326 photos of those fruit (CI 81.7–89.3%; baseline 37.4%), with shots of the same fruit kept in one split | **Never tested on a melon.** No graded melon photos exist in public. |
| Wheat, other | Rule-based estimate from colour, coverage and dark spots | Not measured | Labelled as an estimate in the app |

**About wheat.** We trained three kernel-by-kernel wheat models on GrainSet. The best scores 92.8% on scanner close-ups and 86.8% on 2,003 held-out kernels cut out on cloth the way the app does. On synthetic "handful on a cloth" test photos, though, it read clean grain as damaged too often to grade a lot, so it is **not used** yet. The kernel finder, lot rule, confusion-matrix correction and tests are all in the repo, ready for a model that passes. See `ml/README.md`.

**Checks we ran.**
- Every model was evaluated once on an untouched test split, with near-duplicate photos grouped before splitting.
- The browser matches Python through the real upload path: khajoor 87/90, sugarcane 58/60, melon 59/60.
- A headless Chrome run on the live site graded khajoor and sugarcane with the network cut, and took photos through the live camera guide.

## What is real and what is sample

| Real | Sample |
|---|---|
| The whole flow in Urdu (RTL, Nastaliq) and English, with the voice guide | Every buyer, store and transporter (invented) |
| Grade models for khajoor, sugarcane and melon, run on the phone | Buyer offers (scaled to today's rate) |
| Public mandi rates from AMIS Punjab (live when online, a built-in snapshot offline) | Request delivery: WhatsApp to the demo number |
| Grade certificate PDF, WhatsApp Status image, spreadsheet export and backup | |
| Everything saved on the phone (IndexedDB); installable; grades offline | |

**Demo number.** In demo mode, which is on by default, requests open WhatsApp to 0313 4870456, a team member's number that is public in this repo and on the site. Switch demo mode off in Settings to save requests only on the phone.

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, react-router, react-i18next, TensorFlow.js (loaded lazily), pdf-lib, vite-plugin-pwa and Vitest. One Vercel serverless function (`api/prices.js`) fetches AMIS rates, because AMIS has no CORS. The models are trained in Python with TensorFlow/Keras (`ml/`). Voice clips are recorded with `scripts/make-voice.py`. There is no database and there are no accounts.

**Offline.** The service worker installs the app, the khajoor model and the voice clips (about 10 MB). The sugarcane and melon models (9 MB) are cached on first use, or all at once from Settings > Ready for offline.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # translations, voice clips, matching, prices, sell options, photo and model checks
npm run build      # type-check + production build into dist/
npm start          # serve dist/ on $PORT (default 3000), with SPA fallback
```

To try it on a phone on the same Wi-Fi, run `npm run dev -- --host`. The live camera needs HTTPS or localhost, so on a LAN address the camera button falls back to the phone's camera app.

## Deploy

Import the GitHub repo into Vercel. `vercel.json` sets the Vite build, the `dist` output and the SPA rewrite, and Vercel picks up `api/prices.js` as a function by itself. No environment variables are needed. On a static-only host the app still works, with prices from the built-in snapshot.

## Where things live

```
src/
  pages/          Home, ListDetails, ListPhotos, Result, Sent, MyListings, Prices, Settings, Accuracy, Check, About
  components/     CameraGuide, Voice, ModelBreakdown, CropModelBreakdown, LotBreakdown, GradeAdvice,
                  MarketRate, SellOptions, ShareActions, FarmerPicker, GradeStamp, PriceLadder, ...
  lib/grader.ts   gradeCrop / gradeLot: the single grading seam
  lib/model.ts    khajoor model (preprocessing mirrors ml/preprocess.py), TTA, calibration
  lib/cropModels.ts  sugarcane, melon (and wheat, when a model ships): model cards, kernel pipeline, lot rule
  lib/prices.ts   today's rate: your own > live AMIS > snapshot; grade bands
  lib/decide.ts   sell now / Multan / store comparison
  lib/voice.ts    voice guide playback; lib/spokenNumber.ts numbers for speech and spoken weights
  lib/certificate.ts, statusImage.ts, share.ts, checkCode.ts   certificate, Status image, WhatsApp, QR check link
  lib/storage.ts  IndexedDB listings and growers, backup and restore
  data/           seeded buyers and logistics, price snapshot, model cards, voice manifest
  i18n/           en.json and ur.json (every user-facing string)
api/prices.js     AMIS Punjab rates (Vercel function)
public/model/     khajoor model;  public/models/  sugarcane, melon;  public/voice/  Urdu clips
ml/               training, export, parity and test tooling for every crop (see ml/README.md)
scripts/          fetch-prices.mjs (price snapshot), make-voice.py (voice clips)
```

## Credits

- **Khajoor:** Maitlo, A. K. et al., *Date Fruit Dataset for Inspection and Grading*, Mendeley Data, V3 (2023), doi:10.17632/s5zfvsw5kv.3, CC BY 4.0.
- **Sugarcane:** The77Lab (LSU AgCenter), SugarcaneDeepLearning billet images, github.com/The77Lab/SugarcaneDeepLearning. No licence is published, so we use it for a non-commercial prototype with attribution; license or replace it before any commercial use.
- **Melon stand-in:** *AFruitDB: A Dataset of Common Asian Fruits for Quality Grading*, Mendeley Data bz65dz2pbj, CC BY 4.0.
- **Wheat (trained, not shipped):** Fan, L. et al., *GrainSet*, Figshare 22992317, CC BY 4.0.
- **Prices:** AMIS Punjab (amis.pk). Sugarcane: the 2025–26 indicative mill price.
- **Voice:** Urdu clips generated with a Microsoft neural voice (ur-PK-AsadNeural) via edge-tts.
