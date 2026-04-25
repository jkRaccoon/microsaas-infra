# Tool standards — bal.pe.kr 포트폴리오 공통 모듈

`microsaas-infra/templates/` 의 3개 표준 모듈을 모든 사이트에 백포팅하기 위한 가이드입니다. CDK Construct 가 아니라 **사이트별로 복붙해서 쓰는 reference implementation** 임에 주의하세요 (Phase 1 i18n-reusable-template 패턴 동일).

표준 모듈은 `microsaas-infra` 가 변경되어도 기존 사이트가 즉시 깨지지 않도록 일부러 import 가 아닌 복붙 방식으로 설계되어 있습니다. 사이트별 커스터마이즈 자유도도 확보됩니다.

---

## C1. `llms.txt` 표준 템플릿

**왜 만드나:** ChatGPT/Perplexity 가 사이트를 인용할 때 `llms.txt` 를 우선 참고합니다. AEO(Answer Engine Optimization) 의 핵심 진입점.

**적용 방법 3줄:**
1. `templates/llms.txt.template` 을 사이트의 `public/llms.txt` 로 복사한다.
2. `{{tool_name}}` `{{summary_ko}}` `{{summary_en}}` `{{faqs}}` 등 플레이스홀더를 사이트 데이터로 치환한다 (`templates/examples/llms.coupangfee.txt`, `templates/examples/llms.hangulart.txt` 참고).
3. 빌드 후 `https://<sub>.bal.pe.kr/llms.txt` 가 200 으로 응답하는지 확인한다 (Vite/CRA 모두 `public/` 파일은 자동 정적 배포).

**작성 원칙:**
- H1 = 도구명, blockquote = 1줄 요약 ko + en, 표 = Inputs/Outputs.
- FAQ 5~8개. 각 답변은 **자가완결적**이어야 함 (앞 답변 참조 금지) — LLM 이 한 단락만 발췌해도 의미가 통해야 인용됨.
- 마지막 업데이트 날짜·sources·canonical URL 필수.
- 외부 상표(쿠팡·카카오 등) 면책 한 줄 필수.

---

## C2. FAQPage JSON-LD 공통 컴포넌트

**왜 만드나:** Google 리치 결과(FAQ accordion) + 네이버 통합검색 + AEO 인용 동시 적중. FAQ 5개 이상이면 검색 노출 점수가 급격히 오릅니다.

**적용 방법 3줄:**
1. `templates/FAQ.tsx.template` 을 사이트의 `src/components/FAQ.tsx` 로 복사 (확장자 `.template` 떼고).
2. 페이지(`pages/Faq.tsx` 등)에서 `buildFaqJsonLd(FAQS)` 헬퍼를 호출해 기존 `SEO` 컴포넌트의 `jsonLd` 배열에 합쳐 넣는다.
3. 마크업은 `<FAQ faqs={FAQS} />` 한 줄로 끝. JSON-LD 인라인 출력은 SEO 가 한 번에 책임지므로 `inlineJsonLd` 옵션은 끈 채로 둔다.

**기존 사이트와의 호환성:**
- 거의 모든 사이트의 `SEO.tsx` 는 이미 `jsonLd: object | object[]` 를 받아 배열 처리하므로 추가 수정이 필요 없습니다.
- `FAQS` 배열은 5개 미만이면 `buildFaqJsonLd` 가 `null` 반환 → SEO 가 자동으로 무시.

**FAQ 작성 가이드 (5~8개 권장):**

| # | 카테고리 | 예시 질문 |
| --- | --- | --- |
| Q1 | 정의 / 차별점 | 이게 정확히 뭐 하는 도구인가요? |
| Q2 | 방법론 / 신뢰도 | 어떤 데이터·기준을 사용하나요? |
| Q3 | 한계 / 면책 | 결과가 공식 수치와 다른데 왜인가요? |
| Q4 | 프라이버시 / 가격 | 어디까지 무료이고, 데이터가 서버에 남나요? |
| Q5 | 활용 시나리오 | 결과를 어디에 쓰면 되나요? |
| Q6+ | 도메인 특화 | 세무·법령·플랫폼 정책 등 |

각 답변은 2~4문장. 첫 문장에 핵심 결론, 둘째 문장부터 근거·수치·한계.

---

## C3. 1200×630 결과 카드 Canvas 공통 모듈

**왜 만드나:** SNS 공유 카드는 자연 유입의 핵심 지렛대. 모든 사이트에서 결과 화면 → PNG → 카톡/X/스레드 공유 흐름이 같으므로 한 번 표준화하면 108개 사이트가 동일한 워터마크·디자인으로 통일됩니다.

**적용 방법 3줄:**
1. `templates/share-card.ts.template` 을 사이트의 `src/lib/shareCard.ts` 로 복사 (확장자 `.template` 떼고).
2. 사이트 메인 컬러로 `PaletteDef` (gradient + accent + text 3개) 정의 후, 결과 화면 핸들러에서 `await drawShareCard({ title, subtitle, stats, palette, watermark: '<sub>.bal.pe.kr', badge })` 를 호출해 Blob 받기.
3. `await shareOrDownload(blob, { filename, title, text })` 로 Web Share API + 다운로드 폴백 자동 처리. iOS Safari 16+ 와 Chrome Android 최신은 시스템 공유 시트가 뜨고, 데스크톱은 다운로드 폴백.

**디자인 표준:**
- 캔버스: 1200×630 (OG 표준). 인스타 정방형은 `width: 1080, height: 1080` 옵션.
- 배경: `palette.gradient` 의 색 stops 자동 추출 → 대각선 그라데이션.
- 카드: 흰색 반투명 라운드 32px, 좌측 12px accent 막대.
- 통계 칩: 최대 4개. 큰 숫자 + 라벨, 흰색 반투명 + accent 테두리.
- 워터마크 (좌하): `{subdomain}.bal.pe.kr` (자동 안 됨 — 호출 시 명시).
- 보조 라벨 (우하, 옵션): 도구명 한국어 또는 타임스탬프.

**기존 hangulart/doljan 사이트 마이그레이션:**
- hangulart: `handleDownloadCard` 안의 인라인 canvas 코드를 `drawShareCard` 호출로 교체. STYLES 라벨은 `badge` 로 전달.
- doljan: 사진 합성이 필요한 OG 이미지는 `drawShareCard` 가 아닌 `renderDoljanOG` 유지 (사진 자르기·배치 로직이 도메인 특화). 단순 결과 카드만 표준 모듈로 교체.

---

## 108개 사이트 백포팅 체크리스트 템플릿

각 사이트 PR 마다 아래 체크리스트를 본문에 복붙하세요.

```markdown
## C1 llms.txt
- [ ] `public/llms.txt` 추가 (템플릿 + 도메인 데이터 치환)
- [ ] `{{tool_name}}` `{{summary_ko}}` `{{summary_en}}` `{{tool_url}}` 채움
- [ ] FAQ 5~8개, 각 답변 2~4문장, 자가완결적
- [ ] sources 3개 이상, 마지막 업데이트 날짜
- [ ] `view-source:https://<sub>.bal.pe.kr/llms.txt` 200 OK 확인

## C2 FAQPage JSON-LD
- [ ] `src/components/FAQ.tsx` 추가 (또는 기존 컴포넌트를 표준 시그니처로 통일)
- [ ] `pages/Faq.tsx` 또는 홈 페이지 하단에 `<FAQ faqs={FAQS} />` 배치
- [ ] `SEO` 의 `jsonLd` 배열에 `buildFaqJsonLd(FAQS)` 결과 병합
- [ ] FAQS 5개 이상 (5 미만 시 검색엔진이 FAQ 리치 결과로 인식 X)
- [ ] llms.txt 의 FAQ 와 내용 일치 (운영 일관성)

## C3 결과 카드
- [ ] `src/lib/shareCard.ts` 추가
- [ ] 사이트 메인 컬러로 `PaletteDef` 정의
- [ ] 결과 화면에 "📥 결과 카드" 버튼 추가, `drawShareCard` + `shareOrDownload` 호출
- [ ] 워터마크 `<sub>.bal.pe.kr` 정확히 들어가는지 PNG 다운로드해 확인
- [ ] 모바일 Safari 에서 Web Share API 동작 확인 (선택)

## 공통
- [ ] GA4 이벤트 추가: `llms_txt_view` (선택), `faq_anchor_click`, `share_card_download`, `share_card_shared`
- [ ] 빌드 통과, deploy 후 production 검증
```

---

## 검증 방법 (운영 시)

### llms.txt
- 브라우저 주소창: `view-source:https://<sub>.bal.pe.kr/llms.txt`
- 또는 `curl -I https://<sub>.bal.pe.kr/llms.txt` → `HTTP/2 200` + `content-type: text/plain` 확인
- 한 번 인덱싱되면 GSC `사이트 > URL 검사` 에서 크롤링 결과 보임 (1~3일 소요)

### FAQPage JSON-LD
- 브라우저 주소창: `view-source:https://<sub>.bal.pe.kr/faq`
- `Ctrl+F` 로 `"@type":"FAQPage"` 검색 → 정확히 1개 매치
- `<script type="application/ld+json">` 개수 확인: 일반 페이지 3~4개 (Organization + Breadcrumb + WebApp + FAQPage). 5개 이상이면 중복 출력 의심.
- Google [Rich Results Test](https://search.google.com/test/rich-results) 에 URL 입력 → "FAQ" 결과가 valid 로 잡혀야 함.

### 결과 카드 (C3)
- 결과 화면에서 카드 다운로드 버튼 클릭 → PNG 파일 1200×630 확인
- 워터마크 텍스트가 `{subdomain}.bal.pe.kr` 정확히 일치 (오타 자주 발생)
- iOS Safari 16+ 에서 다운로드 대신 시스템 공유 시트가 뜨면 OK

### 공통 자동화 스크립트 (배치 검증)
```bash
# 모든 LIVE 서브도메인의 llms.txt 200 OK 검증
cat sites.txt | while read sub; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://$sub.bal.pe.kr/llms.txt")
  echo "$sub $status"
done | grep -v "200"
```

---

## 변경 이력

- 2026-04-25: C1·C2·C3 표준 신설. 참조 원본은 `hangulart/Home.tsx` (canvas) + `coupangfee/Faq.tsx` (FAQ) + `doljan/Home.tsx` (multi-aspect canvas).
