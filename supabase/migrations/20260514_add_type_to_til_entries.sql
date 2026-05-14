ALTER TABLE til_entries
  ADD COLUMN type text NOT NULL DEFAULT 'TIL'
    CHECK (type IN ('TIL', 'DeepDive', 'TechStudy'));
