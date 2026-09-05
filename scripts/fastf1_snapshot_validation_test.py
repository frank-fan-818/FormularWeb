import unittest

from scripts.fastf1_snapshot_validation import incomplete_snapshot_fields


class FastF1SnapshotValidationTests(unittest.TestCase):
    def test_roster_is_not_a_practice_classification(self):
        self.assertIn('sessionResults.timing', incomplete_snapshot_fields({
            'sessionResults': [{'driver': 'LEC', 'position': None, 'time': ''}],
            'lapTimeSeries': [{}], 'tyreStrategies': [{}],
        }, 'FP1'))

    def test_sprint_qualifying_requires_phase_times(self):
        self.assertIn('qualifyingAnalysis.phaseResults', incomplete_snapshot_fields({
            'sessionResults': [{}], 'lapTimeSeries': [{}], 'tyreStrategies': [{}],
            'qualifyingAnalysis': {'bestLaps': [{}], 'phaseResults': [{'phases': {'q1': {'time': ''}}}]},
        }, 'SQ'))
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
            ["qualifyingAnalysis.bestLaps", "qualifyingAnalysis.phaseResults"],
        )


if __name__ == "__main__":
    unittest.main()
