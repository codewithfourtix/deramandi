"""Record the Urdu voice guide clips.

  pip install edge-tts
  python scripts/make-voice.py

Every key in src/data/voiceClips.json is looked up in src/i18n/ur.json and
spoken by an Urdu (Pakistan) neural voice. Numbers 0 to 99 and the words for
hundred, thousand and lakh are recorded too, so prices and weights can be read
out by joining clips. Files are named by a hash of their text, so a changed
line gets a new file and an unchanged one is never recorded twice.

Writes public/voice/ur/*.mp3 and src/data/voiceManifest.json (key -> file).
Needs internet once; the app then plays the clips offline.
"""
import asyncio
import hashlib
import json
import os
import re
import sys

import edge_tts

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
VOICE = os.environ.get("VOICE", "ur-PK-AsadNeural")
OUT = os.path.join(ROOT, "public", "voice", "ur")

NUMBERS = (
    "صفر ایک دو تین چار پانچ چھ سات آٹھ نو دس گیارہ بارہ تیرہ چودہ پندرہ سولہ سترہ اٹھارہ انیس "
    "بیس اکیس بائیس تیئیس چوبیس پچیس چھبیس ستائیس اٹھائیس انتیس تیس اکتیس بتیس تینتیس چونتیس "
    "پینتیس چھتیس سینتیس اڑتیس انتالیس چالیس اکتالیس بیالیس تینتالیس چوالیس پینتالیس چھیالیس "
    "سینتالیس اڑتالیس انچاس پچاس اکیاون باون ترپن چون پچپن چھپن ستاون اٹھاون انسٹھ ساٹھ اکسٹھ "
    "باسٹھ تریسٹھ چونسٹھ پینسٹھ چھیاسٹھ سڑسٹھ اڑسٹھ انہتر ستر اکہتر بہتر تہتر چوہتر پچہتر چھہتر "
    "ستتر اٹھہتر اناسی اسی اکیاسی بیاسی تراسی چوراسی پچاسی چھیاسی ستاسی اٹھاسی نواسی نوے اکیانوے "
    "بانوے ترانوے چورانوے پچانوے چھیانوے ستانوے اٹھانوے ننانوے"
).split()
assert len(NUMBERS) == 100, len(NUMBERS)
WORDS = {"n.hundred": "سو", "n.thousand": "ہزار", "n.lakh": "لاکھ", "n.sadhe": "ساڑھے", "n.derh": "ڈیڑھ", "n.dhai": "ڈھائی"}


def lookup(tree, key):
    node = tree
    for part in key.split("."):
        node = node[part]
    return node


async def record(key, text, sem, manifest):
    digest = hashlib.sha1(f"{VOICE}|{text}".encode()).hexdigest()[:10]
    name = f"{re.sub(r'[^a-z0-9]+', '-', key.lower()).strip('-')}.{digest}.mp3"
    manifest[key] = name
    path = os.path.join(OUT, name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return False
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate="-8%").save(path)
                return True
            except Exception as e:  # network hiccup: retry
                if attempt == 3:
                    raise
                print(f"retry {key}: {e}", file=sys.stderr)
                await asyncio.sleep(2 + attempt * 3)


async def main():
    ur = json.load(open(os.path.join(ROOT, "src", "i18n", "ur.json"), encoding="utf-8"))
    keys = json.load(open(os.path.join(ROOT, "src", "data", "voiceClips.json"), encoding="utf-8"))["keys"]
    lines = {}
    for k in keys:
        text = lookup(ur, k)
        assert "{{" not in text, f"{k} has a placeholder; voice clips must be fixed text"
        lines[k] = text
    for i, w in enumerate(NUMBERS):
        lines[f"n.{i}"] = w
    lines.update(WORDS)

    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    sem = asyncio.Semaphore(4)
    made = await asyncio.gather(*(record(k, t, sem, manifest) for k, t in lines.items()))
    keep = set(manifest.values())
    removed = 0
    for f in os.listdir(OUT):
        if f.endswith(".mp3") and f not in keep:
            os.remove(os.path.join(OUT, f))
            removed += 1
    ordered = {k: manifest[k] for k in lines}
    with open(os.path.join(ROOT, "src", "data", "voiceManifest.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"voice": VOICE, "clips": ordered}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in keep)
    print(f"{len(lines)} clips ({sum(bool(m) for m in made)} new, {removed} removed), {size / 1e6:.2f} MB")


asyncio.run(main())
