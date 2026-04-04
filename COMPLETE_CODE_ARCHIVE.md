# YEONBAM SEASON 2 AI - 전체 코드 아카이브

이 문서는 다른 AI 툴에서 프로젝트를 재현하기 위한 모든 핵심 코드를 포함합니다.

---

## 📁 파일 구조

```
webapp/
├── src/index.tsx (1960 lines) - 메인 애플리케이션
├── migrations/
│   ├── 0001_initial_schema.sql - 초기 DB
│   ├── 0002_add_mbti_column.sql - MBTI 추가
│   ├── 0003_add_team_settings.sql - 팀 설정
│   └── 0004_update_default_team_size.sql - 기본 6명
├── package.json - 의존성
├── wrangler.jsonc - Cloudflare 설정
└── tsconfig.json - TypeScript 설정
```

---

## 1️⃣ package.json

```json
{
  "name": "webapp",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "dev:sandbox": "wrangler pages dev dist --ip 0.0.0.0 --port 3000",
    "dev:d1": "wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000",
    "build": "vite build",
    "preview": "wrangler pages dev dist",
    "deploy": "npm run build && wrangler pages deploy dist",
    "deploy:prod": "npm run build && wrangler pages deploy dist --project-name webapp",
    "cf-typegen": "wrangler types --env-interface CloudflareBindings",
    "clean-port": "fuser -k 3000/tcp 2>/dev/null || true",
    "test": "curl http://localhost:3000",
    "db:migrate:local": "wrangler d1 migrations apply webapp-production --local",
    "db:migrate:prod": "wrangler d1 migrations apply webapp-production",
    "db:seed": "wrangler d1 execute webapp-production --local --file=./seed.sql",
    "db:reset": "rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local && npm run db:seed",
    "db:console:local": "wrangler d1 execute webapp-production --local",
    "db:console:prod": "wrangler d1 execute webapp-production",
    "git:init": "git init && git add . && git commit -m 'Initial commit'",
    "git:commit": "git add . && git commit -m",
    "git:status": "git status",
    "git:log": "git log --oneline"
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

## 2️⃣ wrangler.jsonc

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "webapp",
  "main": "src/index.tsx",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "pages_build_output_dir": "./dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "your-production-database-id-from-cloudflare"
    }
  ]
}
```

---

## 3️⃣ tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "lib": ["ESNext"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types", "vite/client"]
  }
}
```

---

## 4️⃣ vite.config.ts

```typescript
import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [pages()],
  build: {
    outDir: 'dist'
  }
})
```

---

## 5️⃣ ecosystem.config.cjs (개발용 PM2)

```javascript
module.exports = {
  apps: [
    {
      name: 'webapp',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
```

---

## 6️⃣ 데이터베이스 마이그레이션

### migrations/0001_initial_schema.sql

```sql
-- 일일 코드 테이블
CREATE TABLE IF NOT EXISTS daily_codes (
  code TEXT PRIMARY KEY,
  valid_date DATE NOT NULL,
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 참가자 테이블
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  gender TEXT NOT NULL,
  access_code TEXT NOT NULL,
  team_number INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (access_code) REFERENCES daily_codes(code)
);

-- 설문 질문 테이블 (사용 안함, 호환성 유지)
CREATE TABLE IF NOT EXISTS survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL
);

-- 설문 응답 테이블 (사용 안함, 호환성 유지)
CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  response_value INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  FOREIGN KEY (question_id) REFERENCES survey_questions(id)
);

-- 팀 테이블
CREATE TABLE IF NOT EXISTS teams (
  team_number INTEGER PRIMARY KEY,
  male_count INTEGER DEFAULT 0,
  female_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0
);

-- 6개 팀 초기화
INSERT OR IGNORE INTO teams (team_number, male_count, female_count, total_count) VALUES
  (1, 0, 0, 0), (2, 0, 0, 0), (3, 0, 0, 0),
  (4, 0, 0, 0), (5, 0, 0, 0), (6, 0, 0, 0);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_participants_code ON participants(access_code);
CREATE INDEX IF NOT EXISTS idx_participants_team ON participants(team_number);
CREATE INDEX IF NOT EXISTS idx_participants_nickname ON participants(nickname);
CREATE INDEX IF NOT EXISTS idx_codes_active ON daily_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_survey_responses_participant ON survey_responses(participant_id);
```

### migrations/0002_add_mbti_column.sql

```sql
ALTER TABLE participants ADD COLUMN mbti TEXT;
```

### migrations/0003_add_team_settings.sql

```sql
CREATE TABLE IF NOT EXISTS team_settings (
  id INTEGER PRIMARY KEY,
  max_team_size INTEGER NOT NULL DEFAULT 8 CHECK(max_team_size IN (6, 7, 8)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO team_settings (id, max_team_size) VALUES (1, 8);
```

### migrations/0004_update_default_team_size.sql

```sql
UPDATE team_settings SET max_team_size = 6 WHERE id = 1;
```

---

## 7️⃣ src/renderer.tsx (Vite Entry)

```typescript
import { createRoot } from 'hono/jsx/dom'

createRoot(document.getElementById('root')!)
```

---

## 8️⃣ .gitignore

```
node_modules/
dist/
.wrangler/
.dev.vars
*.log
.DS_Store
.env
.pm2/
pids/
*.pid
*.backup
*.bak
*.tar.gz
*.zip
```

---

## 9️⃣ README.md (간단 버전)

```markdown
# YEONBAM SEASON 2 AI

팀 빌딩 시스템 with Cloudflare Pages

## 설치

\`\`\`bash
npm install
npx wrangler d1 create webapp-production
npx wrangler d1 migrations apply webapp-production --local
npm run build
npm run dev:sandbox
\`\`\`

## 배포

\`\`\`bash
npx wrangler d1 migrations apply webapp-production
npm run deploy
\`\`\`

## 관리자 비밀번호

qwer1234
```

---

## 🔟 핵심 알고리즘 요약

### 팀 배정 알고리즘 (의사코드)

```javascript
function assignTeams(participants, maxTeamSize) {
  // 1. 성별 + MBTI E/I로 4개 그룹 분류
  const groups = {
    maleE: participants.filter(p => p.gender === 'male' && p.mbti[0] === 'E'),
    maleI: participants.filter(p => p.gender === 'male' && p.mbti[0] === 'I'),
    femaleE: participants.filter(p => p.gender === 'female' && p.mbti[0] === 'E'),
    femaleI: participants.filter(p => p.gender === 'female' && p.mbti[0] === 'I')
  }
  
  // 2. 각 그룹 랜덤 셔플
  Object.keys(groups).forEach(key => shuffle(groups[key]))
  
  // 3. 팀당 목표 인원 계산
  const baseSize = Math.floor(participants.length / 6)
  const extraMembers = participants.length % 6
  const teamSizeLimits = {}
  for (let t = 1; t <= 6; t++) {
    teamSizeLimits[t] = t <= extraMembers ? baseSize + 1 : baseSize
  }
  
  // 4. 성별 교차 배정 (I 타입 먼저)
  for (let i = 0; i < Math.max(maleI.length, femaleI.length); i++) {
    if (i < maleI.length) assignToTeam(maleI[i])
    if (i < femaleI.length) assignToTeam(femaleI[i])
  }
  
  // 5. E 타입도 성별 교차 배정
  for (let i = 0; i < Math.max(maleE.length, femaleE.length); i++) {
    if (i < maleE.length) assignToTeam(maleE[i])
    if (i < femaleE.length) assignToTeam(femaleE[i])
  }
}

function assignToTeam(person) {
  let bestTeam = 1
  let bestScore = -1
  
  for (let t = 1; t <= 6; t++) {
    // 제약 체크
    if (teams[t].length >= teamSizeLimits[t]) continue
    if (!checkGenderBalance(teams[t], person)) continue
    if (countOldTeammates(teams[t], person) >= 2) continue
    
    // 점수 계산
    let score = 0
    score += (teamSizeLimits[t] - teams[t].length) * 2000  // 인원 균등
    score += mbtiBalanceScore(teams[t], person) * 100      // MBTI 균형
    score += (2 - countOldTeammates(teams[t], person)) * 500  // 겹침 방지
    
    if (score > bestScore) {
      bestScore = score
      bestTeam = t
    }
  }
  
  teams[bestTeam].push(person)
}

function checkGenderBalance(team, newPerson) {
  const males = team.filter(p => p.gender === 'male').length + 
                (newPerson.gender === 'male' ? 1 : 0)
  const females = team.filter(p => p.gender === 'female').length + 
                  (newPerson.gender === 'female' ? 1 : 0)
  
  // 남성이 2명 이상 많으면 차단
  return males - females < 2
}
```

---

## 1️⃣1️⃣ 주요 API 응답 예시

### POST /api/register
```json
{
  "success": true,
  "participantId": 123,
  "teamNumber": 3,
  "message": "등록이 완료되었습니다."
}
```

### GET /api/admin/stats?statsCode=1207
```json
{
  "success": true,
  "stats": {
    "total": 36,
    "male": 18,
    "female": 18,
    "teams": [
      { "team_number": 1, "male_count": 3, "female_count": 3, "total_count": 6 },
      { "team_number": 2, "male_count": 3, "female_count": 3, "total_count": 6 },
      ...
    ]
  }
}
```

### POST /api/admin/assign-teams
```json
{
  "success": true,
  "message": "36명의 참가자를 6개 팀에 랜덤 배정했습니다.",
  "assignedCount": 36,
  "maleCount": 18,
  "femaleCount": 18,
  "eCount": 18,
  "iCount": 18
}
```

---

## 1️⃣2️⃣ 환경 변수 (.dev.vars)

```
# 로컬 개발용 환경 변수 (필요 시)
ADMIN_PASSWORD=qwer1234
```

---

## 1️⃣3️⃣ 배포 체크리스트

- [ ] Cloudflare 계정 생성
- [ ] `npx wrangler login`
- [ ] D1 데이터베이스 생성
- [ ] wrangler.jsonc에 database_id 입력
- [ ] 마이그레이션 적용 (프로덕션)
- [ ] Pages 프로젝트 생성
- [ ] 첫 배포 실행
- [ ] 도메인 설정 (선택)

---

이 문서의 모든 코드를 복사하면 동일한 시스템을 재현할 수 있습니다!

**주의**: src/index.tsx는 1960줄로 너무 길어서 별도 파일로 제공됩니다.
다음 단계에서 전체 src/index.tsx를 별도 문서로 생성하겠습니다.
