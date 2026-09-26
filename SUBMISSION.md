# Submission drafts for the Banao portal

Paste these into the Imaginathon dashboard. Character counts were checked by script against the portal limits.

## Project name (10/80 characters)

Dera Mandi

## One-line description (142/160 characters)

Urdu-first web app for D.I. Khan farmers: photograph a crop, get a grade and fair price band, and reach matched buyers, storage and transport.

## What it is about, in one line (183/240 characters)

The price and spoilage gap for D.I. Khan growers of Dhakki dates and Kulachi melons: agents set the price, fruit spoils without cold storage, and small lots never reach export buyers.

## What you built (697/800 characters)

An Urdu-first bilingual web app (right-to-left Nastaliq, English one tap away) built for cheap Android phones and weak signal: installable, works offline. A grower lists crop, quantity and village, adds photos, and gets Grade A, B or C, the fair price band for that grade and the lot's value. Khajoor is graded by a MobileNetV2 model we trained on graded Pakistani khajoor photos, running on the phone: 72% correct on 311 held-out photos vs a 43% baseline. Dark or crop-less photos are refused. It then matches buyers by crop, grade and quantity, ranks nearby cold storage and transport, flags small lots for pooling toward export, and tracks requests. Buyers and logistics are seeded sample data.

## Domain

Agriculture (closest option on the portal)

## Main build link

https://deramandi.vercel.app

## Repository link

https://github.com/codewithfourtix/deramandi

## Notes for the judges (529/600 characters)

Farmer-first MVP: every grower-facing step works end to end in Urdu and English, offline after first visit, and nothing leaves the phone. The khajoor grade is a real MobileNetV2 model trained on a public Pakistani khajoor grading dataset (Mendeley, CC BY 4.0), run in-browser: 72% on 311 held-out photos (95% CI 67-77%, baseline 43%), after removing train/test duplicates. Limits: no Dhakki in the data, lab photos of single fruits; other crops use a labelled rule-based estimate. Buyers, logistics and prices are seeded samples.
