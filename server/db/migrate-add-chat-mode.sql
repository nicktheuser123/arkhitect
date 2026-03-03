-- Add 'create' to chat_messages.mode CHECK constraint
-- Run via Supabase SQL editor or migration tool

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_mode_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_mode_check
  CHECK (mode IN ('edit', 'ask', 'create'));
