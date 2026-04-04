# 🤖 다른 AI 툴에서 재현하기 위한 프롬프트

이 문서는 Claude, ChatGPT, 또는 다른 AI 코딩 도구에 복사하여 동일한 프로젝트를 만들 수 있는 완전한 프롬프트입니다.

---

## 📋 AI에게 전달할 프롬프트

```
# 프로젝트 재현 요청

다음 사양에 맞춰 YEONBAM SEASON 2 AI 팀 빌딩 시스템을 만들어주세요.

## 프로젝트 개요
- **이름**: YEONBAM SEASON 2 AI
- **플랫폼**: Cloudflare Pages (Hono + D1)
- **목적**: 일일 입장 코드 기반 팀 빌딩 시스템

## 핵심 기능

### 1. 사용자 기능
- 신규 입장: 입장 코드, 닉네임, 성별, MBTI, 팀 번호(선택) 입력
- 재입장: 입장 코드 + 닉네임으로 팀 확인
- 전체 팀 보기: 6개 팀 현황 조회

### 2. 관리자 기능 (비밀번호: qwer1234)
- 일일 코드 생성/활성화/비활성화/삭제
- 코드별 독립 통계 조회
- 팀 설정: 팀당 6/7/8명 선택
- 팀 랜덤 배정 (고급 알고리즘)

## 데이터베이스 (D1 SQLite)

### daily_codes
- code (PK), valid_date, is_active, created_at

### participants
- id (PK), nickname, gender, mbti, access_code (FK), team_number, created_at

### teams
- team_number (PK, 1~6), male_count, female_count, total_count

### team_settings
- id (PK), max_team_size (6/7/8)

## 팀 배정 알고리즘 (최중요!)

### 우선순위
1. **팀 인원 균등** (2000점/빈 자리) - 최대 1명 차이
2. **성비 균형** - 남성이 여성보다 2명 이상 많으면 차단, 여성 많은 것은 허용
3. **이전 팀원 겹침** (500점) - 같은 이전 팀원 최대 2명
4. **MBTI E/I 균형** (100점) - I 과다 방지

### 핵심 로직
```javascript
// 성비 체크 (중요!)
if (maleCount - femaleCount >= 2) return false; // 남성 과다 차단
// 여성이 많은 것은 허용 (제약 없음)

// 성별 교차 배정 (중요!)
// I 타입 먼저: 남I, 여I, 남I, 여I...
// E 타입 다음: 남E, 여E, 남E, 여E...
```

### 배정 예시 (36명: 남18, 여18)
→ 6팀 × 6명 (남3, 여3) 균형

## 기술 스택
- Frontend: HTML/JS (바닐라), Tailwind CSS (CDN), Font Awesome
- Backend: Hono v4, TypeScript
- Database: Cloudflare D1
- Build: Vite, Wrangler

## 주요 API 엔드포인트

### 사용자
- POST /api/check-nickname
- POST /api/register
- POST /api/re-entry
- GET /api/teams

### 관리자
- POST /api/admin/generate-code
- GET /api/admin/codes
- POST /api/admin/toggle-code
- POST /api/admin/delete-code
- GET /api/admin/stats?statsCode=xxx&teamStatsCode=yyy
- GET /api/admin/code/:code/participants
- GET/POST /api/admin/team-settings
- POST /api/admin/assign-teams (알고리즘 실행)

## UI 구조
- 메인 페이지 (/): 신규/재입장 선택
- 관리자 페이지 (/admin): 통계, 코드 관리, 팀 배정
- 전체 팀 보기 (/teams): 6개 팀 카드

## 제약 조건
1. MBTI 4자리 대문자 (예: ENFP)
2. 닉네임 중복 불가 (코드별)
3. 팀 번호 1~6
4. 최대 6개 팀
5. 성비: 남성이 2명 이상 많으면 차단, 여성 많은 것은 허용

## 배포 순서
1. npm create hono@latest . -- --template cloudflare-pages
2. npx wrangler d1 create webapp-production
3. 마이그레이션 4개 파일 적용
4. npm run build
5. npx wrangler pages deploy dist

## 디자인 가이드
- 색상: Indigo primary, Green success
- 아이콘: fa-users(팀), fa-mars(남), fa-venus(여)
- E/I: green/purple
- 카드 기반 UI (rounded-2xl shadow-xl)

## 특별 요구사항
1. 관리자 비밀번호 하드코딩: qwer1234
2. 기본 팀 인원: 6명 (남3, 여3)
3. 성별 교차 배정으로 균형 극대화
4. 상세보기 모달에 MBTI 표시
5. 팀 통계에 E/I 카운트 표시

이 사양대로 전체 프로젝트를 구현해주세요.
```

---

## 📦 백업 파일 정보

**위치**: `/home/user/webapp/project_backup_20260404.tar.gz`  
**크기**: 45KB  
**포함**: 소스 코드, 마이그레이션, 설정 파일, 문서

**압축 해제**:
```bash
tar -xzf project_backup_20260404.tar.gz
```

---

## 📚 참고 문서

1. **PROJECT_SPECIFICATION.md** - 전체 프로젝트 사양
2. **COMPLETE_CODE_ARCHIVE.md** - 핵심 코드 모음
3. **src/index.tsx** - 메인 애플리케이션 (1960 lines)

---

## 🎯 검증 방법

프로젝트가 정상적으로 재현되었는지 확인:

### 1. 36명 테스트 (남18, 여18)
```
기대 결과: 6팀 × 6명 (모든 팀 남3, 여3)
```

### 2. 성비 제약 테스트
```
남4 여2 → ❌ 차단
남3 여3 → ✅ 허용
남2 여4 → ✅ 허용
```

### 3. API 테스트
```bash
curl localhost:3000/api/admin/team-settings
# {"success":true,"maxTeamSize":6}
```

### 4. 관리자 로그인
```
비밀번호: qwer1234
```

---

## 💡 주의사항

### 꼭 구현해야 할 것:
1. ✅ 성별 교차 배정 (I타입: 남→여→남→여, E타입: 남→여→남→여)
2. ✅ 성비 제약 (남성이 2명 이상 많으면 차단)
3. ✅ 여성 많은 것은 허용 (제약 없음)
4. ✅ 팀 인원 균등 분배 (최대 1명 차이)
5. ✅ 코드별 독립 통계 (statsCode, teamStatsCode 파라미터)

### 하면 안 되는 것:
1. ❌ 성비 제약 우회하는 fallback 로직 추가
2. ❌ 팀 번호를 6개 이상으로 확장
3. ❌ MBTI 우선순위를 성비보다 높게 설정

---

## 🚀 빠른 시작 (AI에게 요청)

```
위의 사양대로 Cloudflare Pages + Hono 프로젝트를 만들어주세요.
특히 팀 배정 알고리즘에서 성별 교차 배정과 성비 제약을 정확히 구현해주세요.
```

---

이 문서를 다른 AI 툴에 복사하면 동일한 시스템을 재현할 수 있습니다!
