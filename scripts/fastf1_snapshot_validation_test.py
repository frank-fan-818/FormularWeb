import unittest

from scripts.fastf1_snapshot_validation import incomplete_snapshot_fields


class FastF1SnapshotValidationTests(unittest.TestCase):
    def test_rejects_the_empty_placeholder_that_previously_counted_as_exported(self):
        payload = {
            "sessionResults": [],
            "lapTimeSeries": [],
            "tyreStrategies": [],
        }
        self.assertEqual(
            incomplete_snapshot_fields(payload, "R"),
            [
                "sessionResults",
                "lapTimeSeries",
                "tyreStrategies",
                "weather.points",
                "telemetry.drivers",
            ],
        )

    def test_accepts_a_complete_split_race_snapshot(self):
        payload = {
            "sessionResults": [{}],
            "lapTimeSeries": [{}],
            "tyreStrategies": [{}],
            "weather": {"points": [{}]},
        }
        telemetry = {"telemetry": {"drivers": [{}]}}
        self.assertEqual(incomplete_snapshot_fields(payload, "R", telemetry), [])

    def test_requires_qualifying_best_laps(self):
        payload = {
            "sessionResults": [{}],
            "lapTimeSeries": [{}],
            "tyreStrategies": [{}],
            "qualifyingAnalysis": {"bestLaps": []},
        }
        self.assertEqual(
            incomplete_snapshot_fields(payload, "SQ"),
            ["qualifyingAnalysis.bestLaps"],
        )


if __name__ == "__main__":
    unittest.main()
