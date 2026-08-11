-- Production error log table for remote monitoring.
-- Errors from logger.error() in production are written here via the Supabase client.
-- Developer checks this table via Supabase dashboard.

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_error_logs_user_timestamp ON error_logs (user_id, timestamp DESC);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE error_logs FROM PUBLIC, anon, authenticated;
GRANT INSERT (module, function, error, level, user_agent, url)
  ON TABLE error_logs TO authenticated;

DROP POLICY IF EXISTS "authenticated error insert" ON error_logs;
CREATE POLICY "authenticated error insert"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Auto-delete logs older than 30 days to keep table small
-- (Optional: enable pg_cron and uncomment)
-- SELECT cron.schedule('cleanup-error-logs', '0 3 * * *', $$DELETE FROM error_logs WHERE timestamp < now() - interval '30 days'$$);
