-- Production error log table for remote monitoring.
-- Errors from logger.error() in production are written here via the Supabase client.
-- Developer checks this table via Supabase dashboard.

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(64) NOT NULL,
  function VARCHAR(128) NOT NULL,
  error TEXT NOT NULL,
  level VARCHAR(8) NOT NULL DEFAULT 'error'
    CHECK (level IN ('error', 'warn')),
  user_agent TEXT,
  url TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_module ON error_logs (module);

-- Auto-delete logs older than 30 days to keep table small
-- (Optional: enable pg_cron and uncomment)
-- SELECT cron.schedule('cleanup-error-logs', '0 3 * * *', $$DELETE FROM error_logs WHERE timestamp < now() - interval '30 days'$$);
