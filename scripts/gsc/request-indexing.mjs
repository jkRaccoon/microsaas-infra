#!/usr/bin/env node
/**
 * 구글 Indexing API 로 특정 URL 들의 색인 갱신 요청을 보낸다.
 *
 * 주의: Google Indexing API 는 공식적으로 "채용 공고 페이지" 와 "라이브 스트림 비디오" 에만
 * 권장됨. 일반 페이지는 응답이 오지만 색인 효과는 제한적일 수 있음. 여기서는 "빠른 크롤링 힌트"
 * 용도로만 사용.
 *
 * 사용:
 *   node scripts/gsc/request-indexing.mjs https://jigeup.bal.pe.kr/ https://jigeup.bal.pe.kr/guide
 *   또는 --all 로 sites.json 의 모든 사이트 루트만 요청
 */
import { google } from 'googleapis';
import { authedClient, loadSites } from './lib.mjs';

const indexing = google.indexing({ version: 'v3', auth: authedClient() });

async function request(url, type = 'URL_UPDATED') {
  try {
    const res = await indexing.urlNotifications.publish({
      requestBody: { url, type },
    });
    return res.data;
  } catch (e) {
    throw new Error(`${url}: ${e.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let urls = [];

  if (args[0] === '--all') {
    const { apexDomain, subdomains } = loadSites();
    urls = [`https://${apexDomain}/`, ...subdomains.map((h) => `https://${h}/`)];
  } else {
    urls = args;
  }

  if (urls.length === 0) {
    console.error('사용법: node scripts/gsc/request-indexing.mjs <url> [<url>...] | --all');
    process.exit(1);
  }

  console.log(`→ Indexing API 로 ${urls.length} URL 색인 요청\n`);
  for (const url of urls) {
    try {
      const data = await request(url);
      console.log(`  ✓ ${url}`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }
  console.log(`\n✓ 완료`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
