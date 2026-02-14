-- ── Linked accounts (additional Google accounts, e.g. work email) ──
CREATE TABLE linked_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  google_access_token TEXT,
  google_refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;
