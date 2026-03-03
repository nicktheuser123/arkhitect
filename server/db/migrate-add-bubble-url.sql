-- Add bubble_app_url to test_suites for Playwright recording
ALTER TABLE test_suites ADD COLUMN IF NOT EXISTS bubble_app_url TEXT;
