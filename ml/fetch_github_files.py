"""Fetch every image in a GitHub repo tree (from the git/trees API JSON) in
parallel via raw.githubusercontent.com, keeping the folder layout.
Used for The77Lab/SugarcaneDeepLearning (good vs damaged billets).

usage: python fetch_github_files.py <tree.json> <owner/repo> <branch> <out-dir>
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

tree_path, repo, branch, out = sys.argv[1:5]
blobs = [t for t in json.load(open(tree_path))["tree"] if t["type"] == "blob" and t["path"].lower().endswith((".png", ".jpg", ".jpeg", ".bmp"))]


def fetch(t):
    dest = os.path.join(out, t["path"])
    if os.path.exists(dest) and os.path.getsize(dest) == t.get("size", -1):
        return "skip"
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/" + urllib.parse.quote(t["path"])
    for _ in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "DeraMandi/1.0"}), timeout=120) as r:
                data = r.read()
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as fh:
                fh.write(data)
            return "ok"
        except Exception as e:
            err = e
    return f"fail {t['path']}: {err}"


done, fails = 0, []
with ThreadPoolExecutor(24) as pool:
    for res in pool.map(fetch, blobs):
        done += 1
        if res.startswith("fail"):
            fails.append(res)
        if done % 250 == 0:
            print(f"{done}/{len(blobs)}", flush=True)
print("done", done, "failures", len(fails), flush=True)
for f in fails[:10]:
    print(f)
