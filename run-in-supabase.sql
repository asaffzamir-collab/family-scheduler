-- Paste this in Supabase SQL Editor and click Run
ALTER TABLE user_calendars
  ADD COLUMN IF NOT EXISTS account_email TEXT DEFAULT NULL;

COMMENT ON COLUMN user_calendars.account_email IS 'NULL = main account; otherwise the linked account email for this calendar.';
