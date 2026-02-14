-- ============================================
-- Family Scheduler — Initial Migration
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Families ────────────────────────────────
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Our Family',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users (adults who sign in) ──────────────
CREATE TABLE users (
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
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('adult', 'kid')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── User calendars (Google calendar links) ──
CREATE TABLE user_calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('read', 'write')) DEFAULT 'read',
  selected_for_sync BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Events ──────────────────────────────────
CREATE TABLE events (
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

CREATE INDEX idx_events_family ON events(family_id);
CREATE INDEX idx_events_start ON events(start_time);
CREATE INDEX idx_events_person ON events(person_id);

-- ── Reminder rules ──────────────────────────
CREATE TABLE reminder_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('test', 'class', 'personal', 'other')),
  offsets JSONB NOT NULL DEFAULT '[]',
  UNIQUE(family_id, category)
);

-- ── Notification log (dedup sent reminders) ─
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  offset_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'telegram')),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, offset_key, channel, user_id)
);

-- ── Push subscriptions (Web Push) ───────────
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Inbox messages (Telegram / WhatsApp log) ─
CREATE TABLE inbox_messages (
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
CREATE TABLE telegram_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL UNIQUE,
  username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security (basic) ──────────────
-- RLS is enabled but we use service_role key server-side,
-- so these policies are for future direct-client access.

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
