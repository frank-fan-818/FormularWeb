-- Tasks status table for tracking multi-step pipeline progress.
-- Used by: FastF1 data import, FIA PDF parsing, and other long-running tasks.
-- See docs/engineering-specification.md §2.6

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(64) NOT NULL,
    -- e.g. 'fastf1_import', 'fia_parse', 'data_backfill'
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  current_step VARCHAR(64),
    -- Current pipeline step name, e.g. 'ocr', 'classify', 'save'
  error_msg TEXT,
    -- User-friendly error description (no stack traces)
  retry_count INT NOT NULL DEFAULT 0,
  input_params JSONB,
    -- Task input (season, round, file path, etc.)
  output_result JSONB,
    -- Task output (row count, file URL, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying tasks by type and status
CREATE INDEX IF NOT EXISTS idx_tasks_type_status ON tasks (task_type, status);

-- Index for finding stale/in-progress tasks
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks (status, created_at DESC);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tasks FROM anon, authenticated;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();
