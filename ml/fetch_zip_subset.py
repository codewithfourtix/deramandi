"""Download a subset of files from a huge remote ZIP using HTTP range requests,
without fetching the whole archive. Used for GrainSet wheat (20.96 GB,
Figshare 22992317, CC BY 4.0): read the ZIP's central directory, pick N files
per class, and fetch just those members in parallel.

Figshare's download link redirects to a short-lived signed S3 URL, so every
request re-resolves the redirect.

usage: python fetch_zip_subset.py <download-url> <out-dir> [per_class] [pattern]
"""
import io
import os
import random
import struct
import sys
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor

UA = {"User-Agent": "DeraMandi/1.0 (+https://deramandi.vercel.app)"}


def ranged(url, start, end, tries=6):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={start}-{end}"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if len(data) != end - start + 1:
                raise IOError(f"short read {len(data)} != {end - start + 1}")
            return data
        except Exception as e:  # retry on network hiccups
            last = e
    raise last


def total_size(url):
    req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers["Content-Range"].split("/")[1])


def parallel_range(url, start, end, part=2 * 1024 * 1024, workers=16):
    chunks = [(s, min(end, s + part - 1)) for s in range(start, end + 1, part)]
    with ThreadPoolExecutor(workers) as pool:
        return b"".join(pool.map(lambda c: ranged(url, *c), chunks))


def central_directory(url):
    size = total_size(url)
    tail = ranged(url, max(0, size - 65536 - 22), size - 1)
    i = tail.rfind(b"PK\x05\x06")
    cd_size, cd_off = struct.unpack("<II", tail[i + 12 : i + 20])
    if cd_off == 0xFFFFFFFF or cd_size == 0xFFFFFFFF:  # ZIP64
        j = tail.rfind(b"PK\x06\x07")
        (z64_off,) = struct.unpack("<Q", tail[j + 8 : j + 16])
        rec = ranged(url, z64_off, z64_off + 55)
        cd_size, cd_off = struct.unpack("<QQ", rec[40:56])
    print(f"archive {size / 1e9:.2f} GB, central directory {cd_size / 1e6:.1f} MB", flush=True)
    cd = parallel_range(url, cd_off, cd_off + cd_size - 1)
    entries, p = [], 0
    while p < len(cd) and cd[p : p + 4] == b"PK\x01\x02":
        method, = struct.unpack("<H", cd[p + 10 : p + 12])
        csize, usize = struct.unpack("<II", cd[p + 20 : p + 28])
        nlen, elen, clen = struct.unpack("<HHH", cd[p + 28 : p + 34])
        off, = struct.unpack("<I", cd[p + 42 : p + 46])
        name = cd[p + 46 : p + 46 + nlen].decode("utf-8", "replace")
        extra = cd[p + 46 + nlen : p + 46 + nlen + elen]
        # ZIP64 extra field
        q = 0
        while q + 4 <= len(extra):
            hid, hlen = struct.unpack("<HH", extra[q : q + 4])
            if hid == 1:
                vals = extra[q + 4 : q + 4 + hlen]
                k = 0
                if usize == 0xFFFFFFFF:
                    usize, = struct.unpack("<Q", vals[k : k + 8]); k += 8
                if csize == 0xFFFFFFFF:
                    csize, = struct.unpack("<Q", vals[k : k + 8]); k += 8
                if off == 0xFFFFFFFF:
                    off, = struct.unpack("<Q", vals[k : k + 8]); k += 8
            q += 4 + hlen
        entries.append({"name": name, "method": method, "csize": csize, "offset": off})
        p += 46 + nlen + elen + clen
    return entries


def extract(url, e, out_dir):
    dest = os.path.join(out_dir, e["name"])
    if os.path.exists(dest):
        return "skip"
    head = ranged(url, e["offset"], e["offset"] + 29)
    nlen, elen = struct.unpack("<HH", head[26:30])
    start = e["offset"] + 30 + nlen + elen
    data = ranged(url, start, start + e["csize"] - 1) if e["csize"] else b""
    if e["method"] == 8:
        data = zlib.decompress(data, -15)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as fh:
        fh.write(data)
    return "ok"


def fetch_block(url, block, next_offset, out_dir):
    """Download a run of neighbouring members with one ranged read, then unpack."""
    todo = [e for e in block if not os.path.exists(os.path.join(out_dir, e["name"]))]
    if not todo:
        return 0
    start = block[0]["offset"]
    end = next_offset - 1
    data = parallel_range(url, start, end, part=2 * 1024 * 1024, workers=8)
    n = 0
    for e in block:
        dest = os.path.join(out_dir, e["name"])
        if os.path.exists(dest):
            continue
        p = e["offset"] - start
        nlen, elen = struct.unpack("<HH", data[p + 26 : p + 30])
        body = data[p + 30 + nlen + elen : p + 30 + nlen + elen + e["csize"]]
        if e["method"] == 8:
            body = zlib.decompress(body, -15)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as fh:
            fh.write(body)
        n += 1
    return n


def main():
    import json

    url, out = sys.argv[1], sys.argv[2]
    per_class = int(sys.argv[3]) if len(sys.argv) > 3 else 500
    pattern = sys.argv[4] if len(sys.argv) > 4 else ""
    cache = os.path.join(out, "_central_directory.json")
    if os.path.exists(cache):
        entries = json.load(open(cache))
    else:
        entries = central_directory(url)
        os.makedirs(out, exist_ok=True)
        json.dump(entries, open(cache, "w"))
    entries = [e for e in entries if e["name"].lower().endswith((".png", ".jpg", ".jpeg", ".bmp")) and "mask" not in e["name"].lower() and pattern in e["name"]]
    by_class = {}
    for e in entries:
        parts = e["name"].split("/")
        cls = "/".join(parts[-3:-1]) if len(parts) > 2 else parts[0]  # e.g. train/0_NOR
        by_class.setdefault(cls, []).append(e)
    for k, v in sorted(by_class.items()):
        print(f"  {k}: {len(v)} files", flush=True)
    # Pick runs of neighbouring files spread across each class (a few big
    # ranged reads instead of thousands of tiny ones), then unpack them.
    all_sorted = sorted(json.load(open(cache)), key=lambda e: e["offset"])
    next_of = {all_sorted[i]["offset"]: all_sorted[i + 1]["offset"] for i in range(len(all_sorted) - 1)}
    BLOCK = int(os.environ.get("BLOCK", "50"))
    jobs = []
    for k, v in sorted(by_class.items()):
        v = sorted(v, key=lambda e: e["offset"])
        want = min(per_class, len(v))
        nblocks = max(1, -(-want // BLOCK))
        size = -(-want // nblocks)
        for b in range(nblocks):
            i0 = (len(v) * b) // nblocks
            block = v[i0 : i0 + size]
            if block:
                last = block[-1]
                nxt = next_of.get(last["offset"], last["offset"] + last["csize"] + 30 + 1024)
                jobs.append((block, nxt))
    total = sum(len(b) for b, _ in jobs)
    print(f"downloading {total} files in {len(jobs)} ranged blocks", flush=True)
    done = 0
    with ThreadPoolExecutor(4) as pool:
        for n in pool.map(lambda j: fetch_block(url, j[0], j[1], out), jobs):
            done += n
            print(f"{done}/{total}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
