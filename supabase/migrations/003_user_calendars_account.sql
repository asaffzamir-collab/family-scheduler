-- Link each user_calendar to the Google account it belongs to (main = NULL, linked = email).
-- This allows pulling events from the correct token when multiple accounts have calendars
-- with the same id (e.g. "primary").
ALTER TABLE user_calendars
  ADD COLUMN IF NOT EXISTS account_email TEXT DEFAULT NULL;

COMMENT ON COLUMN user_calendars.account_email IS 'NULL = main account; otherwise the linked account email for this calendar.';
