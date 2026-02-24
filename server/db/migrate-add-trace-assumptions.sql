-- Add trace_steps to test_runs and assumptions to test_suites
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS trace_steps JSONB;
ALTER TABLE test_suites ADD COLUMN IF NOT EXISTS assumptions JSONB;
