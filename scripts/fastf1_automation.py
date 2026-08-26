"""Pure scheduling helpers for the post-session FastF1 export workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Mapping


SESSION_NAMES: dict[str, set[str]] = {
    "R": {"race"},
    "Q": {"qualifying"},
    "S": {"sprint"},
    "SQ": {"sprint qualifying"},
    "SS": {"sprint shootout"},
    "FP1": {"practice 1"},
    "FP2": {"practice 2"},
    "FP3": {"practice 3"},
}


def normalize_session_name(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def coerce_utc_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text or text.lower() in {"nat", "nan", "none"}:
            return None
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def session_scheduled_start(event: Mapping[str, Any], session: str) -> datetime | None:
    expected_names = SESSION_NAMES.get(session.upper(), set())
    for index in range(1, 6):
        if normalize_session_name(event.get(f"Session{index}")) not in expected_names:
            continue
        for date_key in (f"Session{index}DateUtc", f"Session{index}Date"):
            scheduled_start = coerce_utc_datetime(event.get(date_key))
            if scheduled_start is not None:
                return scheduled_start
        return None
    return None


def session_is_ready(
    event: Mapping[str, Any],
    session: str,
    now: datetime,
    availability_delay_hours: float,
) -> bool:
    scheduled_start = session_scheduled_start(event, session)
    if scheduled_start is None:
        return False
    normalized_now = coerce_utc_datetime(now)
    if normalized_now is None:
        return False
    return normalized_now >= scheduled_start + timedelta(hours=max(0, availability_delay_hours))
