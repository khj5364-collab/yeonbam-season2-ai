-- 팀 개수 설정을 team_settings 테이블에 추가
-- max_team_count 컬럼 추가 (기본값: 6)
ALTER TABLE team_settings ADD COLUMN max_team_count INTEGER DEFAULT 6;
