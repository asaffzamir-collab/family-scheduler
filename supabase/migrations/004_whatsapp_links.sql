-- WhatsApp: link a phone number to a user (like telegram_links)
CREATE TABLE whatsapp_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time codes for linking (user sends code in WhatsApp to link)
CREATE TABLE whatsapp_link_codes (
  code TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_whatsapp_link_codes_expires ON whatsapp_link_codes(expires_at);

ALTER TABLE whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_link_codes ENABLE ROW LEVEL SECURITY;
