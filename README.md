# YEONBAM SEASON 2 AI

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange)](https://pages.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-v4-blue)](https://hono.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

일일 입장 코드 기반 팀 빌딩 시스템

## 🎯 주요 기능

### 사용자 기능
- **신규 입장**: 닉네임, 성별, MBTI, 팀 번호 입력
- **재입장**: 입장 코드 + 닉네임으로 팀 확인
- **전체 팀 보기**: 6개 팀 현황 조회

### 관리자 기능
- **일일 코드 관리**: 생성, 활성화/비활성화, 삭제
- **코드별 통계**: 독립적인 참가자 및 팀 현황
- **팀 설정**: 팀당 인원 (6/7/8명) 선택
- **고급 팀 배정**:
  - MBTI 기반 E/I 균형
  - 성비 균형 (남성 과다 방지)
  - 이전 팀원 겹침 방지 (최대 2명)
  - 인원 균등 분배

## 🏗️ 기술 스택

- **Frontend**: HTML/JavaScript (Vanilla), Tailwind CSS, Font Awesome
- **Backend**: Hono v4 (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages
- **Build**: Vite, Wrangler

## 🚀 빠른 시작

### 1. 설치

```bash
git clone https://github.com/khj5364-collab/yeonbam-season2-ai.git
cd yeonbam-season2-ai
npm install
```

### 2. 로컬 개발

```bash
# D1 데이터베이스 생성
npx wrangler d1 create webapp-production

# wrangler.jsonc에 database_id 입력
# "database_id": "복사된-database-id"

# 마이그레이션 적용
npx wrangler d1 migrations apply webapp-production --local

# 빌드
npm run build

# 개발 서버 실행
npm run dev:sandbox
```

브라우저에서 `http://localhost:3000` 접속

### 3. Cloudflare Pages 배포

```bash
# Cloudflare 로그인
npx wrangler login

# 프로덕션 D1 마이그레이션
npx wrangler d1 migrations apply webapp-production

# Pages 프로젝트 생성
npx wrangler pages project create webapp --production-branch main

# 배포
npm run deploy
```

## 📊 데이터베이스 스키마

### daily_codes
- 일일 입장 코드 관리
- 활성화/비활성화 상태

### participants
- 참가자 정보 (닉네임, 성별, MBTI, 팀 번호)
- 입장 코드별 구분

### teams
- 6개 팀 통계 (남/여 인원수)

### team_settings
- 팀당 최대 인원 설정 (6/7/8명)

## 🎨 팀 배정 알고리즘

### 우선순위
1. **팀 인원 균등** (2000점) - 최대 1명 차이
2. **성비 균형** - 남성이 2명 이상 많으면 차단
3. **이전 팀원 겹침** (500점) - 최대 2명
4. **MBTI E/I 균형** (100점) - I 과다 방지

### 성비 제약
```typescript
// 차단: 남성이 여성보다 2명 이상 많음
if (maleCount - femaleCount >= 2) return false;

// 허용
남3, 여3 ✅  // 이상적
남2, 여4 ✅  // 여성 많음 허용
남4, 여2 ❌  // 남성 과다 차단
```

### 배정 방식
성별 교차 배정으로 균형 극대화:
- I타입: 남→여→남→여...
- E타입: 남→여→남→여...

### 테스트 결과
**36명 (남18, 여18)**
- 결과: 6팀 × 6명 (모든 팀 남3, 여3)
- 상태: ✅ 완벽한 균형

## 📁 프로젝트 구조

```
webapp/
├── src/
│   └── index.tsx           # 메인 애플리케이션
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_mbti_column.sql
│   ├── 0003_add_team_settings.sql
│   └── 0004_update_default_team_size.sql
├── package.json
├── wrangler.jsonc          # Cloudflare 설정
├── tsconfig.json
└── README.md
```

## 🔐 관리자 인증

**비밀번호**: `qwer1234`

관리자 페이지: `/admin`

## 📋 주요 API 엔드포인트

### 사용자
- `POST /api/check-nickname` - 닉네임 중복 확인
- `POST /api/register` - 신규 등록
- `POST /api/re-entry` - 재입장
- `GET /api/teams` - 전체 팀 조회

### 관리자
- `POST /api/admin/generate-code` - 코드 생성
- `GET /api/admin/codes` - 코드 목록
- `POST /api/admin/toggle-code` - 활성화 토글
- `POST /api/admin/delete-code` - 코드 삭제
- `GET /api/admin/stats` - 통계 조회
- `GET /api/admin/code/:code/participants` - 참가자 상세
- `GET/POST /api/admin/team-settings` - 팀 설정
- `POST /api/admin/assign-teams` - 팀 배정

## 📝 npm 스크립트

```bash
npm run dev              # Vite 개발 서버
npm run dev:sandbox      # Wrangler 개발 서버
npm run build            # 프로젝트 빌드
npm run deploy           # Cloudflare 배포
npm run db:migrate:local # 로컬 마이그레이션
npm run db:migrate:prod  # 프로덕션 마이그레이션
```

## 🎯 제약 사항

- MBTI: 4자리 영문 대문자 (예: ENFP)
- 닉네임: 코드별 중복 불가
- 팀: 최대 6개 팀
- 팀 인원: 6/7/8명만 선택 가능
- 성비: 남성이 2명 이상 많으면 차단

## 📚 문서

- **PROJECT_SPECIFICATION.md** - 전체 프로젝트 사양
- **COMPLETE_CODE_ARCHIVE.md** - 핵심 코드 모음
- **AI_PROMPT_FOR_RECREATION.md** - AI 재현용 프롬프트

## 🤝 기여

이슈와 PR은 언제나 환영합니다!

## 📄 라이선스

MIT License

## 🔗 링크

- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Hono Framework](https://hono.dev/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

---

Made with ❤️ for YEONBAM SEASON 2
