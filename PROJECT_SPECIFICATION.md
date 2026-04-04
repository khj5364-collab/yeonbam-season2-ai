# YEONBAM SEASON 2 AI - 팀 빌딩 시스템

## 📋 프로젝트 개요

**프로젝트 이름**: YEONBAM SEASON 2 AI  
**목적**: 일일 입장 코드 기반 팀 빌딩 시스템  
**배포 플랫폼**: Cloudflare Pages (Workers + D1 Database)  
**프레임워크**: Hono (경량 웹 프레임워크)  
**데이터베이스**: Cloudflare D1 (SQLite)  

---

## 🎯 핵심 기능

### 1. 사용자 기능
- **신규 입장**: 닉네임, 성별, MBTI, 팀 번호 입력하여 등록
- **재입장**: 입장 코드 + 닉네임으로 본인 팀 확인
- **전체 팀 보기**: 6개 팀의 현황 조회

### 2. 관리자 기능
- **일일 코드 관리**: 생성, 활성화/비활성화, 삭제
- **코드별 독립 조회**: 각 코드별 참가자 및 팀 통계
- **팀 설정**: 팀당 인원 (6/7/8명) 선택
- **고급 팀 랜덤 배정**:
  - MBTI 기반 E/I 균형
  - 성비 균형 (남성 과다 방지)
  - 이전 팀원 겹침 방지 (최대 2명)
  - 인원 균등 분배

---

## 🏗️ 기술 스택

### Frontend
- **HTML/CSS/JavaScript** (바닐라)
- **Tailwind CSS** (CDN)
- **Font Awesome** (아이콘)
- **Axios** (HTTP 클라이언트)

### Backend
- **Hono** v4.0.0 (TypeScript)
- **Cloudflare Workers** (엣지 런타임)
- **Cloudflare D1** (SQLite 데이터베이스)

### DevOps
- **Vite** (빌드 도구)
- **Wrangler** (Cloudflare CLI)
- **PM2** (프로세스 관리, 개발용)

---

## 📂 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx           # 메인 애플리케이션 (Hono 앱)
│   └── renderer.tsx        # Vite 렌더러
├── migrations/
│   ├── 0001_initial_schema.sql          # 초기 DB 스키마
│   ├── 0002_add_mbti_column.sql         # MBTI 컬럼 추가
│   ├── 0003_add_team_settings.sql       # 팀 설정 테이블
│   └── 0004_update_default_team_size.sql # 기본 팀 인원 6명
├── public/                  # 정적 파일 (필요 시)
├── dist/                    # 빌드 결과물
├── ecosystem.config.cjs     # PM2 설정 (개발용)
├── package.json             # 의존성 및 스크립트
├── wrangler.jsonc           # Cloudflare 설정
├── tsconfig.json            # TypeScript 설정
└── seed.sql                 # 테스트 데이터

```

---

## 🗄️ 데이터베이스 스키마

### 1. daily_codes (일일 입장 코드)
```sql
CREATE TABLE daily_codes (
  code TEXT PRIMARY KEY,           -- 입장 코드 (예: "1207")
  valid_date DATE NOT NULL,        -- 유효 날짜
  is_active INTEGER DEFAULT 0,     -- 활성화 상태 (0: 비활성, 1: 활성)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. participants (참가자)
```sql
CREATE TABLE participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,          -- 닉네임
  gender TEXT NOT NULL,            -- 성별 (male/female)
  mbti TEXT,                       -- MBTI (4자리, 예: ENFP)
  access_code TEXT NOT NULL,       -- 입장 코드 (외래키)
  team_number INTEGER,             -- 팀 번호 (1~6, NULL=미배정)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (access_code) REFERENCES daily_codes(code)
);
```

### 3. teams (팀 통계)
```sql
CREATE TABLE teams (
  team_number INTEGER PRIMARY KEY, -- 팀 번호 (1~6)
  male_count INTEGER DEFAULT 0,    -- 남성 수
  female_count INTEGER DEFAULT 0,  -- 여성 수
  total_count INTEGER DEFAULT 0    -- 전체 인원
);

-- 6개 팀 초기화
INSERT INTO teams (team_number) VALUES (1), (2), (3), (4), (5), (6);
```

### 4. team_settings (팀 설정)
```sql
CREATE TABLE team_settings (
  id INTEGER PRIMARY KEY,
  max_team_size INTEGER NOT NULL DEFAULT 6 CHECK(max_team_size IN (6, 7, 8)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 설정
INSERT INTO team_settings (id, max_team_size) VALUES (1, 6);
```

### 5. 인덱스
```sql
CREATE INDEX idx_participants_code ON participants(access_code);
CREATE INDEX idx_participants_team ON participants(team_number);
CREATE INDEX idx_participants_nickname ON participants(nickname);
CREATE INDEX idx_codes_active ON daily_codes(is_active);
```

---

## 🔧 주요 API 엔드포인트

### 사용자 API

#### 1. 닉네임 중복 확인
```
POST /api/check-nickname
Request: { nickname, accessCode }
Response: { success, available }
```

#### 2. 참가자 등록 (신규)
```
POST /api/register
Request: { nickname, gender, accessCode, mbti, teamNumber? }
Response: { success, participantId, teamNumber, message }
```

#### 3. 재입장 확인
```
POST /api/re-entry
Request: { nickname, accessCode }
Response: { success, participant: { nickname, gender, mbti, team_number } }
```

#### 4. 전체 팀 조회
```
GET /api/teams
Response: { success, teams: [{ team_number, male_count, female_count, total_count }] }
```

### 관리자 API

#### 5. 코드 생성
```
POST /api/admin/generate-code
Request: { validDate, adminPassword }
Response: { success, code }
```

#### 6. 코드 목록 조회
```
GET /api/admin/codes
Response: { success, codes: [{ code, valid_date, is_active, participant_count }] }
```

#### 7. 코드 활성화/비활성화
```
POST /api/admin/toggle-code
Request: { code, adminPassword }
Response: { success, isActive }
```

#### 8. 코드 삭제
```
POST /api/admin/delete-code
Request: { code, adminPassword }
Response: { success, deletedParticipants }
```

#### 9. 통계 조회
```
GET /api/admin/stats?statsCode=xxx&teamStatsCode=yyy
Response: { 
  success, 
  stats: { 
    total, male, female, 
    teams: [{ team_number, male_count, female_count, total_count }] 
  } 
}
```

#### 10. 코드별 참가자 상세
```
GET /api/admin/code/:code/participants
Response: { 
  success, 
  codeInfo, 
  participants: [{ id, nickname, gender, mbti, team_number }],
  stats: { total, male, female, teams: { 1: {male, female, total}, ... } }
}
```

#### 11. 팀 설정 조회/변경
```
GET /api/admin/team-settings
Response: { success, maxTeamSize }

POST /api/admin/team-settings
Request: { maxTeamSize, adminPassword }
Response: { success }
```

#### 12. 팀 랜덤 배정
```
POST /api/admin/assign-teams
Request: { code, adminPassword }
Response: { 
  success, 
  message, 
  assignedCount, 
  maleCount, 
  femaleCount, 
  eCount, 
  iCount 
}
```

---

## 🎨 UI/UX 구조

### 1. 메인 페이지 (/)
- **신규 입장자 버튼**
  - Step 1: 입장 코드 입력
  - Step 2: 닉네임, 성별, MBTI, 팀 번호 입력
  - Step 3: 등록 완료 화면
- **재입장자 버튼**
  - Step 1: 입장 코드 + 닉네임 입력
  - Step 2: 팀 정보 확인

### 2. 관리자 페이지 (/admin)
- 비밀번호: `qwer1234`
- **현황 통계**: 코드별 참가자 수 (남/여)
- **팀별 현황**: 코드별 6개 팀 통계
- **일일 코드 생성**: 새 코드 생성
- **팀 설정**: 팀당 인원 (6/7/8명)
- **코드 관리**: 활성화/비활성화/삭제/상세보기
- **팀 랜덤 배정**: 고급 알고리즘 실행

### 3. 전체 팀 보기 (/teams)
- 6개 팀의 인원 현황 카드 표시

---

## 🧮 팀 배정 알고리즘

### 핵심 원칙
1. **팀 인원 균등** (최우선) - 최대 1명 차이
2. **성비 균형** - 남성이 2명 이상 많으면 차단
3. **이전 팀원 겹침 방지** - 최대 2명
4. **MBTI E/I 균형** - I 과다 방지

### 성비 제약
```typescript
// 차단: 남성이 여성보다 2명 이상 많음
if (maleCount - femaleCount >= 2) return false;

// 허용
// - 남3, 여3 ✅
// - 남2, 여4 ✅
// - 남3, 여2 ✅
// - 남4, 여2 ❌
```

### 배정 순서
```typescript
// 성별 교차 배정으로 균형 극대화
// I 타입 먼저
for (let i = 0; i < maxILength; i++) {
  if (i < maleI.length) assignToTeam(maleI[i])
  if (i < femaleI.length) assignToTeam(femaleI[i])
}

// E 타입
for (let i = 0; i < maxELength; i++) {
  if (i < maleE.length) assignToTeam(maleE[i])
  if (i < femaleE.length) assignToTeam(femaleE[i])
}
```

### 점수 시스템
```typescript
score = 0

// 1. 인원 균등 (최우선)
score += remainingSlots * 2000

// 2. MBTI 균형
if (isIntrovert) {
  score += (1000 - teamICounts[t] * 100)  // I는 I 적은 팀 선호
} else {
  score += (teamICounts[t] * 100)         // E는 I 많은 팀 선호
}

// 3. 이전 팀원 적을수록 보너스
score += (2 - oldTeammateCount) * 500
```

---

## 📦 package.json

```json
{
  "name": "webapp",
  "scripts": {
    "dev": "vite",
    "dev:sandbox": "wrangler pages dev dist --ip 0.0.0.0 --port 3000",
    "build": "vite build",
    "deploy": "npm run build && wrangler pages deploy dist --project-name webapp",
    "db:migrate:local": "wrangler d1 migrations apply webapp-production --local",
    "db:migrate:prod": "wrangler d1 migrations apply webapp-production"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "4.20250705.0",
    "@hono/vite-cloudflare-pages": "^0.4.2",
    "vite": "^5.0.0",
    "wrangler": "^3.78.0",
    "typescript": "^5.0.0"
  }
}
```

---

## ⚙️ wrangler.jsonc

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "webapp",
  "compatibility_date": "2024-01-01",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "your-database-id"  // wrangler d1 create로 생성
    }
  ]
}
```

---

## 🚀 배포 절차

### 1. 로컬 개발
```bash
# 의존성 설치
npm install

# D1 마이그레이션
npx wrangler d1 create webapp-production
npx wrangler d1 migrations apply webapp-production --local

# 빌드
npm run build

# 로컬 개발 서버
npm run dev:sandbox
```

### 2. Cloudflare Pages 배포
```bash
# Cloudflare 로그인
npx wrangler login

# D1 데이터베이스 생성
npx wrangler d1 create webapp-production

# 마이그레이션 적용 (프로덕션)
npx wrangler d1 migrations apply webapp-production

# Pages 프로젝트 생성
npx wrangler pages project create webapp --production-branch main

# 배포
npm run deploy
```

---

## 🎯 테스트 시나리오

### 시나리오 1: 36명 (남18, 여18)
```
결과: 6팀 × 6명 (남3, 여3)
상태: ✅ 모든 팀 균형
```

### 시나리오 2: 30명 (남15, 여15)
```
결과: 6팀 × 5명 (남2~3, 여2~3)
상태: ✅ 성비 차이 최대 1명
```

### 시나리오 3: 42명 (남21, 여21)
```
결과: 6팀 × 7명 (남3~4, 여3~4)
상태: ✅ 남4여2 차단, 남3여4 허용
```

---

## 🔐 보안

- **관리자 비밀번호**: `qwer1234` (하드코딩)
- **세션 관리**: sessionStorage (클라이언트)
- **입력 검증**: 모든 API에서 검증
- **SQL 인젝션 방지**: Prepared Statements 사용

---

## 📊 주요 제약 사항

1. **Cloudflare Pages 제약**:
   - 파일 시스템 사용 불가
   - 서버 사이드 프로세스 불가
   - Workers 10ms CPU 제한

2. **팀 배정 제약**:
   - 최대 6개 팀
   - 팀당 인원 6/7/8명만 선택 가능
   - 성비: 남성이 2명 이상 많으면 차단

3. **데이터 제약**:
   - 닉네임 중복 불가 (코드별)
   - MBTI 4자리 영문 대문자
   - 팀 번호 1~6

---

## 📝 개발 히스토리

1. ✅ 신규/재입장 시스템
2. ✅ MBTI 기반 설문 → 직접 입력으로 변경
3. ✅ 관리자 페이지 (코드 관리)
4. ✅ 코드별 독립 통계 조회
5. ✅ 팀 설정 (6/7/8명)
6. ✅ MBTI 기반 E/I 균형 배정
7. ✅ 성비 균형 제약 추가
8. ✅ 이전 팀원 겹침 방지
9. ✅ 인원 균등 분배
10. ✅ 팀 인원 8명 → 6명 변경
11. ✅ 성비 제약 강화 (남성 과다만 차단)
12. ✅ 성별 교차 배정 알고리즘

---

## 🎨 디자인 가이드

### 색상
- Primary: Indigo (bg-indigo-600)
- Success: Green (bg-green-500)
- Warning: Yellow (bg-yellow-500)
- Danger: Red (bg-red-500)

### 아이콘
- 팀: fa-users
- 남성: fa-mars (blue)
- 여성: fa-venus (pink)
- E타입: green
- I타입: purple

### 레이아웃
- 모바일 우선 (max-w-md)
- 그라데이션 배경 (from-blue-50 to-indigo-100)
- 카드 기반 UI (rounded-2xl shadow-xl)

---

이 문서로 다른 AI 툴에서 동일한 시스템을 재현할 수 있습니다!
