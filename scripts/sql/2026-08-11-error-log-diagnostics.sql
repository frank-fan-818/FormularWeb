-- Add privacy-safe correlation fields to production error reports.
alter table if exists public.error_logs
  add column if not exists flow_id varchar(64),
  add column if not exists feature varchar(32),
  add column if not exists season varchar(8),
  add column if not exists round varchar(8),
  add column if not exists section varchar(32),
  add column if not exists session varchar(8),
  add column if not exists operation varchar(96),
  add column if not exists outcome varchar(24),
  add column if not exists source varchar(32),
  add column if not exists reason_code varchar(32),
  add column if not exists duration_ms integer;

create index if not exists idx_error_logs_flow_timestamp
  on public.error_logs (flow_id, timestamp desc)
  where flow_id is not null;

revoke all on table public.error_logs from public, anon, authenticated;
grant insert (
  module, function, error, level, user_agent, url,
  flow_id, feature, season, round, section, session,
  operation, outcome, source, reason_code, duration_ms
) on table public.error_logs to authenticated;
