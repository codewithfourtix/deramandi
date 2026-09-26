"""Download only the original (non-augmented) images of the Mendeley
"Date Fruit Dataset for Inspection and Grading" (CC BY 4.0, DOI 10.17632/s5zfvsw5kv.3).

The augmented copies are skipped on purpose: they are transforms of the same
photos, so mixing them into a train/test split would leak test images into
training and inflate the measured accuracy.
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

OUT = os.path.join(os.path.dirname(__file__), "data", "raw")
files = [f for f in json.load(open(os.path.join(os.path.dirname(__file__), "files.json"))) if f["path"].startswith("Date Fruit/")]
print(len(files), "original images to fetch")


def fetch(f):
    rel = f["path"].split("/", 1)[1]  # Variety/Size/Grade
    dest = os.path.join(OUT, rel, f["name"])
    if os.path.exists(dest) and os.path.getsize(dest) == f["size"]:
        return "skip"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(4):
        try:
            req = urllib.request.Request(f["url"], headers={"User-Agent": "curl/8.9.1"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if f["size"] and len(data) != f["size"]:
                raise IOError(f"size mismatch {len(data)} != {f['size']}")
            with open(dest, "wb") as fh:
                fh.write(data)
            return "ok"
        except Exception as e:  # retry transient network errors
            err = e
    return f"fail {dest}: {err}"


done = 0
fails = []
with ThreadPoolExecutor(max_workers=16) as pool:
    for fut in as_completed([pool.submit(fetch, f) for f in files]):
        res = fut.result()
        done += 1
        if res.startswith("fail"):
            fails.append(res)
        if done % 200 == 0:
            print(done, "done", flush=True)

print("finished", done, "failures", len(fails))
for f in fails[:20]:
    print(f)
sys.exit(1 if fails else 0)
