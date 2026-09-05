import unittest
import pandas as pd

from scripts.fastf1_classification import practice_results, session_load_options


class ClassificationTests(unittest.TestCase):
    def test_lightweight_sessions_still_load_deleted_lap_messages(self):
        for code in ('FP1', 'FP2', 'FP3', 'SQ', 'SS'):
            options = session_load_options(code, results_only=True, laps_only=True)
            self.assertTrue(options['laps'])
            self.assertTrue(options['messages'])
            self.assertFalse(options['telemetry'])

    def test_practice_ranks_valid_best_laps_and_counts_all_completed_laps(self):
        results = pd.DataFrame({'DriverNumber': ['1', '2', '3'], 'Position': [None] * 3}).set_index('DriverNumber', drop=False)
        laps = pd.DataFrame({
            'DriverNumber': ['1', '1', '2', '2', '3'],
            'LapTime': pd.to_timedelta([80, 90, 91, 89, None], unit='s'),
            'Deleted': [True, False, False, False, False],
            'LapNumber': [1, 2, 1, 2, 1],
            'Time': pd.to_timedelta([80, 170, 91, 180, 100], unit='s'),
        })
        actual = practice_results(results, laps)
        self.assertEqual(actual.index.tolist(), ['2', '1', '3'])
        self.assertEqual(actual.loc['1', 'Time'], pd.Timedelta(seconds=90))
        self.assertEqual(actual.loc['1', 'Laps'], 2)
        self.assertTrue(pd.isna(actual.loc['3', 'Position']))
        self.assertTrue(results['Position'].isna().all())

    def test_refuses_unknown_deleted_lap_status(self):
        with self.assertRaisesRegex(ValueError, 'deleted'):
            practice_results(pd.DataFrame({'DriverNumber': ['1']}), pd.DataFrame({
                'DriverNumber': ['1'], 'LapTime': [pd.Timedelta(seconds=80)], 'LapNumber': [1],
            }))

    def test_outlaps_inlaps_and_generated_laps_do_not_count_as_best_times(self):
        results = pd.DataFrame({'DriverNumber': ['1']})
        laps = pd.DataFrame({
            'DriverNumber': ['1'] * 4, 'LapTime': pd.to_timedelta([70, 75, 80, 90], unit='s'),
            'Deleted': [False] * 4, 'LapNumber': [1, 2, 3, 4],
            'PitOutTime': [pd.Timedelta(seconds=1), pd.NaT, pd.NaT, pd.NaT],
            'PitInTime': [pd.NaT, pd.Timedelta(seconds=150), pd.NaT, pd.NaT],
            'FastF1Generated': [False, False, True, False],
        })
        self.assertEqual(practice_results(results, laps).loc['1', 'Time'], pd.Timedelta(seconds=90))


if __name__ == '__main__':
    unittest.main()
