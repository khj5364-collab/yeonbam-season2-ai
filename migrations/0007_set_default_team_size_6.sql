-- Set default team size to 6 (only 5 or 6 allowed)
-- Update team_settings table default value
DROP TABLE IF EXISTS team_settings;

CREATE TABLE team_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_team_size INTEGER NOT NULL DEFAULT 6 CHECK(max_team_size IN (5, 6)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default setting (6 members per team: 남3, 여3)
INSERT INTO team_settings (id, max_team_size) VALUES (1, 6);
