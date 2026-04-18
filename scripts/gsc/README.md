# GSC automation

Google Search Console / Indexing API 자동화 스크립트. 새 서브도메인을 만들 때마다 `register-all.mjs` 한 번 돌리면 GSC 속성 등록 + 사이트맵 제출이 자동.

## 1회 설정

### a. Google Cloud Console
1. https://console.cloud.google.com 에서 새 프로젝트 생성 (예: `bal-pe-kr-automation`)
2. "API 및 서비스 → 라이브러리" 에서 다음 API 활성화:
   - **Google Search Console API**
   - **Web Search Indexing API**
3. "OAuth 동의 화면" → External → 앱 이름 `bal.pe.kr` → 범위 `webmasters` / `indexing` 추가 → 테스트 사용자로 본인 이메일 추가
4. "사용자 인증 정보 → OAuth 클라이언트 ID" → **데스크톱 앱** → Client ID / Client Secret 발급

### b. `.env.gsc` 생성 (레포 루트)
```
GSC_CLIENT_ID=...
GSC_CLIENT_SECRET=...
```
(`.gitignore` 에 이미 `.env.gsc` 가 포함되어 있음)

### c. 최초 OAuth 인증 (한 번만)
```bash
node scripts/gsc/auth.mjs
```
브라우저가 자동으로 열리며 Google 로그인 → 권한 동의. 성공 시 `.env.gsc` 에 `GSC_REFRESH_TOKEN` 이 자동 저장됨.

## 사용

### 전체 도메인·사이트맵 GSC 등록
```bash
node scripts/gsc/register-all.mjs
```

### 특정 URL 색인 요청
```bash
node scripts/gsc/request-indexing.mjs https://jigeup.bal.pe.kr/ https://jigeup.bal.pe.kr/guide
```

### 새 서브도메인 런치 시 플로우
1. `scripts/gsc/sites.json` 의 `subdomains` 배열에 새 호스트 추가
2. `node scripts/gsc/register-all.mjs` 실행
3. (선택) `node scripts/gsc/request-indexing.mjs --all` 로 빠른 색인 요청
