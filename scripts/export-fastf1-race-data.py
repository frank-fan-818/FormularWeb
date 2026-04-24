"""Export a small FastF1 race analytics JSON for the web app.

Example:
  python scripts/export-fastf1-race-data.py --season 2025 --round 19
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fastf1
import pandas as pd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export FastF1 lap pace and tyre strategy data."
    )
    parser.add_argument("--season", required=True, help="Championship year")
    parser.add_argument("--round", required=True, help="Race round number")
    parser.add_argument(
        "--session",
        default="R",
        help="FastF1 session identifier, defaults to R",
    )
    parser.add_argument(
        "--cache",
        default="f1_cache",
        help="FastF1 cache directory, defaults to f1_cache",
    )
    parser.add_argument(
        "--output",
        default="public/fastf1",
        help="Output root served by Vite, defaults to public/fastf1",
    )
    return parser.parse_args()


def to_seconds(value: Any) -> float | None:
    if pd.isna(value):
        return None

    if hasattr(value, "total_seconds"):
        return round(float(value.total_seconds()), 3)

    return None


def to_number(value: Any) -> int | None:
    if pd.isna(value):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def clean_text(value: Any) -> str:
    if pd.isna(value):
        return ""

    return str(value)


def sort_by_driver_order(
    items: list[dict[str, Any]],
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    return sorted(
        items,
        key=lambda item: (driver_order.get(item["driver"], len(driver_order)), item["driver"]),
    )


def build_driver_order(results: pd.DataFrame, laps: pd.DataFrame) -> dict[str, int]:
    ordered_drivers: list[str] = []

    if not results.empty and {"Abbreviation", "Position"}.issubset(results.columns):
        classified = results.dropna(subset=["Position"]).sort_values("Position")
        ordered_drivers = [
            clean_text(driver)
            for driver in classified["Abbreviation"].tolist()
            if clean_text(driver)
        ]

    lap_drivers = [clean_text(driver) for driver in laps["Driver"].dropna().unique()]
    for driver in lap_drivers:
        if driver and driver not in ordered_drivers:
            ordered_drivers.append(driver)

    return {driver: index for index, driver in enumerate(ordered_drivers)}


def build_lap_time_series(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    series: list[dict[str, Any]] = []

    for driver, driver_laps in laps.groupby("Driver", sort=False):
        points = []
        team = ""

        for _, lap in driver_laps.sort_values("LapNumber").iterrows():
            lap_time = to_seconds(lap.get("LapTime"))
            lap_number = to_number(lap.get("LapNumber"))

            if lap_time is None or lap_number is None:
                continue

            team = team or clean_text(lap.get("Team"))
            points.append({
                "lapNumber": lap_number,
                "lapTimeSeconds": lap_time,
                "compound": clean_text(lap.get("Compound")) or "UNKNOWN",
                "stint": to_number(lap.get("Stint")) or 0,
                "position": to_number(lap.get("Position")),
            })

        if points:
            series.append({
                "driver": clean_text(driver),
                "team": team,
                "racePosition": driver_order.get(clean_text(driver), 0) + 1,
                "laps": points,
            })

    return sort_by_driver_order(series, driver_order)


def build_tyre_strategies(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    strategies: list[dict[str, Any]] = []

    for driver, driver_laps in laps.groupby("Driver", sort=False):
        stints = []
        team = clean_text(driver_laps["Team"].dropna().iloc[0]) \
            if "Team" in driver_laps and not driver_laps["Team"].dropna().empty \
            else ""

        grouped = driver_laps.dropna(subset=["LapNumber"]).groupby(
            ["Stint", "Compound"],
            sort=True,
        )

        for (stint_number, compound), stint_laps in grouped:
            lap_numbers = [
                value for value in (
                    to_number(item) for item in stint_laps["LapNumber"].tolist()
                )
                if value is not None
            ]

            if not lap_numbers:
                continue

            stints.append({
                "stint": to_number(stint_number) or len(stints) + 1,
                "compound": clean_text(compound) or "UNKNOWN",
                "startLap": min(lap_numbers),
                "endLap": max(lap_numbers),
                "lapCount": len(lap_numbers),
            })

        if stints:
            strategies.append({
                "driver": clean_text(driver),
                "team": team,
                "racePosition": driver_order.get(clean_text(driver), 0) + 1,
                "stints": sorted(stints, key=lambda item: item["stint"]),
            })

    return sort_by_driver_order(strategies, driver_order)


def build_fastest_lap(laps: pd.DataFrame) -> dict[str, Any] | None:
    timed_laps = laps.dropna(subset=["LapTime", "LapNumber"])
    if timed_laps.empty:
        return None

    lap = timed_laps.sort_values("LapTime").iloc[0]
    lap_time_seconds = to_seconds(lap.get("LapTime"))
    lap_number = to_number(lap.get("LapNumber"))
    if lap_time_seconds is None or lap_number is None:
        return None

    return {
        "driver": clean_text(lap.get("Driver")),
        "team": clean_text(lap.get("Team")),
        "lapNumber": lap_number,
        "lapTimeSeconds": lap_time_seconds,
        "compound": clean_text(lap.get("Compound")) or "UNKNOWN",
        "position": to_number(lap.get("Position")),
    }


def time_to_seconds(value: Any) -> float | None:
    if pd.isna(value):
        return None

    if hasattr(value, "total_seconds"):
        return round(float(value.total_seconds()), 3)

    return None


def status_type(status: str) -> tuple[str, str, str] | None:
    mapping = {
        "2": ("YELLOW", "Yellow", "Yellow"),
        "4": ("SC", "SC", "Safety Car"),
        "5": ("RED", "Red Flag", "Red Flag"),
        "6": ("VSC", "VSC", "Virtual Safety Car"),
        "7": ("VSC", "VSC", "Virtual Safety Car Ending"),
    }
    return mapping.get(status)


def build_lap_windows(laps: pd.DataFrame) -> list[dict[str, float | int]]:
    lap_windows = []
    timed_laps = laps.dropna(subset=["LapNumber", "LapStartTime", "Time"])

    for lap_number, lap_group in timed_laps.groupby("LapNumber", sort=True):
        number = to_number(lap_number)
        if number is None:
            continue

        starts = [
            time_to_seconds(value)
            for value in lap_group["LapStartTime"].tolist()
        ]
        ends = [time_to_seconds(value) for value in lap_group["Time"].tolist()]
        valid_starts = [value for value in starts if value is not None]
        valid_ends = [value for value in ends if value is not None]

        if not valid_starts or not valid_ends:
            continue

        lap_windows.append({
            "lapNumber": number,
            "start": min(valid_starts),
            "end": max(valid_ends),
        })

    return lap_windows


def period_laps(
    lap_windows: list[dict[str, float | int]],
    start_time: float,
    end_time: float,
) -> tuple[int | None, int | None]:
    overlapping = [
        window["lapNumber"]
        for window in lap_windows
        if float(window["end"]) >= start_time and float(window["start"]) <= end_time
    ]

    if not overlapping:
        return None, None

    return int(min(overlapping)), int(max(overlapping))


def build_track_status_periods(
    track_status: pd.DataFrame,
    laps: pd.DataFrame,
) -> list[dict[str, Any]]:
    if track_status.empty:
        return []

    lap_windows = build_lap_windows(laps)
    session_end = max((float(window["end"]) for window in lap_windows), default=0.0)
    periods: list[dict[str, Any]] = []
    active: dict[str, Any] | None = None

    for _, row in track_status.sort_values("Time").iterrows():
        start_time = time_to_seconds(row.get("Time"))
        if start_time is None:
            continue

        status = clean_text(row.get("Status"))
        mapped_status = status_type(status)

        if mapped_status is None:
            if active:
                start_lap, end_lap = period_laps(
                    lap_windows,
                    active["startTimeSeconds"],
                    start_time,
                )
                if start_lap is not None and end_lap is not None:
                    periods.append({
                        **active,
                        "endTimeSeconds": start_time,
                        "startLap": start_lap,
                        "endLap": end_lap,
                    })
                active = None
            continue

        kind, label, message = mapped_status
        if active and active["type"] == kind:
            active["message"] = message
            active["rawStatus"] = status
            continue

        if active:
            start_lap, end_lap = period_laps(
                lap_windows,
                active["startTimeSeconds"],
                start_time,
            )
            if start_lap is not None and end_lap is not None:
                periods.append({
                    **active,
                    "endTimeSeconds": start_time,
                    "startLap": start_lap,
                    "endLap": end_lap,
                })

        active = {
            "type": kind,
            "label": label,
            "message": message,
            "rawStatus": status,
            "startTimeSeconds": start_time,
        }

    if active:
        start_lap, end_lap = period_laps(
            lap_windows,
            active["startTimeSeconds"],
            session_end,
        )
        if start_lap is not None and end_lap is not None:
            periods.append({
                **active,
                "endTimeSeconds": session_end,
                "startLap": start_lap,
                "endLap": end_lap,
            })

    return periods


def build_race_control_messages(messages: pd.DataFrame) -> list[dict[str, Any]]:
    if messages.empty:
        return []

    interesting = messages[
        messages["Category"].isin(["Flag", "SafetyCar"])
    ].sort_values("Time")

    records = []
    for _, message in interesting.iterrows():
        records.append({
            "time": clean_text(message.get("Time")),
            "category": clean_text(message.get("Category")),
            "message": clean_text(message.get("Message")),
            "status": clean_text(message.get("Status")),
            "flag": clean_text(message.get("Flag")),
            "scope": clean_text(message.get("Scope")),
            "sector": to_number(message.get("Sector")),
            "lap": to_number(message.get("Lap")),
        })

    return records


def main() -> None:
    args = parse_args()
    cache_dir = Path(args.cache)
    output_root = Path(args.output)

    if cache_dir.exists():
        fastf1.Cache.enable_cache(str(cache_dir))

    session = fastf1.get_session(int(args.season), int(args.round), args.session)
    session.load(laps=True, telemetry=False, weather=False, messages=True)

    laps = session.laps
    if laps.empty:
        raise RuntimeError("FastF1 returned no laps for this session.")

    driver_order = build_driver_order(session.results, laps)

    payload = {
        "source": "fastf1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "season": str(args.season),
        "round": str(args.round),
        "session": str(args.session),
        "eventName": clean_text(session.event.get("EventName")),
        "sessionName": clean_text(getattr(session, "name", args.session)),
        "totalLaps": int(laps["LapNumber"].dropna().max()),
        "fastestLap": build_fastest_lap(laps),
        "trackStatusPeriods": build_track_status_periods(session.track_status, laps),
        "raceControlMessages": build_race_control_messages(session.race_control_messages),
        "lapTimeSeries": build_lap_time_series(laps, driver_order),
        "tyreStrategies": build_tyre_strategies(laps, driver_order),
    }

    output_path = output_root / str(args.season) / str(args.round) / f"{args.session}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
