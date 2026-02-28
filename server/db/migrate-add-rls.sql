-- Migration: Add user_id columns with DEFAULT auth.uid(), enable RLS, and fix constraints
-- For existing databases that were created before user_id / RLS support.
-- Safe to re-run (IF NOT EXISTS / IF EXISTS guards throughout).

-- 1. Add user_id columns with default
ALTER TABLE configs ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE test_suites ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE code_versions ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id);

-- 2. Fix configs unique constraint: (key) → (key, user_id)
ALTER TABLE configs DROP CONSTRAINT IF EXISTS configs_key_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'configs_key_user_unique'
  ) THEN
    ALTER TABLE configs ADD CONSTRAINT configs_key_user_unique UNIQUE (key, user_id);
  END IF;
END $$;

-- 3. Indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_configs_user ON configs(user_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_user ON test_suites(user_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_user ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_code_versions_user ON code_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- 4. Enable Row Level Security on all tables
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies (idempotent via DO block)
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

-- 6. Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON test_suites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON test_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON code_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO authenticated;
