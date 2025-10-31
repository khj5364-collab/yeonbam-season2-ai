-- Insert Default Survey Questions (기본 설문 질문 삽입)
INSERT OR IGNORE INTO survey_questions (id, question_text, question_order) VALUES 
  (1, '나는 새로운 사람들과 쉽게 친해지는 편이다', 1),
  (2, '나는 계획을 세우고 그대로 실행하는 것을 좋아한다', 2),
  (3, '나는 감정적으로 결정을 내리는 편이다', 3),
  (4, '나는 혼자 있는 시간이 필요하다', 4),
  (5, '나는 논리적이고 분석적으로 생각하는 편이다', 5);

-- Initialize Teams (6개 팀 초기화)
INSERT OR IGNORE INTO teams (team_number, male_count, female_count, total_count) VALUES 
  (1, 0, 0, 0),
  (2, 0, 0, 0),
  (3, 0, 0, 0),
  (4, 0, 0, 0),
  (5, 0, 0, 0),
  (6, 0, 0, 0);

-- Insert Today's Access Code (테스트용 오늘 날짜 코드)
INSERT OR IGNORE INTO daily_codes (code, valid_date, is_active) 
VALUES ('TEST2024', date('now'), 1);
