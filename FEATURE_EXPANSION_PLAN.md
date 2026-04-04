# 🚀 YEONBAM SEASON 2 AI - 기능 확장 계획

## 📋 기존 기능 재구성

### 기능 1: 팀 빌딩 (기존)
- 신규/재입장
- 팀 랜덤 배정
- 관리자 관리

---

## ✨ 새로운 기능 추가

### 기능 2: 익명 쪽지 시스템 💌

#### 2.1 참가자 기능
- **익명 쪽지 보내기**
  - 같은 코드 내 다른 참가자에게 익명 쪽지
  - 닉네임으로 수신자 선택
  - 메시지 입력 (최대 200자)
  - 발신자 익명 처리

- **받은 쪽지 확인**
  - 내가 받은 쪽지 목록
  - 익명으로 표시 (발신자 알 수 없음)
  - 읽음/안읽음 상태

- **쪽지 답장**
  - 익명으로 답장 가능
  - 쓰레드 형식으로 대화

#### 2.2 관리자 기능
- **쌍방향 쪽지 감지**
  - A → B, B → A 모두 쪽지를 보낸 경우 감지
  - 쌍방향 매칭 목록 표시
  - 닉네임, 성별, MBTI 표시

- **쪽지 통계**
  - 전체 쪽지 개수
  - 쌍방향 매칭 개수
  - 가장 인기 있는 참가자

#### 2.3 데이터베이스
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,           -- 발신자 ID
  receiver_id INTEGER NOT NULL,         -- 수신자 ID
  access_code TEXT NOT NULL,            -- 입장 코드
  content TEXT NOT NULL,                -- 메시지 내용
  is_read INTEGER DEFAULT 0,            -- 읽음 여부
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES participants(id),
  FOREIGN KEY (receiver_id) REFERENCES participants(id)
);

CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

---

### 기능 3: 호감도 투표 시스템 ⭐

#### 3.1 참가자 기능
- **호감도 투표**
  - 같은 코드 내 참가자에게 투표
  - 1인당 최대 3명 선택
  - 중복 투표 불가
  - 자기 자신 투표 불가

- **투표 결과 확인**
  - 자신이 받은 투표 수 (익명)
  - 전체 랭킹 (상위 10명)

#### 3.2 관리자 기능
- **투표 통계**
  - 전체 투표 현황
  - 참가자별 받은 투표 수
  - 성별/MBTI별 평균 투표
  - 호감도 순위 (TOP 10)

- **투표 관리**
  - 투표 활성화/비활성화
  - 투표 초기화
  - 투표 결과 엑셀 다운로드

#### 3.3 데이터베이스
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id INTEGER NOT NULL,            -- 투표자 ID
  votee_id INTEGER NOT NULL,            -- 피투표자 ID
  access_code TEXT NOT NULL,            -- 입장 코드
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_id, votee_id),           -- 중복 투표 방지
  FOREIGN KEY (voter_id) REFERENCES participants(id),
  FOREIGN KEY (votee_id) REFERENCES participants(id)
);

CREATE INDEX idx_votes_votee ON votes(votee_id);
CREATE INDEX idx_votes_voter ON votes(voter_id);
```

---

## 🎨 UI/UX 구조

### 메인 네비게이션
```
┌─────────────────────────────────────┐
│  YEONBAM SEASON 2 AI                │
├─────────────────────────────────────┤
│  [홈] [팀보기] [쪽지] [투표] [관리자] │
└─────────────────────────────────────┘
```

### 사용자 페이지

#### 1. 홈 (/)
- 신규/재입장 선택
- 내 정보 확인

#### 2. 팀 보기 (/teams)
- 전체 팀 현황

#### 3. 쪽지 (/messages)
- 쪽지 보내기
- 받은 쪽지함
- 보낸 쪽지함

#### 4. 투표 (/vote)
- 호감도 투표
- 투표 결과 확인

#### 5. 관리자 (/admin)
- 기존 관리 기능
- 쌍방향 매칭 확인
- 투표 통계

---

## 🔧 기술 구현 계획

### Phase 1: 데이터베이스 (30분)
- [ ] messages 테이블 마이그레이션
- [ ] votes 테이블 마이그레이션
- [ ] 인덱스 생성

### Phase 2: 쪽지 시스템 (2시간)
- [ ] 쪽지 보내기 API
- [ ] 쪽지 목록 API
- [ ] 쪽지 읽음 처리 API
- [ ] 쪽지 UI (보내기/받은함)
- [ ] 쌍방향 매칭 감지 API
- [ ] 관리자 쌍방향 매칭 UI

### Phase 3: 투표 시스템 (1.5시간)
- [ ] 투표하기 API (최대 3명)
- [ ] 투표 결과 API
- [ ] 투표 UI (참가자 선택)
- [ ] 투표 통계 API
- [ ] 관리자 투표 통계 UI

### Phase 4: 네비게이션 (30분)
- [ ] 상단 메뉴바 추가
- [ ] 페이지 라우팅
- [ ] 로그인 상태 관리

---

## 📊 API 엔드포인트

### 쪽지 API
```
POST   /api/messages/send           # 쪽지 보내기
GET    /api/messages/received       # 받은 쪽지 목록
GET    /api/messages/sent           # 보낸 쪽지 목록
POST   /api/messages/mark-read/:id  # 읽음 처리
GET    /api/admin/messages/mutual   # 쌍방향 매칭 목록
```

### 투표 API
```
POST   /api/votes/submit            # 투표하기 (최대 3명)
GET    /api/votes/my-votes          # 내가 한 투표
GET    /api/votes/my-score          # 내가 받은 투표 수
GET    /api/votes/ranking           # 전체 랭킹 (TOP 10)
GET    /api/admin/votes/stats       # 투표 통계
POST   /api/admin/votes/reset       # 투표 초기화
```

---

## 🎯 예상 작업 시간

- **Phase 1** (DB): 30분
- **Phase 2** (쪽지): 2시간
- **Phase 3** (투표): 1.5시간
- **Phase 4** (네비게이션): 30분

**총 예상 시간**: 약 4.5시간

---

## 🚀 시작할까요?

지금 바로 구현을 시작하겠습니다!

진행 순서:
1. ✅ 데이터베이스 마이그레이션 생성
2. ✅ 쪽지 시스템 백엔드 API
3. ✅ 쪽지 시스템 프론트엔드
4. ✅ 투표 시스템 백엔드 API
5. ✅ 투표 시스템 프론트엔드
6. ✅ 네비게이션 메뉴 추가
7. ✅ 관리자 쌍방향 매칭 페이지
8. ✅ 테스트 및 배포

**지금 바로 시작할까요?** 😊
