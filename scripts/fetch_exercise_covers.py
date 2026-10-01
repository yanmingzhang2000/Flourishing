#!/usr/bin/env python3
"""Normalize exercise_assets_manifest.csv and fetch verified cover images.

Usage:
    python scripts/fetch_exercise_covers.py           # normalize + download direct covers
    python scripts/fetch_exercise_covers.py --dry-run # only normalize, no download

What it does:
1. Rewrites video_url that use the invalid `/videos/<slug>/` shape into the
   real Pexels search URL `https://www.pexels.com/search/videos/<slug>/`.
   Rows already pointing at a concrete video page (`/video/...-<id>/`) are kept.
2. Adds two status columns:
   - cover_status: `direct` (images.pexels.com CDN) | `search_page`
   - video_status: `exact` (concrete video page) | `search_page`
3. Downloads every `direct` cover to 素材/images/{exercise_id}_cover.jpg
   (skips files that already exist), verifying the response is a real JPEG.
4. Writes 素材/download_report.md with done / todo lists.
"""

from __future__ import annotations

import argparse
import csv
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "exercise_assets_manifest.csv"
IMAGES_DIR = ROOT / "素材" / "images"
REPORT = ROOT / "素材" / "download_report.md"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) exercise-assets-fetcher"
JPEG_MAGIC = b"\xff\xd8\xff"


def normalize_video_url(video_url: str) -> tuple[str, str]:
    """Return (normalized_url, video_status)."""
    if "pexels.com/video/" in video_url:
        return video_url, "exact"
    if "pexels.com/search/videos/" in video_url:
        return video_url, "search_page"
    if "pexels.com/videos/" in video_url:
        slug = video_url.rstrip("/").split("/videos/")[-1]
        return f"https://www.pexels.com/search/videos/{slug}/", "search_page"
    return video_url, "unknown"


def cover_status(cover_url: str) -> str:
    if cover_url.startswith("https://images.pexels.com/"):
        return "direct"
    return "search_page"


def normalize_manifest() -> list[dict]:
    # The original manifest has an unquoted comma inside `license`
    # ("Pexels免费许可(可商用,无需署名)"), so overflow columns must be merged
    # back into the last field before rewriting the file properly quoted.
    with MANIFEST.open(newline="", encoding="utf-8-sig") as fh:
        raw = list(csv.reader(fh))
    if not raw:
        raise SystemExit(f"empty manifest: {MANIFEST}")
    fieldnames = [c.lstrip("\ufeff") if i == 0 else c for i, c in enumerate(raw[0])]

    rows = []
    for cells in raw[1:]:
        if len(cells) > len(fieldnames):
            cells = cells[: len(fieldnames) - 1] + [
                ",".join(cells[len(fieldnames) - 1 :])
            ]
        elif len(cells) < len(fieldnames):
            cells = cells + [""] * (len(fieldnames) - len(cells))
        rows.append(dict(zip(fieldnames, cells)))

    for col in ("cover_status", "video_status", "cover_qa"):
        if col not in fieldnames:
            fieldnames.append(col)

    for row in rows:
        row["video_url"], row["video_status"] = normalize_video_url(row["video_url"])
        row["cover_status"] = cover_status(row["cover_url"])
        # cover_qa is human-owned: default once, never overwrite an existing verdict.
        row.setdefault("cover_qa", "pending")
        if not row["cover_qa"]:
            row["cover_qa"] = "pending"

    # Render fully in memory first so a mid-write failure can never truncate
    # the manifest again.
    from io import StringIO

    buf = StringIO(newline="")
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    MANIFEST.write_text(buf.getvalue(), encoding="utf-8", newline="")
    return rows


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    if not data.startswith(JPEG_MAGIC):
        raise ValueError(f"not a JPEG ({len(data)} bytes)")
    dest.write_bytes(data)


def fetch_covers(rows: list[dict]) -> tuple[list[str], list[str]]:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    done, failed = [], []
    direct = [r for r in rows if r["cover_status"] == "direct"]
    for i, row in enumerate(direct, 1):
        eid = row["exercise_id"]
        dest = IMAGES_DIR / f"{eid}_cover.jpg"
        if dest.exists() and dest.stat().st_size > 0:
            done.append(f"{eid} (exists)")
            continue
        try:
            download(row["cover_url"], dest)
            kb = dest.stat().st_size / 1024
            if kb > 300:
                failed.append(f"{eid}: {kb:.0f}KB exceeds 300KB budget")
                dest.unlink()
            else:
                done.append(f"{eid} ({kb:.0f}KB)")
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{eid}: {exc}")
        print(f"[{i}/{len(direct)}] {eid}", file=sys.stderr)
    return done, failed


def write_report(rows: list[dict], done: list[str], failed: list[str]) -> None:
    direct = [r for r in rows if r["cover_status"] == "direct"]
    search = [r for r in rows if r["cover_status"] == "search_page"]
    video_exact = [r for r in rows if r["video_status"] == "exact"]
    lines = [
        "# 素材下载报告",
        "",
        f"- 封面直链（可脚本下载）：{len(direct)} / {len(rows)}",
        f"- 封面检索页（需人工挑图）：{len(search)}",
        f"- 视频精确定位页：{len(video_exact)} / {len(rows)}",
        f"- 视频检索页（需人工挑片段）：{len(rows) - len(video_exact)}",
        "",
        "## 已下载封面",
        "",
    ]
    lines += [f"- {d}" for d in done] or ["- （无）"]
    lines += ["", "## 下载失败", ""]
    lines += [f"- {f}" for f in failed] or ["- （无）"]
    lines += [
        "",
        "## 待人工处理：封面检索页",
        "",
    ]
    lines += [
        f"- {r['exercise_id']}: {r['cover_url']}" for r in search
    ] or ["- （无）"]
    lines += [
        "",
        "## 待人工处理：视频",
        "",
        f"- {len(rows) - len(video_exact)} 个动作需在检索页挑选 15-30s 片段，"
        "下载为 素材/videos/{exercise_id}.mp4",
        "- 上线前须替换为自拍或明确 CC0/CC-BY 授权素材（见 docs/ACTION_LIBRARY_SPEC.md）",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="normalize only")
    args = parser.parse_args()

    rows = normalize_manifest()
    print(f"manifest normalized: {len(rows)} rows")

    if args.dry_run:
        return 0

    done, failed = fetch_covers(rows)
    write_report(rows, done, failed)
    print(f"downloaded: {len(done)}  failed: {len(failed)}  report: {REPORT}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
