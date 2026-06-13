CREATE TABLE calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_uid        TEXT NOT NULL,         -- iCal UID (recurring: uid + ':' + dtstart_utc)
  article_id       UUID REFERENCES articles(id) ON DELETE SET NULL,
  event_start      TIMESTAMPTZ NOT NULL,
  locally_modified BOOLEAN NOT NULL DEFAULT false,
  source_hash      TEXT,                  -- SHA-256 of key event fields; skip if unchanged
  last_synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, event_uid)
);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar events"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to calendar events"
  ON calendar_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
