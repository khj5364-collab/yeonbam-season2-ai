-- 기존 코드 비활성화
UPDATE daily_codes SET is_active = 0;

-- 새로운 코드 0000 추가
INSERT OR REPLACE INTO daily_codes (code, valid_date, is_active) 
VALUES ('0000', date('now'), 1);
