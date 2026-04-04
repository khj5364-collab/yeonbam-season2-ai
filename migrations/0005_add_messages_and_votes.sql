-- 익명 쪽지 테이블
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  access_code TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES participants(id),
  FOREIGN KEY (receiver_id) REFERENCES participants(id)
);

-- 호감도 투표 테이블
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id INTEGER NOT NULL,
  votee_id INTEGER NOT NULL,
  access_code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_id, votee_id),
  FOREIGN KEY (voter_id) REFERENCES participants(id),
  FOREIGN KEY (votee_id) REFERENCES participants(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_code ON messages(access_code);
CREATE INDEX IF NOT EXISTS idx_votes_votee ON votes(votee_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_code ON votes(access_code);
