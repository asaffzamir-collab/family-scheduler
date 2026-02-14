-- =============================================================================
-- OPTIONAL MIGRATIONS — Run in Supabase SQL Editor (one block)
-- =============================================================================
-- 1. Open Supabase Dashboard → your project → SQL Editor → New query
-- 2. Copy this ENTIRE file (Cmd+A / Ctrl+A) and paste into the editor
-- 3. Click Run
-- 4. You should see "Success" for each statement
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Migration 003: Link work/personal calendars correctly (account_email)
-- -----------------------------------------------------------------------------
ALTER TABLE user_calendars
  ADD COLUMN IF NOT EXISTS account_email TEXT DEFAULT NULL;

COMMENT ON COLUMN user_calendars.account_email IS 'NULL = main account; otherwise the linked account email for this calendar.';

-- -----------------------------------------------------------------------------
-- Migration 004: WhatsApp — link phone numbers to users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_link_codes (
  code TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_expires ON whatsapp_link_codes(expires_at);

ALTER TABLE whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_link_codes ENABLE ROW LEVEL SECURITY;
