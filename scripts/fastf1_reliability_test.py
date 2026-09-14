import importlib.util
import json
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

sys.path.insert(0, str(Path(__file__).parent))
from fastf1_reliability import RequestDiagnostics, classify_failure, parse_diagnostic


def response(status, headers=None):
    result = requests.Response()
    result.status_code = status
    result.headers.update(headers or {})
    return result


class RequestTests(unittest.TestCase):
    def test_transient_failures_recover_with_bounded_attempts(self):
        for first in [requests.Timeout(), requests.ConnectionError(), response(503), response(429)]:
            with self.subTest(first=first):
                get = Mock(side_effect=[first, response(200)])
                sleep = Mock()
                diagnostics = RequestDiagnostics(sleep=sleep, jitter=lambda: 0)
                self.assertEqual(diagnostics.get(get, 'https://livetiming.formula1.com/data').status_code, 200)
                self.assertEqual(get.call_count, 2)
                self.assertEqual(diagnostics.requests[-1]['attempts'], 2)
                sleep.assert_called_once_with(1)

    def test_403_is_not_retried_or_classified_as_pending(self):
        get = Mock(return_value=response(403))
        diagnostics = RequestDiagnostics(sleep=Mock())
        diagnostics.get(get, 'https://user:secret@livetiming.formula1.com/data?token=secret')
        self.assertEqual(get.call_count, 1)
        self.assertEqual(classify_failure(['lapTimeSeries'], diagnostics.requests), 'fetch_error')
        self.assertNotIn('secret', json.dumps(diagnostics.requests))
        self.assertEqual(diagnostics.requests[0]['status'], 403)

    def test_retry_after_is_respected_and_long_delays_are_deferred(self):
        for delay, calls in [('12', 2), ('3600', 1)]:
            get = Mock(side_effect=[response(429, {'Retry-After': delay}), response(200)])
            sleep = Mock()
            diagnostics = RequestDiagnostics(sleep=sleep, jitter=lambda: 0)
            diagnostics.get(get, 'https://example.com/data')
            self.assertEqual(get.call_count, calls)
            if calls == 2:
                sleep.assert_called_once_with(12)
            else:
                sleep.assert_not_called()

    def test_retries_stop_after_three_attempts(self):
        get = Mock(side_effect=requests.Timeout())
        diagnostics = RequestDiagnostics(sleep=Mock(), jitter=lambda: 0)
        with self.assertRaises(requests.Timeout):
            diagnostics.get(get, 'https://example.com/data')
        self.assertEqual(get.call_count, 3)
        self.assertEqual(diagnostics.requests[0]['exception'], 'Timeout')

    def test_retry_after_http_date_is_not_ignored(self):
        header = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=20), usegmt=True)
        get = Mock(side_effect=[response(503, {'Retry-After': header}), response(200)])
        sleep = Mock()
        RequestDiagnostics(sleep=sleep, jitter=lambda: 0).get(get, 'https://example.com/data')
        self.assertGreater(sleep.call_args.args[0], 18)

    def test_installed_fastf1_boundary_is_restored_even_on_exception(self):
        import fastf1
        original = fastf1.Cache.requests_get
        with self.assertRaises(ValueError):
            with RequestDiagnostics().installed():
                self.assertNotEqual(fastf1.Cache.requests_get, original)
                raise ValueError('test')
        self.assertEqual(fastf1.Cache.requests_get, original)

    def test_empty_success_is_an_incomplete_snapshot_not_pending(self):
        self.assertEqual(classify_failure(['lapTimeSeries'], [{'status': 200}]), 'incomplete_snapshot')
        self.assertEqual(classify_failure(['lapTimeSeries'], [{'status': 404}]), 'fetch_error')
        self.assertEqual(classify_failure([], [{'status': 403}]), 'complete')

    def test_partial_progress_survives_a_killed_exporter(self):
        stderr = 'FASTF1_REQUEST ' + json.dumps({'id': 1, 'url': 'https://example.com/timing', 'attempts': 1, 'inFlight': True})
        self.assertEqual(parse_diagnostic(stderr)['requests'][0]['url'], 'https://example.com/timing')


class StagingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('season_export_test_target', Path(__file__).with_name('export-fastf1-season-data.py'))
        cls.exporter = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = cls.exporter
        spec.loader.exec_module(cls.exporter)

    def test_incomplete_export_preserves_previous_snapshot_and_surfaces_actual_error(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / '2026/13/Q.json'
            target.parent.mkdir(parents=True)
            target.write_text('{"previous":"complete"}')
            args = Namespace(output=directory, season=2026, force=True, refresh_incomplete=True,
                             dry_run=False, cache=directory, telemetry_samples=10, telemetry_driver_count=1,
                             session_timeout_seconds=30)
            def failed(command, **kwargs):
                staging = Path(command[command.index('--output') + 1]) / '2026/13/Q.json'
                staging.parent.mkdir(parents=True, exist_ok=True)
                staging.write_text('{}')
                return Mock(returncode=3, stdout='', stderr='INFO Loading data\nFastF1 returned an incomplete snapshot; refusing to publish: lapTimeSeries')
            with patch.object(self.exporter.subprocess, 'run', side_effect=failed):
                result = self.exporter.run_export(args, 13, 'Q')
            self.assertEqual(target.read_text(), '{"previous":"complete"}')
            self.assertEqual(result.status, 'failed')
            self.assertIn('lapTimeSeries', result.message)

    def test_wall_timeout_retains_previous_snapshot(self):
        import subprocess
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / '2026/13/Q.json'
            target.parent.mkdir(parents=True)
            target.write_text('previous')
            args = Namespace(output=directory, season=2026, force=True, refresh_incomplete=True,
                             dry_run=False, cache=directory, telemetry_samples=10, telemetry_driver_count=1,
                             session_timeout_seconds=30)
            with patch.object(self.exporter.subprocess, 'run', side_effect=subprocess.TimeoutExpired('export', 30)):
                result = self.exporter.run_export(args, 13, 'Q')
            self.assertEqual(result.diagnostic['category'], 'session_timeout')
            self.assertEqual(target.read_text(), 'previous')

    def test_exhausted_batch_budget_does_not_start_another_export(self):
        with tempfile.TemporaryDirectory() as directory:
            args = Namespace(output=directory, season=2026, force=False, refresh_incomplete=True,
                             dry_run=False, cache=directory, telemetry_samples=10, telemetry_driver_count=1,
                             session_timeout_seconds=30, deadline=0)
            with patch.object(self.exporter.subprocess, 'run') as run:
                result = self.exporter.run_export(args, 13, 'Q')
            run.assert_not_called()
            self.assertEqual(result.diagnostic['category'], 'runtime_budget')


if __name__ == '__main__':
    unittest.main()
