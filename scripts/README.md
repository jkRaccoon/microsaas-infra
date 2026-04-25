# microsaas-infra scripts

Google 생태계 자동화 스크립트 모음. 모두 `scripts/gsc/auth.mjs` 로 발급받은 동일 OAuth refresh token 을 공유.

## 공통 인증

1. `.env.gsc` 에 `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET` 저장 (Google Cloud OAuth Desktop 앱)
2. `node scripts/gsc/auth.mjs` — 브라우저에서 1회 승인 → `GSC_REFRESH_TOKEN` 자동 저장
3. scope 가 바뀌면 (새 API 추가 등) 기존 refresh token 을 무효화하고 `auth.mjs` 재실행

## 활성 scope

- `webmasters` (Search Console)
- `indexing` (Indexing API)
- `analytics.edit` / `analytics.readonly` (GA4)
- `adsense.readonly` (AdSense Management API v2)
- `tagmanager.edit.containers` / `edit.containerversions` / `publish` / `readonly` (Tag Manager API v2)

## 서브 디렉토리

| 폴더 | 역할 |
|---|---|
| `gsc/` | Search Console 속성 등록·사이트맵 제출·색인 요청 |
| `ga4/` | GA4 Admin — 통화·시간대·전환 이벤트 일괄 설정 |
| `adsense/` | AdSense 상태 조회 + ads.txt 검증 |
| `gtm/` | Tag Manager — GA4 구성 태그 + 커스텀 이벤트 태그 자동 생성·게시 |

## 주 사용 명령

```bash
# Search Console
node scripts/gsc/register-all.mjs           # 도메인·사이트맵 일괄 등록
node scripts/gsc/request-indexing.mjs --all # 색인 요청

# GA4
node scripts/ga4/discover.mjs   # 현재 구조 조회
node scripts/ga4/configure.mjs  # KRW/Seoul/전환 이벤트 일괄 적용
node scripts/ga4/ai-referrer-report.mjs --html  # AI 추천 유입(ChatGPT/Perplexity 등) 7d/30d baseline + HTML 저장
# 또는 npm run ai-referrer:html

# AdSense
node scripts/adsense/status.mjs        # 사이트·광고단위·승인 상태 조회
node scripts/adsense/check-ads-txt.mjs # 모든 도메인 ads.txt 검증

# GTM
node scripts/gtm/discover.mjs   # 컨테이너·태그·트리거 현황
node scripts/gtm/configure.mjs  # GA4 구성 태그 + 커스텀 이벤트 태그 일괄 생성·게시
```
