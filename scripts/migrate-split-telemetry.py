"""Migrate existing R.json files to the split format.

Reads each R.json, extracts the telemetry field into R-telemetry.json,
and removes it from the main R.json. Pure file I/O — no FastF1 needed.

Usage:
  python scripts/migrate-split-telemetry.py           # migrate all
  python scripts/migrate-split-telemetry.py --dry-run # print what would change
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate existing R.json files to split telemetry format."
    )
    parser.add_argument(
        "--base",
        default="public/fastf1",
        help="Root directory containing season/round folders (default: public/fastf1)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without writing files",
    )
    return parser.parse_args()


def migrate_file(json_path: Path, dry_run: bool) -> tuple[bool, str]:
    """Returns (changed, message)."""
    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return False, f"ERROR reading: {exc}"

    if "telemetry" not in payload:
        return False, "already split (no telemetry field)"

    telemetry_data = payload.pop("telemetry")
    # Keep telemetrySummary in the main payload

    telemetry_payload = {
        "source": payload.get("source", "fastf1"),
        "generatedAt": payload.get("generatedAt", ""),
        "season": payload.get("season", ""),
        "round": payload.get("round", ""),
        "session": payload.get("session", "R"),
        "eventName": payload.get("eventName", ""),
        "telemetry": telemetry_data,
        "telemetrySummary": payload.get("telemetrySummary", []),
    }

    telemetry_path = json_path.with_name(f"{json_path.stem}-telemetry.json")

    if dry_run:
        main_size = len(json.dumps(payload, ensure_ascii=False))
        tel_size = len(json.dumps(telemetry_payload, ensure_ascii=False))
        return True, f"main: {main_size//1024} KB, telemetry: {tel_size//1024} KB"

    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    telemetry_path.write_text(
        json.dumps(telemetry_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return True, "split"


def main() -> None:
    args = parse_args()
    base = Path(args.base)

    r_files = sorted(base.rglob("R.json"))
    print(f"Found {len(r_files)} R.json files")

    migrated = 0
    skipped = 0
    errors = 0

    total_saved = 0

    for r_file in r_files:
        changed, message = migrate_file(r_file, args.dry_run)
        relative = r_file.relative_to(base)

        if not changed:
            skipped += 1
            print(f"  SKIP  {relative} — {message}")
        else:
            migrated += 1
            print(f"  MIGR  {relative} — {message}")
            if args.dry_run:
                parts = message.split(", ")
                main_kb = int(parts[0].split(": ")[1].split(" ")[0])
                tel_kb = int(parts[1].split(": ")[1].split(" ")[0])
                original_kb = main_kb + tel_kb
                total_saved += tel_kb

    print()
    print(f"Done: {migrated} migrated, {skipped} skipped, {errors} errors")

    if args.dry_run and migrated > 0:
        print(f"Main files total savings: ~{total_saved // 1024} MB (telemetry moved to separate files)")
        print("Run without --dry-run to apply.")


if __name__ == "__main__":
    main()
