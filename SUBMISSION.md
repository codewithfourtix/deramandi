# Submission drafts for the Banao portal

Paste these into the Imaginathon dashboard. Character counts were checked by script against the portal limits.

## Project name (10/80 characters)

Dera Mandi

## One-line description (151/160 characters)

Urdu-first app for D.I. Khan farmers: photograph a crop, get a grade, today's fair mandi price and the best way to sell, then reach buyers on WhatsApp.

## What it is about, in one line (183/240 characters)

The price and spoilage gap for D.I. Khan growers of Dhakki dates and Kulachi melons: agents set the price, fruit spoils without cold storage, and small lots never reach export buyers.

## What you built (682/800 characters)

An Urdu-first web app (Nastaliq, English one tap away, a spoken Urdu voice guide toggled by a double tap) for cheap Android phones and weak signal: installable, grades offline. A grower photographs the crop through a camera guide and gets Grade A, B or C from models we trained, running on the phone: khajoor 72% on held-out photos (baseline 43%), sugarcane 93% per billet. The price comes from today's AMIS mandi rates, split by grade, with sell-now, Multan and cold-store options costed. It makes a grade certificate PDF with a QR check link and a WhatsApp Status image, grades a whole lot fruit by fruit, supports helpers listing for many growers, and sends requests on WhatsApp.

## Domain

Agriculture (closest option on the portal)

## Main build link

https://deramandi.vercel.app

## Repository link

https://github.com/codewithfourtix/deramandi

## Notes for the judges (475/600 characters)

Every step works end to end in Urdu and English, offline after first visit. Models run in-browser, each tested once on held-out data: khajoor 72% (CI 67-77%, baseline 43%), sugarcane 82% per photo, 93% per billet. Melon uses a model trained on other graded fruit, never tested on melon; wheat uses a labelled rule estimate (our wheat model failed its test). No Dhakki photos exist publicly. Prices are live AMIS rates; buyers are samples; demo requests go to a team WhatsApp.
