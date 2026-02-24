-- Arkhitect database schema
-- Run: psql $DATABASE_URL -f db/init.sql

CREATE TABLE IF NOT EXISTS configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(128) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(256) NOT NULL,
  description TEXT,
  calculator_code TEXT DEFAULT '',
  logic_md TEXT DEFAULT '',
  run_order_tests BOOLEAN DEFAULT true,
  run_reporting_daily_tests BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  entity_id VARCHAR(256) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  logs TEXT,
  expected_vs_received JSONB,
  passed_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON test_runs(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_created ON test_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS code_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  calculator_code TEXT NOT NULL,
  summary TEXT,
  change_description TEXT,
  version_number INT NOT NULL,
  created_by VARCHAR(32) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_versions_suite
  ON code_versions(test_suite_id, version_number DESC);
