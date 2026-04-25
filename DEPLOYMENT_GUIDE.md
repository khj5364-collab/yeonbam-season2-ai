# YEONBAM SEASON 2 AI - 배포 가이드

## 🌐 웹사이트 배포 방법

### ✨ 방법 1: GitHub + Cloudflare Pages 자동 배포 (추천)

가장 쉽고 빠른 방법입니다! GitHub에 코드를 푸시하면 자동으로 배포됩니다.

#### **1단계: Cloudflare 계정 생성**

1. https://dash.cloudflare.com/sign-up 접속
2. 이메일로 무료 가입
3. 이메일 인증 완료

#### **2단계: GitHub 연동 및 프로젝트 생성**

1. Cloudflare 대시보드 접속: https://dash.cloudflare.com
2. 좌측 메뉴에서 **"Workers & Pages"** 클릭
3. **"Create application"** 버튼 클릭
4. **"Pages"** 탭 선택 → **"Connect to Git"** 클릭
5. **GitHub 연동**:
   - "Connect GitHub" 버튼 클릭
   - GitHub 로그인
   - 저장소 접근 권한 허용
   - `yeonbam-season2-ai` 저장소 선택
6. **빌드 설정**:
   - Project name: `yeonbam-season2-ai` (또는 원하는 이름)
   - Production branch: `main`
   - Framework preset: `None` (직접 설정)
   - Build command: `npm run build`
   - Build output directory: `dist`
7. **"Save and Deploy"** 클릭

#### **3단계: D1 데이터베이스 생성**

배포가 시작되면 먼저 D1 데이터베이스를 생성해야 합니다.

**터미널에서 실행 (Cloudflare API 키 필요):**

```bash
# 로컬 터미널 또는 Cloudflare 대시보드에서

# 1. Cloudflare 로그인 (브라우저 열림)
npx wrangler login

# 2. 프로덕션 D1 데이터베이스 생성
npx wrangler d1 create yeonbam-production

# 출력 예시:
# ✅ Successfully created DB 'yeonbam-production'
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**database_id를 복사하세요!**

#### **4단계: wrangler.jsonc 업데이트**

복사한 `database_id`를 `wrangler.jsonc` 파일에 입력:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "yeonbam-season2-ai",
  "compatibility_date": "2024-01-01",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "yeonbam-production",
      "database_id": "여기에-복사한-database-id-입력"
    }
  ]
}
```

변경 후 GitHub에 푸시:

```bash
git add wrangler.jsonc
git commit -m "Add production D1 database ID"
git push origin main
```

#### **5단계: 데이터베이스 마이그레이션**

```bash
# 프로덕션 데이터베이스에 마이그레이션 적용
npx wrangler d1 migrations apply yeonbam-production --remote
```

#### **6단계: Cloudflare Pages에서 바인딩 설정**

1. Cloudflare 대시보드 → **Workers & Pages**
2. 생성한 프로젝트 클릭
3. **"Settings"** 탭 → **"Functions"** 메뉴
4. **"D1 database bindings"** 섹션:
   - Variable name: `DB`
   - D1 database: `yeonbam-production` 선택
   - **"Save"** 클릭
5. **재배포 트리거**:
   - "Deployments" 탭으로 이동
   - 최신 배포 클릭
   - "Retry deployment" 또는 "Redeploy" 클릭

#### **7단계: 배포 완료!**

배포가 완료되면 URL을 받게 됩니다:

```
https://yeonbam-season2-ai.pages.dev
```

또는 커스텀 도메인 (브랜치별):

```
https://main.yeonbam-season2-ai.pages.dev
```

---

### 🔧 방법 2: 로컬에서 wrangler CLI로 배포

터미널 접근이 가능하고 직접 배포하고 싶다면 이 방법을 사용하세요.

#### **1단계: Cloudflare 로그인**

```bash
cd /home/user/webapp
npx wrangler login
# 브라우저가 열리고 로그인 진행
```

#### **2단계: D1 데이터베이스 생성**

```bash
# 프로덕션 데이터베이스 생성
npx wrangler d1 create yeonbam-production

# database_id 복사 → wrangler.jsonc에 입력
```

#### **3단계: 마이그레이션 적용**

```bash
# 프로덕션 DB에 마이그레이션 적용
npx wrangler d1 migrations apply yeonbam-production --remote
```

#### **4단계: Pages 프로젝트 생성**

```bash
# Pages 프로젝트 생성
npx wrangler pages project create yeonbam-season2-ai --production-branch main
```

#### **5단계: 빌드 및 배포**

```bash
# 빌드
npm run build

# 배포
npx wrangler pages deploy dist --project-name yeonbam-season2-ai
```

배포 완료! URL이 터미널에 표시됩니다.

---

## 📊 배포 후 확인 사항

### ✅ 체크리스트

- [ ] 데이터베이스 연결 확인: `https://your-url.pages.dev/admin`
- [ ] 관리자 로그인 (비밀번호: `qwer1234`)
- [ ] 코드 생성 테스트
- [ ] 참가자 등록 테스트
- [ ] 팀 배정 테스트

### 🔍 문제 해결

#### **1. 데이터베이스 연결 오류**

```
Error: D1_ERROR: binding DB not found
```

**해결:**
- Cloudflare Pages 설정 → Functions → D1 database bindings 확인
- `DB` 바인딩이 `yeonbam-production` 데이터베이스에 연결되어 있는지 확인
- 재배포

#### **2. 마이그레이션 미적용**

```
Error: no such table: participants
```

**해결:**
```bash
npx wrangler d1 migrations apply yeonbam-production --remote
```

#### **3. 빌드 실패**

**해결:**
- `package.json`의 빌드 명령어 확인
- 로컬에서 `npm run build` 테스트
- `dist/` 폴더가 생성되는지 확인

---

## 🎯 커스텀 도메인 연결 (선택사항)

### 무료 도메인 사용

Cloudflare Pages는 기본적으로 무료 도메인을 제공합니다:

```
https://yeonbam-season2-ai.pages.dev
```

### 나만의 도메인 연결

1. 도메인 구매 (예: Namecheap, GoDaddy, 가비아 등)
2. Cloudflare에 도메인 추가:
   - Cloudflare 대시보드 → "Add a site"
   - 도메인 입력 (예: `yeonbam.com`)
   - 네임서버 변경 (도메인 등록업체에서)
3. Pages 프로젝트에 커스텀 도메인 추가:
   - Workers & Pages → 프로젝트 선택
   - "Custom domains" 탭
   - "Set up a custom domain" 클릭
   - 도메인 입력 (예: `yeonbam.com` 또는 `www.yeonbam.com`)
   - 자동으로 DNS 레코드 생성됨

---

## 🚀 GitHub Actions를 통한 자동 배포 (고급)

매번 수동으로 배포하지 않고, GitHub에 푸시하면 자동 배포되도록 설정할 수 있습니다.

### `.github/workflows/deploy.yml` 생성:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    name: Deploy to Cloudflare Pages
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=yeonbam-season2-ai
```

### GitHub Secrets 설정:

1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. "New repository secret" 클릭
3. 두 개의 시크릿 추가:
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

이제 `main` 브랜치에 푸시하면 자동으로 배포됩니다!

---

## 📱 모바일 접속

배포 완료 후 스마트폰에서도 접속 가능합니다:

1. 스마트폰 브라우저에서 배포 URL 접속
2. 홈 화면에 추가 (PWA처럼 사용 가능)
3. 모바일 최적화 UI 자동 적용

---

## 💡 추가 팁

### 환경 변수 설정

Cloudflare Pages에서 환경 변수를 설정할 수 있습니다:

1. Workers & Pages → 프로젝트 → Settings → Environment variables
2. 변수 추가 (예: 관리자 비밀번호 변경)
3. 재배포

### 로그 확인

- Cloudflare 대시보드 → Workers & Pages → 프로젝트
- "Logs" 탭에서 실시간 로그 확인
- 오류 발생 시 여기서 디버깅

### 성능 최적화

Cloudflare Pages는 전세계 300개 이상 데이터센터에서 자동으로 캐싱됩니다:
- 한국에서 접속 → 한국 서버에서 응답
- 미국에서 접속 → 미국 서버에서 응답
- 초고속 로딩 속도!

---

## 🎉 완료!

축하합니다! 이제 여러분의 팀 빌딩 시스템이 전세계에서 접속 가능한 웹사이트가 되었습니다!

**배포된 사이트:**
- 메인: `https://your-project.pages.dev`
- 관리자: `https://your-project.pages.dev/admin`
- 팀 현황: `https://your-project.pages.dev/teams`
- 익명 쪽지: `https://your-project.pages.dev/messages`
- 호감도 투표: `https://your-project.pages.dev/vote`

**GitHub 저장소:**
- https://github.com/khj5364-collab/yeonbam-season2-ai

질문이 있으시면 언제든 물어보세요! 🚀
