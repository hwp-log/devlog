CREATE TABLE til_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE til_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_full_access_temp" ON til_entries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);