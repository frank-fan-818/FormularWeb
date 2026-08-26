import unittest
from datetime import datetime, timezone

from scripts.fastf1_automation import session_is_ready, session_scheduled_start


EVENT = {
    "Session1": "Practice 1",
    "Session1DateUtc": "2026-08-21T10:00:00Z",
    "Session2": "Sprint Qualifying",
    "Session2DateUtc": "2026-08-21T14:00:00Z",
    "Session3": "Sprint",
    "Session3DateUtc": "2026-08-22T10:00:00Z",
    "Session4": "Qualifying",
    "Session4DateUtc": "2026-08-22T14:00:00Z",
    "Session5": "Race",
    "Session5DateUtc": "2026-08-23T13:00:00Z",
}


class FastF1AutomationTests(unittest.TestCase):
    def test_maps_fastf1_session_names_to_utc_start_times(self):
        self.assertEqual(
            session_scheduled_start(EVENT, "SQ"),
            datetime(2026, 8, 21, 14, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(
            session_scheduled_start(EVENT, "R"),
            datetime(2026, 8, 23, 13, 0, tzinfo=timezone.utc),
        )
        self.assertIsNone(session_scheduled_start(EVENT, "SS"))

    def test_waits_for_the_post_session_availability_window(self):
        self.assertFalse(session_is_ready(
            EVENT,
            "R",
            datetime(2026, 8, 23, 16, 59, tzinfo=timezone.utc),
            4,
        ))
        self.assertTrue(session_is_ready(
            EVENT,
            "R",
            datetime(2026, 8, 23, 17, 0, tzinfo=timezone.utc),
            4,
        ))

    def test_never_exports_a_session_missing_from_the_schedule(self):
        self.assertFalse(session_is_ready(
            EVENT,
            "SS",
            datetime(2026, 8, 24, 0, 0, tzinfo=timezone.utc),
            4,
        ))

    def test_falls_back_to_the_timezone_aware_schedule_column(self):
        event = {
            "Session5": "Race",
            "Session5DateUtc": "NaT",
            "Session5Date": "2026-08-23T15:00:00+02:00",
        }
        self.assertEqual(
            session_scheduled_start(event, "R"),
            datetime(2026, 8, 23, 13, 0, tzinfo=timezone.utc),
        )


if __name__ == "__main__":
    unittest.main()
