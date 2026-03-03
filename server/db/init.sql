-- Arkhitect database schema (Supabase)
-- Run via: node db/migrate.js   OR   apply in Supabase SQL editor
-- Requires: Supabase project with auth.users table

CREATE TABLE IF NOT EXISTS configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(128) NOT NULL,
  value TEXT,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (key, user_id)
);

CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(256) NOT NULL,
  description TEXT,
  calculator_code TEXT DEFAULT '',
  logic_md TEXT DEFAULT '',
  assumptions JSONB,
  bubble_app_url TEXT,
  run_order_tests BOOLEAN DEFAULT true,
  run_reporting_daily_tests BOOLEAN DEFAULT true,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
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
  trace_steps JSONB,
  passed_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  error_message TEXT,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
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
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_versions_suite
  ON code_versions(test_suite_id, version_number DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('edit', 'ask')),
  metadata JSONB,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_suite ON chat_messages(test_suite_id, created_at ASC);

-- User-scoped indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_configs_user ON configs(user_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_user ON test_suites(user_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_user ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_code_versions_user ON code_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- Enable Row Level Security
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own rows
DO $$ BEGIN
  -- configs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own configs') THEN
    CREATE POLICY "Users can view own configs" ON configs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own configs') THEN
    CREATE POLICY "Users can insert own configs" ON configs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own configs') THEN
    CREATE POLICY "Users can update own configs" ON configs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own configs') THEN
    CREATE POLICY "Users can delete own configs" ON configs FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- test_suites
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own test_suites') THEN
    CREATE POLICY "Users can view own test_suites" ON test_suites FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own test_suites') THEN
    CREATE POLICY "Users can insert own test_suites" ON test_suites FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own test_suites') THEN
    CREATE POLICY "Users can update own test_suites" ON test_suites FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own test_suites') THEN
    CREATE POLICY "Users can delete own test_suites" ON test_suites FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- test_runs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own test_runs') THEN
    CREATE POLICY "Users can view own test_runs" ON test_runs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own test_runs') THEN
    CREATE POLICY "Users can insert own test_runs" ON test_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own test_runs') THEN
    CREATE POLICY "Users can update own test_runs" ON test_runs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own test_runs') THEN
    CREATE POLICY "Users can delete own test_runs" ON test_runs FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- code_versions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own code_versions') THEN
    CREATE POLICY "Users can view own code_versions" ON code_versions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own code_versions') THEN
    CREATE POLICY "Users can insert own code_versions" ON code_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own code_versions') THEN
    CREATE POLICY "Users can update own code_versions" ON code_versions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own code_versions') THEN
    CREATE POLICY "Users can delete own code_versions" ON code_versions FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- chat_messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own chat_messages') THEN
    CREATE POLICY "Users can view own chat_messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own chat_messages') THEN
    CREATE POLICY "Users can insert own chat_messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own chat_messages') THEN
    CREATE POLICY "Users can update own chat_messages" ON chat_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own chat_messages') THEN
    CREATE POLICY "Users can delete own chat_messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON test_suites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON test_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON code_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO authenticated;
