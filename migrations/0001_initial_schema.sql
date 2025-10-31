-- Daily Access Codes Table (일일 입장 코드)
CREATE TABLE IF NOT EXISTS daily_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  valid_date DATE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Participants Table (참가자 정보)
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT UNIQUE NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
  access_code TEXT NOT NULL,
  team_number INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (access_code) REFERENCES daily_codes(code)
);

-- Survey Questions Table (설문 질문)
CREATE TABLE IF NOT EXISTS survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Survey Responses Table (설문 응답)
CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  response_value INTEGER NOT NULL CHECK(response_value BETWEEN 1 AND 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  FOREIGN KEY (question_id) REFERENCES survey_questions(id)
);

-- Teams Summary Table (팀 구성 현황)
CREATE TABLE IF NOT EXISTS teams (
  team_number INTEGER PRIMARY KEY,
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_daily_codes_date ON daily_codes(valid_date, is_active);
CREATE INDEX IF NOT EXISTS idx_participants_team ON participants(team_number);
CREATE INDEX IF NOT EXISTS idx_participants_access_code ON participants(access_code);
CREATE INDEX IF NOT EXISTS idx_survey_responses_participant ON survey_responses(participant_id);
