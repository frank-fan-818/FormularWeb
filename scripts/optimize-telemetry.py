"""Optimize R-telemetry.json files:
1. Convert samples from object-array to columnar format
2. Remove telemetrySummary (already in R.json)
3. Preserve distanceM + speedKph in positionSamples because they are aligned
   with the independently sampled position coordinates

Usage: python scripts/optimize-telemetry.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

TELEMETRY_SAMPLE_KEYS = [
    "distanceM", "timeSeconds", "speedKph", "rpm",
    "gear", "throttlePct", "brake", "drs",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Optimize R-telemetry.json files")
    parser.add_argument("--base", default="public/fastf1", help="Root directory")
    parser.add_argument("--dry-run", action="store_true", help="Print stats only")
    parser.add_argument("--season", default="", help="Single season to process")
    return parser.parse_args()


def is_object_array(data: dict | list) -> bool:
    """Check if samples are old object-array format."""
    return isinstance(data, list)


def to_columnar(samples: list[dict]) -> dict[str, list]:
    """Convert [{k:v,...}, ...] to {k:[v,...], ...}"""
    result: dict[str, list] = {key: [] for key in TELEMETRY_SAMPLE_KEYS}
    for obj in samples:
        for key in TELEMETRY_SAMPLE_KEYS:
            result[key].append(obj.get(key))
    return result


def optimize_driver(driver: dict) -> tuple[int, int]:
    """Optimize one driver's telemetry data. Returns (samples_saved, pos_saved)."""
    saved = 0

    # #5: Convert samples to columnar
    if is_object_array(driver.get("samples", [])):
        old_size = len(json.dumps(driver["samples"], ensure_ascii=False))
        driver["samples"] = to_columnar(driver["samples"])
        new_size = len(json.dumps(driver["samples"], ensure_ascii=False))
        saved += old_size - new_size

    # #3: Keep position distance/speed aligned with X/Y while converting old
    # object-array payloads to the columnar representation.
    if is_object_array(driver.get("positionSamples", [])):
        old_pos = driver["positionSamples"]
        ps_keys = set()
        for obj in old_pos:
            ps_keys.update(obj.keys())
        col_pos = {key: [obj.get(key) for obj in old_pos] for key in ps_keys}
        driver["positionSamples"] = col_pos

    return saved, 0


def optimize_file(tel_path: Path, dry_run: bool) -> tuple[int, int]:
    """Returns (bytes_saved, errors)."""
    payload = json.loads(tel_path.read_text(encoding="utf-8"))

    original_size = len(json.dumps(payload, ensure_ascii=False))
    saved = 0

    # #1: Remove telemetrySummary (already in R.json)
    if "telemetrySummary" in payload:
        saved += len(json.dumps(payload["telemetrySummary"], ensure_ascii=False))
        del payload["telemetrySummary"]

    # #5 + #3: Optimize each driver
    for driver in payload.get("telemetry", {}).get("drivers", []):
        s, _ = optimize_driver(driver)
        saved += s

    if dry_run:
        return saved, 0

    tel_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    new_size = len(json.dumps(payload, ensure_ascii=False))
    return saved, 0


def main() -> None:
    args = parse_args()
    base = Path(args.base)

    pattern = f"{args.season}/**/R-telemetry.json" if args.season else "**/R-telemetry.json"
    files = sorted(base.glob(pattern))
    print(f"Found {len(files)} R-telemetry.json files")

    total_saved = 0
    total_original = 0
    optimized = 0
    skipped = 0

    for f in files:
        payload = json.loads(f.read_text(encoding="utf-8"))
        orig_kb = f.stat().st_size // 1024

        needs_fix = (
            "telemetrySummary" in payload
            or any(
                is_object_array(d.get("samples", {}))
                for d in payload.get("telemetry", {}).get("drivers", [])
            )
        )

        if not needs_fix:
            skipped += 1
            continue

        saved, _ = optimize_file(f, args.dry_run)
        new_kb = f.stat().st_size // 1024 if not args.dry_run else orig_kb - saved // 1024

        total_saved += saved
        total_original += orig_kb * 1024
        optimized += 1

        if saved > 1024:
            print(f"  {f.relative_to(base)}: {orig_kb}KB -> {new_kb}KB (saved {saved//1024}KB)")
        else:
            print(f"  {f.relative_to(base)}: {orig_kb}KB -> {new_kb}KB (saved {saved}B)")

    print()
    print(f"Optimized: {optimized}, skipped: {skipped}")
    print(f"Total saved: {total_saved//1024} KB ({total_saved/1024/1024:.1f} MB)")
    if total_original:
        print(f"Reduction: {total_saved/total_original*100:.1f}%")

    if args.dry_run:
        print("Run without --dry-run to apply.")


if __name__ == "__main__":
    main()
