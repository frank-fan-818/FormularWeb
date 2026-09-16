"""Bounded GET recovery and credential-free diagnostics for the pinned FastF1 client."""
from contextlib import contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import inspect
import json
import random
import re
import time
from urllib.parse import urlsplit, urlunsplit

import requests

DIAGNOSTIC_PREFIX = 'FASTF1_DIAGNOSTIC '
REQUEST_PREFIX = 'FASTF1_REQUEST '


def safe_url(url):
    parsed = urlsplit(str(url))
    return urlunsplit((parsed.scheme, parsed.hostname or '', parsed.path, '', ''))


def safe_text(text):
    # Never retain query credentials, URL userinfo or arbitrary exception bodies.
    return re.sub(r'https?://[^\s\)\]"\']+', lambda match: safe_url(match.group()), str(text))


def classify_failure(missing_fields, request_records):
    if not missing_fields:
        return 'complete'
    if any(item.get('exception') or (item.get('status') or 0) >= 400 for item in request_records):
        return 'fetch_error'
    return 'incomplete_snapshot'


class RequestDiagnostics:
    def __init__(self, sleep=time.sleep, jitter=random.random, emit=None):
        self.requests = []
        self.missing_fields = []
        self.category = 'complete'
        self.sleep = sleep
        self.jitter = jitter
        self.emit = emit or (lambda record: None)

    def get(self, original, url, **kwargs):
        kwargs.setdefault('timeout', (10, 60))
        record = {'id': len(self.requests) + 1, 'url': safe_url(url), 'attempts': 0, 'history': []}
        self.requests.append(record)
        for attempt in range(1, 4):
            record['attempts'] = attempt
            record['inFlight'] = True
            self.emit(record)
            response = None
            error = None
            try:
                response = original(url, **kwargs)
                record.pop('exception', None)
                record['status'] = response.status_code
                record['history'].append({'status': response.status_code})
                retryable = response.status_code in {408, 429} or response.status_code >= 500
            except requests.RequestException as exc:
                error = exc
                record.pop('status', None)
                record['exception'] = type(exc).__name__
                record['history'].append({'exception': type(exc).__name__})
                retryable = isinstance(exc, (requests.Timeout, requests.ConnectionError)) and not isinstance(exc, requests.exceptions.SSLError)
            record['inFlight'] = False

            delay = 2 ** (attempt - 1) + self.jitter()
            retry_after = response.headers.get('Retry-After') if response is not None else None
            if retry_after:
                try:
                    delay = max(delay, float(retry_after))
                except ValueError:
                    try:
                        date = parsedate_to_datetime(retry_after)
                        delay = max(delay, (date - datetime.now(timezone.utc)).total_seconds())
                    except (ValueError, TypeError, OverflowError):
                        pass
                record['retryAfterSeconds'] = delay
            self.emit(record)

            # A long Retry-After is deferred to a later run, never shortened.
            if retryable and attempt < 3 and delay <= 30:
                self.sleep(delay)
                continue
            if error is not None:
                raise error
            return response

    @contextmanager
    def installed(self):
        from fastf1 import Cache
        descriptor = inspect.getattr_static(Cache, 'requests_get')
        original = Cache.requests_get
        Cache.requests_get = staticmethod(lambda url, **kwargs: self.get(original, url, **kwargs))
        try:
            yield self
        finally:
            Cache.requests_get = descriptor

    def as_dict(self):
        return {'category': self.category, 'missingFields': self.missing_fields, 'requests': self.requests}


def parse_diagnostic(stderr):
    if isinstance(stderr, bytes):
        stderr = stderr.decode('utf-8', errors='replace')
    stderr = stderr or ''
    for line in reversed(stderr.splitlines()):
        if line.startswith(DIAGNOSTIC_PREFIX):
            try:
                return json.loads(line[len(DIAGNOSTIC_PREFIX):])
            except json.JSONDecodeError:
                break
    records = {}
    for line in stderr.splitlines():
        if line.startswith(REQUEST_PREFIX):
            try:
                record = json.loads(line[len(REQUEST_PREFIX):])
                records[record['id']] = record
            except (json.JSONDecodeError, KeyError):
                continue
    return {'category': 'exporter_error', 'missingFields': [], 'requests': list(records.values())}


def diagnostic_summary(diagnostic, stderr=''):
    failed = [item for item in diagnostic.get('requests', []) if item.get('inFlight') or item.get('exception') or (item.get('status') or 0) >= 400]
    details = [f"{item['url']} [{item.get('status') or item.get('exception') or 'in_flight'}; attempts={item['attempts']}]" for item in failed]
    missing = diagnostic.get('missingFields', [])
    if missing:
        details.append('missing: ' + ', '.join(missing))
    if not details:
        lines = [line for line in stderr.splitlines() if not line.startswith((DIAGNOSTIC_PREFIX, REQUEST_PREFIX))]
        details = [safe_text(lines[-1])] if lines else []
    return diagnostic.get('category', 'exporter_error') + (': ' + '; '.join(details) if details else '')
