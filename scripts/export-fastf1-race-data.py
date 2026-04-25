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
from fastf1.mvapi import get_circuit_info as get_mv_circuit_info


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
    parser.add_argument(
        "--telemetry-drivers",
        default="",
        help="Comma-separated driver abbreviations for fastest-lap telemetry. Defaults to all drivers.",
    )
    parser.add_argument(
        "--telemetry-driver-count",
        type=int,
        default=0,
        help="Number of fastest drivers to export when --telemetry-drivers is omitted. Use 0 for all drivers.",
    )
    parser.add_argument(
        "--telemetry-samples",
        type=int,
        default=650,
        help="Maximum telemetry samples per driver after downsampling.",
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


def to_float(value: Any) -> float | None:
    if pd.isna(value):
        return None

    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def to_bool(value: Any) -> bool:
    if pd.isna(value):
        return False

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(value)

    return str(value).strip().lower() in {"1", "true", "yes"}


def clean_text(value: Any) -> str:
    if pd.isna(value):
        return ""

    return str(value)


def parse_driver_codes(value: str) -> list[str]:
    return [
        item.strip().upper()
        for item in value.split(",")
        if item.strip()
    ]


def downsample(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    if limit <= 0 or len(items) <= limit:
        return items

    if limit == 1:
        return [items[0]]

    last_index = len(items) - 1
    selected_indexes = {
        round(index * last_index / (limit - 1))
        for index in range(limit)
    }

    return [
        item
        for index, item in enumerate(items)
        if index in selected_indexes
    ]


def session_type(session_code: str) -> str | None:
    mapping = {
        "Q": "QUALIFYING",
        "SQ": "SPRINT_QUALIFYING",
        "SS": "SPRINT_SHOOTOUT",
    }
    return mapping.get(session_code.upper())


def format_session_time(value: Any) -> str:
    seconds = to_seconds(value)
    if seconds is None:
        return ""

    minutes = int(seconds // 60)
    remaining = seconds - minutes * 60
    return f"{minutes}:{remaining:06.3f}"


def safe_session_frame(session: Any, attribute: str) -> pd.DataFrame:
    try:
        value = getattr(session, attribute)
    except Exception:
        return pd.DataFrame()

    return value if isinstance(value, pd.DataFrame) else pd.DataFrame()


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

    lap_drivers = [
        clean_text(driver)
        for driver in laps["Driver"].dropna().unique()
    ] if "Driver" in laps.columns else []
    for driver in lap_drivers:
        if driver and driver not in ordered_drivers:
            ordered_drivers.append(driver)

    return {driver: index for index, driver in enumerate(ordered_drivers)}


def build_lap_time_series(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    if laps.empty or "Driver" not in laps.columns:
        return []

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
    if laps.empty or "Driver" not in laps.columns:
        return []

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
    if laps.empty:
        return None

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


def lap_for_time(
    lap_windows: list[dict[str, float | int]],
    time_seconds: float,
) -> int | None:
    if not lap_windows:
        return None

    first = lap_windows[0]
    if time_seconds <= float(first["start"]):
        return int(first["lapNumber"])

    previous = first
    for window in lap_windows:
        if float(window["start"]) <= time_seconds <= float(window["end"]):
            return int(window["lapNumber"])

        if time_seconds < float(window["start"]):
            return int(previous["lapNumber"])

        previous = window

    return int(lap_windows[-1]["lapNumber"])


def average(values: list[float]) -> float | None:
    if not values:
        return None

    return round(sum(values) / len(values), 2)


def min_max_average(values: list[float]) -> dict[str, float | None]:
    if not values:
        return {"min": None, "max": None, "average": None}

    return {
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "average": average(values),
    }


def build_lap_ranges(lap_numbers: list[int]) -> list[dict[str, int]]:
    unique_laps = sorted(set(lap_numbers))
    if not unique_laps:
        return []

    ranges = []
    start = unique_laps[0]
    previous = unique_laps[0]

    for lap_number in unique_laps[1:]:
        if lap_number == previous + 1:
            previous = lap_number
            continue

        ranges.append({"startLap": start, "endLap": previous})
        start = lap_number
        previous = lap_number

    ranges.append({"startLap": start, "endLap": previous})
    return ranges


def build_weather_analysis(
    weather: pd.DataFrame,
    laps: pd.DataFrame,
) -> dict[str, Any] | None:
    if weather.empty:
        return None

    lap_windows = build_lap_windows(laps)
    points: list[dict[str, Any]] = []
    first_lap_start = float(lap_windows[0]["start"]) if lap_windows else None
    last_lap_end = float(lap_windows[-1]["end"]) if lap_windows else None

    for _, row in weather.sort_values("Time").iterrows():
        time_seconds = time_to_seconds(row.get("Time"))
        if time_seconds is None:
            continue

        if (
            first_lap_start is not None
            and last_lap_end is not None
            and (time_seconds < first_lap_start or time_seconds > last_lap_end)
        ):
            continue

        point = {
            "timeSeconds": time_seconds,
            "lapNumber": lap_for_time(lap_windows, time_seconds),
            "airTempC": to_float(row.get("AirTemp")),
            "trackTempC": to_float(row.get("TrackTemp")),
            "humidityPct": to_float(row.get("Humidity")),
            "pressureHpa": to_float(row.get("Pressure")),
            "rainfall": to_bool(row.get("Rainfall")),
            "windDirectionDeg": to_float(row.get("WindDirection")),
            "windSpeedMps": to_float(row.get("WindSpeed")),
        }

        points.append(point)

    if not points:
        return None

    rain_laps = [
        int(point["lapNumber"])
        for point in points
        if point["rainfall"] and point["lapNumber"] is not None
    ]
    wind_speeds = [
        point["windSpeedMps"]
        for point in points
        if point["windSpeedMps"] is not None
    ]

    return {
        "points": points,
        "summary": {
            "airTempC": min_max_average([
                point["airTempC"]
                for point in points
                if point["airTempC"] is not None
            ]),
            "trackTempC": min_max_average([
                point["trackTempC"]
                for point in points
                if point["trackTempC"] is not None
            ]),
            "humidityPct": min_max_average([
                point["humidityPct"]
                for point in points
                if point["humidityPct"] is not None
            ]),
            "rainPointCount": sum(1 for point in points if point["rainfall"]),
            "rainLapRanges": build_lap_ranges(rain_laps),
            "maxWindSpeedMps": round(max(wind_speeds), 2) if wind_speeds else None,
        },
    }


def is_deleted_lap(lap: pd.Series) -> bool:
    return to_bool(lap.get("Deleted"))


def build_phase_results(
    results: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    if results.empty or "Abbreviation" not in results.columns:
        return []

    phase_columns = [column for column in ["Q1", "Q2", "Q3"] if column in results.columns]
    if not phase_columns:
        return []

    records = []
    for _, result in results.sort_values("Position" if "Position" in results.columns else "Abbreviation").iterrows():
        driver = clean_text(result.get("Abbreviation"))
        if not driver:
            continue

        phases = {
            phase.lower(): {
                "time": format_session_time(result.get(phase)),
                "timeSeconds": to_seconds(result.get(phase)),
            }
            for phase in phase_columns
        }

        records.append({
            "driver": driver,
            "team": clean_text(result.get("TeamName")) or clean_text(result.get("Team")),
            "position": to_number(result.get("Position")) or driver_order.get(driver, 0) + 1,
            "phases": phases,
        })

    return sort_by_driver_order(records, driver_order)


def best_timed_lap(laps: pd.DataFrame, include_deleted: bool = False) -> pd.Series | None:
    timed_laps = laps.dropna(subset=["LapTime"])
    if not include_deleted and "Deleted" in timed_laps.columns:
        timed_laps = timed_laps[~timed_laps.apply(is_deleted_lap, axis=1)]

    if timed_laps.empty:
        return None

    return timed_laps.sort_values("LapTime").iloc[0]


def build_lap_summary(lap: pd.Series | None) -> dict[str, Any] | None:
    if lap is None:
        return None

    lap_time_seconds = to_seconds(lap.get("LapTime"))
    if lap_time_seconds is None:
        return None

    return {
        "driver": clean_text(lap.get("Driver")),
        "team": clean_text(lap.get("Team")),
        "lapNumber": to_number(lap.get("LapNumber")),
        "lapTimeSeconds": lap_time_seconds,
        "sector1Seconds": to_seconds(lap.get("Sector1Time")),
        "sector2Seconds": to_seconds(lap.get("Sector2Time")),
        "sector3Seconds": to_seconds(lap.get("Sector3Time")),
        "compound": clean_text(lap.get("Compound")) or "UNKNOWN",
        "isDeleted": is_deleted_lap(lap),
    }


def build_qualifying_best_laps(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    if laps.empty or "Driver" not in laps.columns:
        return []

    best_laps = []

    for driver, driver_laps in laps.groupby("Driver", sort=False):
        best_lap = best_timed_lap(driver_laps, include_deleted=False)
        if best_lap is None:
            best_lap = best_timed_lap(driver_laps, include_deleted=True)

        summary = build_lap_summary(best_lap)
        if summary is None:
            continue

        summary["driver"] = clean_text(driver)
        summary["position"] = driver_order.get(clean_text(driver), 0) + 1
        best_laps.append(summary)

    return sort_by_driver_order(best_laps, driver_order)


def build_phase_cutoffs(
    results: pd.DataFrame,
    session_code: str,
) -> list[dict[str, Any]]:
    if results.empty or "Abbreviation" not in results.columns:
        return []

    phase_columns = [column for column in ["Q1", "Q2", "Q3"] if column in results.columns]
    if not phase_columns:
        return []

    session_prefix = "SQ" if session_code.upper() in {"SQ", "SS"} else "Q"
    cutoff_positions = {"Q1": 15, "Q2": 10, "Q3": 1}
    cutoffs = []

    for phase in phase_columns:
        phase_rows = []
        for _, result in results.iterrows():
            seconds = to_seconds(result.get(phase))
            if seconds is None:
                continue

            phase_rows.append({
                "driver": clean_text(result.get("Abbreviation")),
                "team": clean_text(result.get("TeamName")) or clean_text(result.get("Team")),
                "time": format_session_time(result.get(phase)),
                "timeSeconds": seconds,
            })

        if not phase_rows:
            continue

        phase_rows = sorted(phase_rows, key=lambda item: item["timeSeconds"])
        cutoff_position = cutoff_positions.get(phase, len(phase_rows))
        cutoff_index = min(max(cutoff_position - 1, 0), len(phase_rows) - 1)
        cutoff_driver = phase_rows[cutoff_index]

        cutoffs.append({
            "phase": phase.lower(),
            "label": f"{session_prefix}{phase[-1]}",
            "cutoffPosition": cutoff_index + 1,
            "cutoffDriver": cutoff_driver["driver"],
            "cutoffTime": cutoff_driver["time"],
            "cutoffTimeSeconds": cutoff_driver["timeSeconds"],
            "eliminatedDrivers": [
                item["driver"]
                for item in phase_rows[cutoff_index + 1:]
            ],
        })

    return cutoffs


def build_last_flying_laps(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    if laps.empty or "Driver" not in laps.columns:
        return []

    records = []
    for driver, driver_laps in laps.groupby("Driver", sort=False):
        timed_laps = driver_laps.dropna(subset=["LapTime", "LapNumber"]).sort_values("LapNumber")
        if timed_laps.empty:
            continue

        summary = build_lap_summary(timed_laps.iloc[-1])
        if summary is None:
            continue

        summary["driver"] = clean_text(driver)
        summary["position"] = driver_order.get(clean_text(driver), 0) + 1
        records.append(summary)

    return sort_by_driver_order(records, driver_order)


def build_deleted_laps(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    if laps.empty or "Driver" not in laps.columns or "Deleted" not in laps.columns:
        return []

    deleted_laps = laps[laps.apply(is_deleted_lap, axis=1)].dropna(subset=["LapNumber"])
    records = []
    for _, lap in deleted_laps.sort_values(["Driver", "LapNumber"]).iterrows():
        records.append({
            "driver": clean_text(lap.get("Driver")),
            "team": clean_text(lap.get("Team")),
            "lapNumber": to_number(lap.get("LapNumber")),
            "lapTimeSeconds": to_seconds(lap.get("LapTime")),
            "reason": clean_text(lap.get("DeletedReason")) or clean_text(lap.get("TrackStatus")),
            "position": driver_order.get(clean_text(lap.get("Driver")), 0) + 1,
        })

    return sort_by_driver_order(records, driver_order)


def best_sector_for_driver(
    driver_laps: pd.DataFrame,
    sector_column: str,
    include_deleted: bool = False,
) -> pd.Series | None:
    sector_laps = driver_laps.dropna(subset=[sector_column])
    if not include_deleted and "Deleted" in sector_laps.columns:
        sector_laps = sector_laps[~sector_laps.apply(is_deleted_lap, axis=1)]

    if sector_laps.empty:
        return None

    return sector_laps.sort_values(sector_column).iloc[0]


def build_sector_rankings(laps: pd.DataFrame) -> list[dict[str, Any]]:
    if laps.empty or "Driver" not in laps.columns:
        return []

    sectors = [
        ("s1", "Sector1Time"),
        ("s2", "Sector2Time"),
        ("s3", "Sector3Time"),
    ]
    rankings = []

    for sector_key, sector_column in sectors:
        if sector_column not in laps.columns:
            continue

        sector_records = []
        for driver, driver_laps in laps.groupby("Driver", sort=False):
            lap = best_sector_for_driver(driver_laps, sector_column, include_deleted=False)
            if lap is None:
                lap = best_sector_for_driver(driver_laps, sector_column, include_deleted=True)

            seconds = to_seconds(lap.get(sector_column)) if lap is not None else None
            if seconds is None:
                continue

            sector_records.append({
                "driver": clean_text(driver),
                "team": clean_text(lap.get("Team")),
                "lapNumber": to_number(lap.get("LapNumber")),
                "timeSeconds": seconds,
                "isDeleted": is_deleted_lap(lap),
            })

        sector_records = sorted(sector_records, key=lambda item: item["timeSeconds"])
        rankings.append({
            "sector": sector_key,
            "laps": [
                {
                    **record,
                    "rank": index + 1,
                    "deltaToBestSeconds": round(record["timeSeconds"] - sector_records[0]["timeSeconds"], 3),
                }
                for index, record in enumerate(sector_records)
            ] if sector_records else [],
        })

    return rankings


def build_teammate_comparisons(
    best_laps: list[dict[str, Any]],
    driver_order: dict[str, int],
) -> list[dict[str, Any]]:
    by_team: dict[str, list[dict[str, Any]]] = {}
    for lap in best_laps:
        by_team.setdefault(lap.get("team") or "UNKNOWN", []).append(lap)

    comparisons = []
    for team, team_laps in by_team.items():
        if len(team_laps) != 2:
            continue

        first, second = sorted(
            team_laps,
            key=lambda item: driver_order.get(item["driver"], len(driver_order)),
        )

        def delta(key: str) -> float | None:
            first_value = first.get(key)
            second_value = second.get(key)
            if first_value is None or second_value is None:
                return None

            return round(float(first_value) - float(second_value), 3)

        comparisons.append({
            "team": team,
            "driverA": first["driver"],
            "driverB": second["driver"],
            "fastestLapDeltaSeconds": delta("lapTimeSeconds"),
            "sector1DeltaSeconds": delta("sector1Seconds"),
            "sector2DeltaSeconds": delta("sector2Seconds"),
            "sector3DeltaSeconds": delta("sector3Seconds"),
        })

    return sorted(comparisons, key=lambda item: item["team"])


def build_qualifying_analysis(
    session_code: str,
    results: pd.DataFrame,
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> dict[str, Any] | None:
    current_session_type = session_type(session_code)
    if current_session_type is None:
        return None

    best_laps = build_qualifying_best_laps(laps, driver_order)

    return {
        "sessionType": current_session_type,
        "phaseResults": build_phase_results(results, driver_order),
        "phaseCutoffs": build_phase_cutoffs(results, session_code),
        "bestLaps": best_laps,
        "lastFlyingLaps": build_last_flying_laps(laps, driver_order),
        "deletedLaps": build_deleted_laps(laps, driver_order),
        "sectorRankings": build_sector_rankings(laps),
        "teamMateComparisons": build_teammate_comparisons(best_laps, driver_order),
    }


def lap_driver_codes_by_fastest_lap(
    laps: pd.DataFrame,
    driver_order: dict[str, int],
) -> list[str]:
    if laps.empty or "Driver" not in laps.columns:
        return []

    drivers = []
    for driver, driver_laps in laps.groupby("Driver", sort=False):
        best_lap = best_timed_lap(driver_laps, include_deleted=False)
        if best_lap is None:
            best_lap = best_timed_lap(driver_laps, include_deleted=True)

        lap_time = to_seconds(best_lap.get("LapTime")) if best_lap is not None else None
        if lap_time is None:
            continue

        drivers.append({
            "driver": clean_text(driver),
            "lapTimeSeconds": lap_time,
            "driverOrder": driver_order.get(clean_text(driver), len(driver_order)),
        })

    return [
        item["driver"]
        for item in sorted(
            drivers,
            key=lambda item: (item["lapTimeSeconds"], item["driverOrder"], item["driver"]),
        )
    ]


def telemetry_time_seconds(value: Any) -> float | None:
    seconds = time_to_seconds(value)
    if seconds is not None:
        return seconds

    return to_float(value)


def telemetry_records(car_data: pd.DataFrame) -> list[dict[str, Any]]:
    if car_data.empty or "Distance" not in car_data.columns:
        return []

    records = []
    for _, row in car_data.sort_values("Distance").iterrows():
        distance = to_float(row.get("Distance"))
        speed = to_float(row.get("Speed"))

        if distance is None or speed is None:
            continue

        records.append({
            "distanceM": distance,
            "timeSeconds": telemetry_time_seconds(row.get("Time")),
            "speedKph": speed,
            "rpm": to_number(row.get("RPM")),
            "gear": to_number(row.get("nGear")),
            "throttlePct": to_float(row.get("Throttle")),
            "brake": to_bool(row.get("Brake")),
            "drs": to_number(row.get("DRS")),
        })

    return records


def position_records(
    position_data: pd.DataFrame,
    car_data: pd.DataFrame,
) -> list[dict[str, Any]]:
    required_columns = {"X", "Y"}
    if position_data.empty or not required_columns.issubset(position_data.columns):
        return []

    car_points = []
    if not car_data.empty and {"Time", "Distance", "Speed"}.issubset(car_data.columns):
        for _, row in car_data.iterrows():
            time_seconds = telemetry_time_seconds(row.get("Time"))
            distance = to_float(row.get("Distance"))
            speed = to_float(row.get("Speed"))
            if time_seconds is None or distance is None:
                continue

            car_points.append({
                "timeSeconds": time_seconds,
                "distanceM": distance,
                "speedKph": speed,
            })

    car_points = sorted(car_points, key=lambda item: item["timeSeconds"])

    def nearest_car_point(time_seconds: float | None) -> dict[str, Any] | None:
        if time_seconds is None or not car_points:
            return None

        return min(
            car_points,
            key=lambda item: abs(item["timeSeconds"] - time_seconds),
        )

    records = []
    for _, row in position_data.iterrows():
        time_seconds = telemetry_time_seconds(row.get("Time"))
        nearest = nearest_car_point(time_seconds)
        distance = nearest["distanceM"] if nearest else None

        if distance is None:
            continue

        records.append({
            "distanceM": distance,
            "x": to_float(row.get("X")),
            "y": to_float(row.get("Y")),
            "z": to_float(row.get("Z")),
            "speedKph": nearest.get("speedKph") if nearest else None,
        })

    return [
        record
        for record in records
        if record["x"] is not None and record["y"] is not None
    ]


def raw_circuit_info(session: Any) -> Any | None:
    try:
        circuit_key = session.session_info["Meeting"]["Circuit"]["Key"]
        if (
            circuit_key == 149
            and session.session_info["Meeting"]["Circuit"]["ShortName"] == "Mugello"
        ):
            circuit_key = 146

        return get_mv_circuit_info(
            year=session.event.year,
            circuit_key=circuit_key,
        )
    except Exception:
        return None


def nearest_position_distance(
    x: float | None,
    y: float | None,
    reference_positions: list[dict[str, Any]],
) -> float | None:
    if x is None or y is None or not reference_positions:
        return None

    nearest = min(
        reference_positions,
        key=lambda position: (
            (float(position["x"]) - x) ** 2
            + (float(position["y"]) - y) ** 2
        ),
    )

    return to_float(nearest.get("distanceM"))


def build_circuit_corners(
    session: Any,
    reference_positions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    try:
        circuit_info = session.get_circuit_info()
    except Exception:
        circuit_info = raw_circuit_info(session)

    corners = getattr(circuit_info, "corners", pd.DataFrame()) if circuit_info else pd.DataFrame()

    if not isinstance(corners, pd.DataFrame) or corners.empty:
        return []

    records = []
    for _, row in corners.iterrows():
        number = to_number(row.get("Number"))
        x = to_float(row.get("X"))
        y = to_float(row.get("Y"))
        distance = to_float(row.get("Distance"))
        if distance is None:
            distance = nearest_position_distance(x, y, reference_positions)

        if number is None or distance is None:
            continue

        letter = clean_text(row.get("Letter"))
        records.append({
            "number": number,
            "letter": letter,
            "label": f"T{number}{letter}",
            "distanceM": distance,
            "x": x,
            "y": y,
            "angleDeg": to_float(row.get("Angle")),
        })

    return records


def nearest_speed_at_distance(
    samples: list[dict[str, Any]],
    target_distance: float,
) -> float | None:
    if not samples:
        return None

    nearest = min(
        samples,
        key=lambda sample: abs(float(sample["distanceM"]) - target_distance),
    )
    return to_float(nearest.get("speedKph"))


def build_corner_analysis(
    corners: list[dict[str, Any]],
    driver_samples: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    if not corners or not driver_samples:
        return []

    analysis = []
    for corner in corners:
        corner_distance = corner["distanceM"]
        drivers = []

        for driver, samples in driver_samples.items():
            window_samples = [
                sample
                for sample in samples
                if abs(float(sample["distanceM"]) - float(corner_distance)) <= 120
            ]
            speeds = [
                sample["speedKph"]
                for sample in window_samples
                if sample.get("speedKph") is not None
            ]

            drivers.append({
                "driver": driver,
                "entrySpeedKph": nearest_speed_at_distance(samples, float(corner_distance) - 80),
                "minSpeedKph": round(min(speeds), 1) if speeds else None,
                "exitSpeedKph": nearest_speed_at_distance(samples, float(corner_distance) + 80),
            })

        analysis.append({
            "corner": corner["label"],
            "number": corner["number"],
            "letter": corner["letter"],
            "distanceM": corner_distance,
            "drivers": drivers,
        })

    return analysis


def build_fastest_lap_telemetry(
    session: Any,
    laps: pd.DataFrame,
    driver_order: dict[str, int],
    telemetry_drivers: list[str],
    driver_count: int,
    sample_limit: int,
) -> dict[str, Any] | None:
    if laps.empty or "Driver" not in laps.columns:
        return None

    fastest_drivers = lap_driver_codes_by_fastest_lap(laps, driver_order)
    selected_drivers = telemetry_drivers or (
        fastest_drivers[:driver_count] if driver_count > 0 else fastest_drivers
    )
    if not selected_drivers:
        return None

    telemetry_driver_records = []
    full_driver_samples: dict[str, list[dict[str, Any]]] = {}
    reference_positions: list[dict[str, Any]] = []

    for driver in selected_drivers:
        try:
            driver_laps = laps.pick_drivers([driver]) if hasattr(laps, "pick_drivers") else laps.pick_driver(driver)
            lap = driver_laps.pick_fastest()
            car_data = lap.get_car_data().add_distance()
            position_data = lap.get_pos_data()
        except Exception:
            continue

        samples = telemetry_records(car_data)
        if not samples:
            continue

        positions = position_records(position_data, car_data)
        if not reference_positions and positions:
            reference_positions = positions

        full_driver_samples[driver] = samples
        telemetry_driver_records.append({
            "driver": driver,
            "team": clean_text(lap.get("Team")),
            "lapNumber": to_number(lap.get("LapNumber")),
            "lapTimeSeconds": to_seconds(lap.get("LapTime")),
            "compound": clean_text(lap.get("Compound")) or "UNKNOWN",
            "samples": downsample(samples, sample_limit),
            "positionSamples": downsample(positions, sample_limit),
        })

    if not telemetry_driver_records:
        return None

    corners = build_circuit_corners(session, reference_positions)

    return {
        "drivers": telemetry_driver_records,
        "corners": corners,
        "cornerAnalysis": build_corner_analysis(corners, full_driver_samples),
    }


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
    session.load(laps=True, telemetry=True, weather=True, messages=True)

    current_session_type = session_type(str(args.session))
    try:
        laps = session.laps
    except Exception:
        if current_session_type is None:
            raise
        laps = pd.DataFrame()

    if laps.empty and current_session_type is None:
        raise RuntimeError("FastF1 returned no laps for this session.")

    results = safe_session_frame(session, "results")
    track_status = safe_session_frame(session, "track_status")
    race_control_messages = safe_session_frame(session, "race_control_messages")
    weather_data = safe_session_frame(session, "weather_data")
    driver_order = build_driver_order(results, laps)

    payload = {
        "source": "fastf1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "season": str(args.season),
        "round": str(args.round),
        "session": str(args.session),
        "eventName": clean_text(session.event.get("EventName")),
        "sessionName": clean_text(getattr(session, "name", args.session)),
        "totalLaps": int(laps["LapNumber"].dropna().max()) if "LapNumber" in laps.columns and not laps.empty else 0,
        "fastestLap": build_fastest_lap(laps),
        "trackStatusPeriods": build_track_status_periods(track_status, laps),
        "raceControlMessages": build_race_control_messages(race_control_messages),
        "lapTimeSeries": build_lap_time_series(laps, driver_order),
        "tyreStrategies": build_tyre_strategies(laps, driver_order),
    }

    weather = build_weather_analysis(
        weather_data,
        laps,
    )
    if weather:
        payload["weather"] = weather

    qualifying_analysis = build_qualifying_analysis(
        str(args.session),
        results,
        laps,
        driver_order,
    )
    if qualifying_analysis:
        payload["qualifyingAnalysis"] = qualifying_analysis

    if str(args.session).upper() == "R":
        telemetry = build_fastest_lap_telemetry(
            session,
            laps,
            driver_order,
            parse_driver_codes(args.telemetry_drivers),
            max(0, args.telemetry_driver_count),
            max(0, args.telemetry_samples),
        )
        if telemetry:
            payload["telemetry"] = telemetry

    output_path = output_root / str(args.season) / str(args.round) / f"{args.session}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
