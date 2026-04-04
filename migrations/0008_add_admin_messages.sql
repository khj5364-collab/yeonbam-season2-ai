-- Create admin_messages table for participants to send messages to admin
CREATE TABLE IF NOT EXISTS admin_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  sender_nickname TEXT NOT NULL,
  access_code TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES participants(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_messages_access_code ON admin_messages(access_code);
CREATE INDEX IF NOT EXISTS idx_admin_messages_is_read ON admin_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created_at ON admin_messages(created_at);
