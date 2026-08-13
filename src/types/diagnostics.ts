export type DiagnosticOutcome =
  | 'started'
  | 'succeeded'
  | 'empty'
  | 'degraded'
  | 'failed'
  | 'aborted'
  | 'stale_ignored';

export type DiagnosticReasonCode =
  | 'network'
  | 'timeout'
  | 'http_4xx'
  | 'http_5xx'
  | 'validation'
  | 'identity_mismatch'
  | 'not_found'
  | 'schema_unavailable'
  | 'source_empty'
  | 'render'
  | 'unknown';

export type DiagnosticSource =
  | 'jolpica'
  | 'supabase'
  | 'fastf1_static'
  | 'fia'
  | 'react';

export interface DiagnosticBaseContext {
  flowId: string;
  feature: 'race_detail';
  season: string;
  round: string;
  section?: string;
  session?: string;
}

export interface DiagnosticEvent extends DiagnosticBaseContext {
  timestamp: string;
  operation: string;
  outcome: DiagnosticOutcome;
  source?: DiagnosticSource;
  reasonCode?: DiagnosticReasonCode;
  durationMs?: number;
  itemCount?: number;
  attempt?: number;
}
