-- Team settings table for configurable team size
CREATE TABLE IF NOT EXISTS team_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_team_size INTEGER NOT NULL DEFAULT 8 CHECK(max_team_size IN (6, 7, 8)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default setting (8 members per team)
INSERT OR IGNORE INTO team_settings (id, max_team_size) VALUES (1, 8);
