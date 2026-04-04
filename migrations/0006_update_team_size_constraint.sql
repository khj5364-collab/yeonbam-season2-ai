-- Update team_settings table to allow 5 or 6 members per team
-- Drop the old table and recreate with new constraint
DROP TABLE IF EXISTS team_settings;

CREATE TABLE team_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_team_size INTEGER NOT NULL DEFAULT 6 CHECK(max_team_size IN (5, 6)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default setting (6 members per team)
INSERT INTO team_settings (id, max_team_size) VALUES (1, 6);
