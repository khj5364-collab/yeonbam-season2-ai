# ⚡ 빠른 배포 가이드 (5분 완성!)

## 🎯 가장 쉬운 방법: GitHub + Cloudflare Pages

### 1️⃣ Cloudflare 가입 (1분)
https://dash.cloudflare.com/sign-up

### 2️⃣ GitHub 연동 (2분)
1. https://dash.cloudflare.com → Workers & Pages
2. "Create application" → "Pages" → "Connect to Git"
3. GitHub 로그인 → `yeonbam-season2-ai` 저장소 선택
4. 설정:
   - Build command: `npm run build`
   - Build output: `dist`
5. "Save and Deploy" 클릭

### 3️⃣ D1 데이터베이스 생성 (2분)

**터미널에서 실행:**

```bash
# Cloudflare 로그인
npx wrangler login

# D1 데이터베이스 생성
npx wrangler d1 create yeonbam-production

# 출력된 database_id 복사!
```

**wrangler.jsonc 수정:**
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "yeonbam-production",
      "database_id": "여기에-복사한-ID-붙여넣기"
    }
  ]
}
```

**Git 푸시:**
```bash
git add wrangler.jsonc
git commit -m "Add production database"
git push origin main
```

**마이그레이션 실행:**
```bash
npx wrangler d1 migrations apply yeonbam-production --remote
```

### 4️⃣ Cloudflare에서 D1 바인딩 설정 (1분)

1. Cloudflare → Workers & Pages → 프로젝트 클릭
2. Settings → Functions → D1 database bindings
3. 추가:
   - Variable name: `DB`
   - D1 database: `yeonbam-production` 선택
4. Save → Deployments 탭 → "Retry deployment"

### 5️⃣ 완료! 🎉

배포 URL: `https://yeonbam-season2-ai.pages.dev`

---

## 🚨 문제 해결

### "binding DB not found" 오류
→ 4️⃣ 단계 D1 바인딩 설정 확인

### "no such table" 오류
→ 마이그레이션 실행:
```bash
npx wrangler d1 migrations apply yeonbam-production --remote
```

### 빌드 실패
→ 로컬에서 테스트:
```bash
npm install
npm run build
```

---

## 📖 상세 가이드

더 자세한 설명이 필요하면 `DEPLOYMENT_GUIDE.md` 파일을 참고하세요!

- GitHub Actions 자동 배포
- 커스텀 도메인 연결
- 환경 변수 설정
- 성능 최적화 팁
