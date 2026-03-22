-- Add Gemini flag columns to chat_logs for admin review
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query

ALTER TABLE chat_logs
ADD COLUMN IF NOT EXISTS gemini_flagged_at timestamptz,
ADD COLUMN IF NOT EXISTS gemini_result jsonb;

COMMENT ON COLUMN chat_logs.gemini_flagged_at IS 'When this log was processed by Gemini for flagging (null = not yet processed)';
COMMENT ON COLUMN chat_logs.gemini_result IS 'Gemini flag result: { isProblematic, categories[], reasoning? }';
