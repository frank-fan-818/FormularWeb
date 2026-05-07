"""Export FastF1 analytics for every available race in a season.

This is a thin batch wrapper around scripts/export-fastf1-race-data.py. It uses
the same export path that produced public/fastf1/2025/19/*.json, then repeats it
for every race/session FastF1 exposes for the selected season.

Examples:
  python scripts/export-fastf1-season-data.py --season 2025
  python scripts/export-fastf1-season-data.py --season 2025 --session R --session Q
  python scripts/export-fastf1-season-data.py --season 2025 --force
  python scripts/export-fastf1-season-data.py --season 2025 --dry-run
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fastf1
import pandas as pd


DEFAULT_SESSIONS = ["R", "Q", "SQ", "SS", "S"]
VALID_SESSIONS = {"R", "Q", "SQ", "SS", "S"}


@dataclass
class ExportResult:
    season: int
    round: int
    session: str
    status: str
    output: str
    message: str


@dataclass
class ManifestSession:
    session: str
    path: str
    exists: bool
    bytes: int
    eventName: str
    sessionName: str
    sessionResults: int
    lapTimeSeries: int
    tyreStrategies: int
    weatherPoints: int
    telemetryDrivers: int
    qualifyingBestLaps: int
    complete: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch export FastF1 analytics for all available race weekends.",
    )
    parser.add_argument("--season", type=int, required=True, help="Championship year")
    parser.add_argument(
        "--session",
        action="append",
        choices=sorted(VALID_SESSIONS),
        help="Session to export. Repeat to select multiple sessions. Defaults to R/Q plus detected sprint sessions.",
    )
    parser.add_argument("--from-round", type=int, default=1, help="First round to export")
    parser.add_argument("--to-round", type=int, default=0, help="Last round to export; defaults to the season schedule")
    parser.add_argument("--cache", default="f1_cache", help="FastF1 cache directory")
    parser.add_argument("--output", default="public/fastf1", help="Output root served by Vite")
    parser.add_argument(
        "--telemetry-driver-count",
        type=int,
        default=0,
        help="Number of fastest drivers to export for race telemetry. Use 0 for all drivers.",
    )
    parser.add_argument(
        "--telemetry-samples",
        type=int,
        default=650,
        help="Maximum telemetry samples per driver after downsampling.",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing JSON files")
    parser.add_argument("--dry-run", action="store_true", help="Print planned exports without writing files")
    return parser.parse_args()


def clean_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value)


def console_text(value: Any) -> str:
    text = clean_text(value)
    return text.encode("ascii", errors="backslashreplace").decode("ascii")


def normalize_session_name(value: Any) -> str:
    return clean_text(value).strip().lower()


def session_codes_for_event(event: pd.Series, requested_sessions: list[str] | None) -> list[str]:
    if requested_sessions:
        return requested_sessions

    sessions = ["R", "Q"]
    session_names = [
        normalize_session_name(event.get(f"Session{index}"))
        for index in range(1, 6)
    ]

    if any(name == "sprint" for name in session_names):
        sessions.append("S")

    if any(name == "sprint qualifying" for name in session_names):
        sessions.append("SQ")

    if any(name == "sprint shootout" for name in session_names):
        sessions.append("SS")

    return sessions


def load_schedule(season: int) -> pd.DataFrame:
    schedule = fastf1.get_event_schedule(season, include_testing=False)
    if schedule.empty or "RoundNumber" not in schedule.columns:
        raise RuntimeError(f"FastF1 returned no race schedule for {season}.")

    return schedule[schedule["RoundNumber"].fillna(0).astype(int) > 0].copy()


def output_path(output_root: Path, season: int, round_number: int, session: str) -> Path:
    return output_root / str(season) / str(round_number) / f"{session}.json"


def build_export_command(args: argparse.Namespace, round_number: int, session: str) -> list[str]:
    command = [
        sys.executable,
        "scripts/export-fastf1-race-data.py",
        "--season",
        str(args.season),
        "--round",
        str(round_number),
        "--session",
        session,
        "--cache",
        args.cache,
        "--output",
        args.output,
        "--telemetry-samples",
        str(max(0, args.telemetry_samples)),
    ]

    if session == "R":
        command.extend(["--telemetry-driver-count", str(max(0, args.telemetry_driver_count))])
    else:
        command.append("--laps-only")

    return command


def run_export(args: argparse.Namespace, round_number: int, session: str) -> ExportResult:
    path = output_path(Path(args.output), args.season, round_number, session)
    if path.exists() and not args.force:
        return ExportResult(args.season, round_number, session, "skipped", str(path), "already exists")

    command = build_export_command(args, round_number, session)
    if args.dry_run:
        return ExportResult(args.season, round_number, session, "planned", str(path), " ".join(command))

    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if completed.returncode == 0:
        return ExportResult(args.season, round_number, session, "exported", str(path), completed.stdout.strip())

    message = completed.stderr.strip() or completed.stdout.strip() or f"exit code {completed.returncode}"
    return ExportResult(args.season, round_number, session, "failed", str(path), message)


def write_report(results: list[ExportResult], output_root: Path, season: int) -> Path:
    report_path = output_root / str(season) / "export-report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "summary": {
            "planned": sum(1 for result in results if result.status == "planned"),
            "exported": sum(1 for result in results if result.status == "exported"),
            "skipped": sum(1 for result in results if result.status == "skipped"),
            "failed": sum(1 for result in results if result.status == "failed"),
        },
        "results": [asdict(result) for result in results],
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report_path


def list_count(value: Any) -> int:
    return len(value) if isinstance(value, list) else 0


def nested_list_count(value: Any, key: str) -> int:
    if not isinstance(value, dict):
        return 0

    return list_count(value.get(key))


def read_payload(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def build_manifest_session(
    output_root: Path,
    season: int,
    round_number: int,
    session: str,
) -> ManifestSession:
    path = output_path(output_root, season, round_number, session)
    payload = read_payload(path) if path.exists() else {}
    weather_points = nested_list_count(payload.get("weather"), "points")
    telemetry_drivers = nested_list_count(payload.get("telemetry"), "drivers")
    qualifying_best_laps = nested_list_count(payload.get("qualifyingAnalysis"), "bestLaps")
    session_results = list_count(payload.get("sessionResults"))
    lap_time_series = list_count(payload.get("lapTimeSeries"))
    tyre_strategies = list_count(payload.get("tyreStrategies"))

    common_complete = session_results > 0 and lap_time_series > 0 and tyre_strategies > 0
    race_complete = session != "R" or (weather_points > 0 and telemetry_drivers > 0)
    qualifying_complete = session not in {"Q", "SQ", "SS"} or qualifying_best_laps > 0

    return ManifestSession(
        session=session,
        path=str(path),
        exists=path.exists(),
        bytes=path.stat().st_size if path.exists() else 0,
        eventName=clean_text(payload.get("eventName")),
        sessionName=clean_text(payload.get("sessionName")),
        sessionResults=session_results,
        lapTimeSeries=lap_time_series,
        tyreStrategies=tyre_strategies,
        weatherPoints=weather_points,
        telemetryDrivers=telemetry_drivers,
        qualifyingBestLaps=qualifying_best_laps,
        complete=bool(path.exists() and common_complete and race_complete and qualifying_complete),
    )


def write_manifest(
    schedule: pd.DataFrame,
    output_root: Path,
    season: int,
    requested_sessions: list[str] | None,
    from_round: int,
    to_round: int,
) -> Path:
    manifest_path = output_root / str(season) / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    rounds = []

    for _, event in schedule.sort_values("RoundNumber").iterrows():
        round_number = int(event["RoundNumber"])
        if round_number < from_round or round_number > to_round:
            continue

        sessions = [
            build_manifest_session(output_root, season, round_number, session)
            for session in session_codes_for_event(event, requested_sessions)
        ]
        rounds.append({
            "round": round_number,
            "eventName": clean_text(event.get("EventName")),
            "country": clean_text(event.get("Country")),
            "sessions": [asdict(session) for session in sessions],
            "complete": all(session.complete for session in sessions),
        })

    all_sessions = [
        session
        for round_item in rounds
        for session in round_item["sessions"]
    ]
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "summary": {
            "rounds": len(rounds),
            "sessions": len(all_sessions),
            "completeRounds": sum(1 for round_item in rounds if round_item["complete"]),
            "completeSessions": sum(1 for session in all_sessions if session["complete"]),
            "missingSessions": sum(1 for session in all_sessions if not session["exists"]),
            "bytes": sum(session["bytes"] for session in all_sessions),
        },
        "rounds": rounds,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def main() -> None:
    args = parse_args()
    Path(args.cache).mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(args.cache)

    requested_sessions = list(dict.fromkeys(args.session or [])) or None
    schedule = load_schedule(args.season)
    max_round = args.to_round or int(schedule["RoundNumber"].max())
    output_root = Path(args.output)
    results: list[ExportResult] = []

    for _, event in schedule.sort_values("RoundNumber").iterrows():
        round_number = int(event["RoundNumber"])
        if round_number < args.from_round or round_number > max_round:
            continue

        event_name = clean_text(event.get("EventName")) or f"Round {round_number}"
        sessions = session_codes_for_event(event, requested_sessions)
        print(f"{args.season} round {round_number}: {console_text(event_name)} -> {', '.join(sessions)}")

        for session in sessions:
            result = run_export(args, round_number, session)
            results.append(result)
            first_line = result.message.splitlines()[0] if result.message else "-"
            print(f"  {session}: {result.status} ({console_text(first_line)})")

    report_path = write_report(results, output_root, args.season)
    manifest_path = write_manifest(
        schedule,
        output_root,
        args.season,
        requested_sessions,
        args.from_round,
        max_round,
    )
    failed = [result for result in results if result.status == "failed"]
    print(f"Wrote report {report_path}")
    print(f"Wrote manifest {manifest_path}")
    print(
        f"Summary: exported={sum(1 for result in results if result.status == 'exported')}, "
        f"skipped={sum(1 for result in results if result.status == 'skipped')}, "
        f"planned={sum(1 for result in results if result.status == 'planned')}, "
        f"failed={len(failed)}"
    )

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
