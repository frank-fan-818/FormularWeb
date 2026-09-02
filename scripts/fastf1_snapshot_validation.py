"""Completeness contract for FastF1 analysis snapshots."""

from __future__ import annotations

from typing import Any

INCOMPLETE_SNAPSHOT_EXIT_CODE = 3


def _items(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _nested_items(payload: dict[str, Any], key: str) -> list[Any]:
    value = payload.get(key)
    return _items(value.get("drivers")) if isinstance(value, dict) else []


def incomplete_snapshot_fields(
    payload: dict[str, Any],
    session: str,
    telemetry_payload: dict[str, Any] | None = None,
) -> list[str]:
    """Return required fields that are empty for a publishable analysis snapshot."""
    session_code = session.upper()
    missing = []

    for field in ("sessionResults", "lapTimeSeries", "tyreStrategies"):
        if not _items(payload.get(field)):
            missing.append(field)

    if session_code == "R":
        weather = payload.get("weather")
        if not isinstance(weather, dict) or not _items(weather.get("points")):
            missing.append("weather.points")

        telemetry_drivers = _nested_items(payload, "telemetry")
        if telemetry_payload:
            telemetry_drivers = telemetry_drivers or _nested_items(telemetry_payload, "telemetry")
        if not telemetry_drivers:
            missing.append("telemetry.drivers")

    if session_code in {"Q", "SQ", "SS"}:
        qualifying = payload.get("qualifyingAnalysis")
        if not isinstance(qualifying, dict) or not _items(qualifying.get("bestLaps")):
            missing.append("qualifyingAnalysis.bestLaps")

    return missing
