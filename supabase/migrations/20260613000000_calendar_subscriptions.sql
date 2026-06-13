CREATE TYPE calendar_auth_type AS ENUM ('public', 'basic', 'bearer');

CREATE TABLE calendar_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  ical_url              TEXT,               -- public iCal URL (null for CalDAV)
  auth_type             calendar_auth_type NOT NULL DEFAULT 'public',
  caldav_server_url     TEXT,               -- e.g. https://caldav.icloud.com/
  caldav_calendar_url   TEXT,               -- discovered calendar collection URL
  vault_secret_id       UUID,               -- Vault ID for {username, secret}
  color                 TEXT NOT NULL DEFAULT '#3B82F6',
  visibility_days_before INT NOT NULL DEFAULT 14,
  visibility_days_after  INT NOT NULL DEFAULT 14,
  last_synced_at        TIMESTAMPTZ,
  ctag                  TEXT,               -- CalDAV ctag (skip if unchanged)
  etag                  TEXT,               -- HTTP ETag (skip if unchanged)
  active                BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE calendar_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar subscriptions"
  ON calendar_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to calendar subscriptions"
  ON calendar_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
