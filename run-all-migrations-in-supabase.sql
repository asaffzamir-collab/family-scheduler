-- =============================================================================
-- Family Scheduler — ALL MIGRATIONS (paste into Supabase SQL Editor and Run)
-- =============================================================================
-- 1. Open Supabase Dashboard → your project → SQL Editor → New query
-- 2. Copy this ENTIRE file (Cmd+A / Ctrl+A) and paste into the editor
-- 3. Click "Run"
-- 4. You should see "Success. No rows returned"
-- =============================================================================


-- ═══════════════════════════════════════════════
-- Migration 001: Initial schema
-- ═══════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Families ────────────────────────────────
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Our Family',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users (adults who sign in) ──────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  google_access_token TEXT,
  google_refresh_token TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Family members (adults + kids) ──────────
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('adult', 'kid')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── User calendars (Google calendar links) ──
CREATE TABLE IF NOT EXISTS user_calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('read', 'write')) DEFAULT 'read',
  selected_for_sync BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Events ──────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  google_event_id TEXT,
  calendar_id UUID REFERENCES user_calendars(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  rrule TEXT,
  person_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('test', 'class', 'personal', 'other')) DEFAULT 'other',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  notes TEXT,
  created_from TEXT NOT NULL CHECK (created_from IN ('manual', 'telegram', 'whatsapp', 'email')) DEFAULT 'manual',
  source_message_id TEXT,
  conflict_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_family ON events(family_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id);

-- ── Reminder rules ──────────────────────────
CREATE TABLE IF NOT EXISTS reminder_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('test', 'class', 'personal', 'other')),
  offsets JSONB NOT NULL DEFAULT '[]',
  UNIQUE(family_id, category)
);

-- ── Notification log (dedup sent reminders) ─
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  offset_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'telegram')),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, offset_key, channel, user_id)
);

-- ── Push subscriptions (Web Push) ───────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Inbox messages (Telegram / WhatsApp log) ─
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'whatsapp', 'email')),
  external_id TEXT NOT NULL,
  chat_id TEXT,
  raw_text TEXT NOT NULL,
  parsed_json JSONB,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel, external_id)
);

-- ── Telegram link table ─────────────────────
CREATE TABLE IF NOT EXISTS telegram_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL UNIQUE,
  username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security ──────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendars ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════
-- Migration 002: Linked accounts
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  google_access_token TEXT,
  google_refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════
-- Migration 003: User calendars account_email column
-- ═══════════════════════════════════════════════

ALTER TABLE user_calendars
  ADD COLUMN IF NOT EXISTS account_email TEXT DEFAULT NULL;

COMMENT ON COLUMN user_calendars.account_email IS 'NULL = main account; otherwise the linked account email for this calendar.';


-- ═══════════════════════════════════════════════
-- Migration 004: WhatsApp links
-- ═══════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════
-- Migration 005: Fix PostgREST permissions
-- ═══════════════════════════════════════════════
-- This is the CRITICAL part — without this, PostgREST
-- (which Supabase uses) cannot see the tables, causing
-- the PGRST205 "table not found in schema cache" error.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future tables also get the right grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Reload PostgREST schema cache so it picks up the tables
NOTIFY pgrst, 'reload schema';
