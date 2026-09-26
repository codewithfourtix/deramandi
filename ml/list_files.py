"""List the Mendeley date-grading dataset's folders and files (metadata only)."""
import json
import urllib.request

BASE = "https://data.mendeley.com/public-api/datasets/s5zfvsw5kv"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.9.1", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


folders = get(f"{BASE}/folders/3")
by_id = {f["id"]: f for f in folders}


def path(f):
    parts = [f["name"]]
    while f.get("parent_id") in by_id:
        f = by_id[f["parent_id"]]
        parts.append(f["name"])
    return "/".join(reversed(parts))


leaf = [f for f in folders if not any(g.get("parent_id") == f["id"] for g in folders)]
print(len(folders), "folders,", len(leaf), "leaf folders")
out = []
for f in sorted(leaf, key=path):
    files = get(f"{BASE}/files?folder_id={f['id']}&version=3")
    size = sum(x.get("size", 0) for x in files)
    print(f"{path(f):45s} {len(files):5d} files {size / 1e6:8.1f} MB")
    for x in files:
        out.append({"path": path(f), "name": x["filename"], "size": x.get("size"), "url": x.get("content_details", {}).get("download_url"), "id": x["id"]})

json.dump(out, open("files.json", "w"), indent=1)
print("sample:", json.dumps(out[0], indent=1) if out else None)
